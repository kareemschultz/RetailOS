import { and, desc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";

import * as schema from "../schema";
import type { TenantTransaction } from "../tenant";
import { mulDivRound } from "./rounding";
import { resolveSetting } from "./settings-resolver";

export interface TaxableLineInput {
  lineBaseMinor: number;
  productId: string;
  qty: number;
  skuId: string;
}

export interface ActiveSalesTaxRate {
  id: string;
  name: string;
  rateBps: number;
}

export interface TaxedLine extends TaxableLineInput {
  lineTaxMinor: number;
  taxRateId: string | null;
}

export interface SalesTaxResult {
  lines: TaxedLine[];
  taxBreakdown: Array<{
    baseMinor: number;
    name: string;
    rateBps: number;
    taxMinor: number;
    taxRateId: string;
  }>;
  taxMinor: number;
}

export async function resolveActiveSalesTaxRate(
  tx: TenantTransaction,
  at: Date = new Date()
): Promise<ActiveSalesTaxRate | null> {
  const rate = (
    await tx
      .select({
        id: schema.taxRate.id,
        name: schema.taxRate.name,
        rateBps: schema.taxRate.rateBps,
      })
      .from(schema.taxRate)
      .where(
        and(
          eq(schema.taxRate.kind, "standard"),
          eq(schema.taxRate.isActive, true),
          or(
            isNull(schema.taxRate.effectiveFrom),
            lte(schema.taxRate.effectiveFrom, at)
          ),
          or(
            isNull(schema.taxRate.effectiveTo),
            gt(schema.taxRate.effectiveTo, at)
          )
        )
      )
      .orderBy(
        desc(schema.taxRate.effectiveFrom),
        desc(schema.taxRate.createdAt)
      )
      .limit(1)
  ).at(0);

  return rate ?? null;
}

export function calculateSalesTaxLines(args: {
  lines: TaxableLineInput[];
  rate: ActiveSalesTaxRate | null;
}): SalesTaxResult {
  if (!args.rate) {
    return {
      lines: args.lines.map((line) => ({
        ...line,
        lineTaxMinor: 0,
        taxRateId: null,
      })),
      taxBreakdown: [],
      taxMinor: 0,
    };
  }

  const taxedLines = args.lines.map((line) => {
    const lineTaxMinor = Number(
      mulDivRound(
        line.lineBaseMinor,
        args.rate?.rateBps ?? 0,
        10_000,
        "half_up"
      )
    );
    return {
      ...line,
      lineTaxMinor,
      taxRateId: args.rate?.id ?? null,
    };
  });

  const baseMinor = taxedLines.reduce(
    (sum, line) => sum + line.lineBaseMinor,
    0
  );
  const taxMinor = taxedLines.reduce((sum, line) => sum + line.lineTaxMinor, 0);

  return {
    lines: taxedLines,
    taxBreakdown:
      taxMinor === 0
        ? []
        : [
            {
              baseMinor,
              name: args.rate.name,
              rateBps: args.rate.rateBps,
              taxMinor,
              taxRateId: args.rate.id,
            },
          ],
    taxMinor,
  };
}

// --- Shopix storefront quote tax (design §4) ---------------------------
//
// Unlike POS's single tenant-wide rate, a public storefront quote resolves a
// DIFFERENT rate per line (product → category → tenant-default "standard"
// rate), because GRA-style tax needs distinct standard/zero/exempt treatment
// per product. Shares the same `tax_rate` table, `mulDivRound` primitive, and
// the tenant-default concept (`resolveActiveSalesTaxRate`) as POS — this is a
// separate WRAPPER with its own per-line resolution, not a forked tax system.

export interface QuoteTaxLineInput {
  categoryTaxRateId: string | null;
  lineBaseMinor: number;
  productTaxRateId: string | null;
}

export interface QuoteTaxedLine {
  lineBaseMinor: number;
  lineTaxMinor: number;
}

// Deliberately omits `taxRateId` (an internal uuid) — public DTO allow-list
// discipline: only fields with a genuine storefront reason ship publicly.
export interface QuoteTaxBreakdownEntry {
  baseMinor: number;
  name: string;
  rateBps: number;
  taxMinor: number;
}

export interface QuoteTaxResult {
  lines: QuoteTaxedLine[];
  taxBreakdown: QuoteTaxBreakdownEntry[];
  taxMinor: number;
}

function resolveLineTaxRateId(line: QuoteTaxLineInput): string | null {
  return resolveSetting(
    { category: line.categoryTaxRateId, product: line.productTaxRateId },
    ["product", "category"]
  ).value;
}

export async function calculateQuoteTax(
  tx: TenantTransaction,
  lines: QuoteTaxLineInput[]
): Promise<QuoteTaxResult> {
  const explicitIds = [
    ...new Set(
      lines.map(resolveLineTaxRateId).filter((id): id is string => id != null)
    ),
  ];

  const explicitRates = explicitIds.length
    ? await tx
        .select({
          id: schema.taxRate.id,
          name: schema.taxRate.name,
          rateBps: schema.taxRate.rateBps,
        })
        .from(schema.taxRate)
        .where(inArray(schema.taxRate.id, explicitIds))
    : [];
  const explicitById = new Map(explicitRates.map((rate) => [rate.id, rate]));

  // Tenant-default fallback for lines with no explicit product/category
  // classification — the "standard" active rate, same concept POS uses.
  const tenantDefault = await resolveActiveSalesTaxRate(tx);

  const taxedLines: QuoteTaxedLine[] = [];
  const byRate = new Map<string, QuoteTaxBreakdownEntry>();
  let taxMinor = 0;

  for (const line of lines) {
    const resolvedId = resolveLineTaxRateId(line);
    const rate = resolvedId
      ? (explicitById.get(resolvedId) ?? null)
      : tenantDefault;
    const lineTaxMinor = rate
      ? Number(mulDivRound(line.lineBaseMinor, rate.rateBps, 10_000, "half_up"))
      : 0;
    taxedLines.push({ lineBaseMinor: line.lineBaseMinor, lineTaxMinor });
    taxMinor += lineTaxMinor;

    if (rate && lineTaxMinor !== 0) {
      const existing = byRate.get(rate.id);
      if (existing) {
        existing.baseMinor += line.lineBaseMinor;
        existing.taxMinor += lineTaxMinor;
      } else {
        byRate.set(rate.id, {
          baseMinor: line.lineBaseMinor,
          name: rate.name,
          rateBps: rate.rateBps,
          taxMinor: lineTaxMinor,
        });
      }
    }
  }

  return {
    lines: taxedLines,
    taxBreakdown: [...byRate.values()],
    taxMinor,
  };
}
