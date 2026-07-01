import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";

import * as schema from "../schema";
import type { TenantTransaction } from "../tenant";
import { mulDivRound } from "./rounding";

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
          eq(schema.taxRate.kind, "sales"),
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
