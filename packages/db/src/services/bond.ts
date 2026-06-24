import { count, eq, sql } from "drizzle-orm";
import {
  bondReceipt,
  bondReceiptLine,
  location as locationTable,
  lot as lotTable,
} from "../schema";
import type { TenantTransaction } from "../tenant";
import { applyValuation, resolveCostingMethod } from "./costing";
import { appendStockMovement } from "./stock-ledger";
import type { ServiceContext } from "./types";

// Phase 3 commit 4 — bonded stock receiving (INV-3).
//
// A bond receipt records an import batch INTO a bonded location
// (`is_bonded=true`, `is_sellable=false`). Each line is a regular stock
// RECEIPT (movementType='receipt') decorated with compliance metadata and a
// STAMPED resolved costing method (F5: immune to later category/tenant changes).
//
// BONDED = AVCO-ONLY (LOCKED §I.4): if a SKU resolves to FIFO, the service
// REJECTS — the duty-on-release value-only path (commit 5) is AVCO-only today.
// A FIFO-bonded need is a clean change-request, not tonight's scope.

export interface BondReceiptLineInput {
  costCurrency: string;
  costScale: number;
  customsReference?: string | null;
  landedCostReference?: string | null;
  lotId?: string | null;
  productId: string;
  qty: number;
  skuId: string;
  // Cost triplet — required (bonded stock must always be valued at receipt).
  unitCostMinor: number;
}

export interface CreateBondReceiptInput {
  companyId: string;
  customsReference?: string | null;
  landedCostReference?: string | null;
  lines: BondReceiptLineInput[];
  locationId: string;
  receivedAt?: Date | null;
  supplierRef?: string | null;
}

type BondReceiptRow = typeof bondReceipt.$inferSelect;
type BondReceiptLineRow = typeof bondReceiptLine.$inferSelect;

function fail(msg: string): never {
  throw new Error(msg);
}

// Verify the target is a BONDED location (is_bonded=true) in the stated company.
// The router guards these too, but createBondReceipt is exported, so this is the
// service-level backstop (Codex F1) for any future direct caller. The
// (tenant_id, company_id, location_id) composite FK on bond_receipt is the
// ultimate DB-layer guarantee; this gives a clean error before the insert.
async function assertBondedLocation(
  tx: TenantTransaction,
  locationId: string,
  companyId: string
): Promise<void> {
  const loc = (
    await tx
      .select({
        isBonded: locationTable.isBonded,
        name: locationTable.name,
        companyId: locationTable.companyId,
      })
      .from(locationTable)
      .where(eq(locationTable.id, locationId))
      .limit(1)
  ).at(0);
  if (!loc) {
    fail("bond: location not found in this tenant");
  }
  if (loc.companyId !== companyId) {
    fail(
      "bond: bonded location does not belong to the receipt's company (cross-company receipt rejected)"
    );
  }
  if (!loc.isBonded) {
    fail(
      "bond: bond receipts can only be received into a bonded location (is_bonded=true)"
    );
  }
}

// Per-line cross-entity validation (Codex F3/F5), defense-in-depth over the
// router guards for direct callers of the exported service.
async function validateBondLine(
  tx: TenantTransaction,
  lineInput: BondReceiptLineInput
): Promise<void> {
  // F5: bonded dutiable goods must be valued at a POSITIVE unit cost. A zero
  // cost creates qty>0 with value=0 and zeroes the duty-on-release basis
  // (commit 5). Enforced by the DB CHECK too; this is the clean error.
  if (lineInput.unitCostMinor <= 0) {
    fail(
      `bond: unit cost must be positive for bonded stock (SKU ${lineInput.skuId}); got ${lineInput.unitCostMinor}`
    );
  }
  // F3: when a lot is supplied it must BELONG to this line's sku. The
  // (tenant_id, lot_id) composite FK only proves the lot is in this tenant; lot
  // has no (tenant_id, sku_id, id) unique to FK against, so the lot↔sku
  // relationship is checked here (the only cross-entity tie the composite FKs
  // can't enforce). Router guards this too; this is the exported-caller backstop.
  if (lineInput.lotId) {
    const lotRow = (
      await tx
        .select({ skuId: lotTable.skuId })
        .from(lotTable)
        .where(eq(lotTable.id, lineInput.lotId))
        .limit(1)
    ).at(0);
    if (!lotRow) {
      fail(`bond: lot ${lineInput.lotId} not found in this tenant`);
    }
    if (lotRow.skuId !== lineInput.skuId) {
      fail(
        `bond: lot ${lineInput.lotId} does not belong to SKU ${lineInput.skuId} (cross-SKU lot rejected)`
      );
    }
  }
}

export async function createBondReceipt(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: CreateBondReceiptInput
): Promise<{ receipt: BondReceiptRow; lines: BondReceiptLineRow[] }> {
  if (input.lines.length === 0) {
    fail("bond: at least one line is required");
  }
  await assertBondedLocation(tx, input.locationId, input.companyId);

  // Gapless per-tenant bond receipt number (advisory-locked).
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`bondnum:${ctx.tenantId}`}, 0))`
  );
  const seq =
    ((await tx.select({ c: count() }).from(bondReceipt)).at(0)?.c ?? 0) + 1;
  const number = `BND-${seq}`;

  const receipt = (
    await tx
      .insert(bondReceipt)
      .values({
        tenantId: ctx.tenantId,
        companyId: input.companyId,
        locationId: input.locationId,
        number,
        status: "open",
        supplierRef: input.supplierRef ?? null,
        customsReference: input.customsReference ?? null,
        landedCostReference: input.landedCostReference ?? null,
        receivedAt: input.receivedAt ?? null,
        createdBy: ctx.actorUserId ?? null,
      })
      .returning()
  ).at(0);
  if (!receipt) {
    fail("bond: failed to create bond receipt");
  }

  const lines: BondReceiptLineRow[] = [];
  for (const lineInput of input.lines) {
    await validateBondLine(tx, lineInput);
    // Resolve costing method and enforce AVCO-only for bonded stock (§I.4/F5).
    const method = await resolveCostingMethod(tx, ctx, {
      productId: lineInput.productId,
      skuId: lineInput.skuId,
    });
    if (method !== "avco") {
      fail(
        `bond: SKU ${lineInput.skuId} resolves to '${method}' costing — bonded stock is AVCO-only in Phase 3 (LOCKED §I.4). A FIFO-bonded path is a future change-request.`
      );
    }

    // Append the stock receipt movement to the ledger (the sole ledger mutator).
    const movement = await appendStockMovement(tx, ctx, {
      costCurrency: lineInput.costCurrency,
      costScale: lineInput.costScale,
      locationId: input.locationId,
      lotId: lineInput.lotId ?? null,
      movementType: "receipt",
      productId: lineInput.productId,
      qtyDelta: lineInput.qty,
      refId: receipt.id,
      refType: "bond_receipt",
      skuId: lineInput.skuId,
      unitCostMinor: lineInput.unitCostMinor,
    });

    // Apply AVCO valuation (builds avg_cost at the bonded location).
    await applyValuation(tx, ctx, movement);

    // Insert the bond_receipt_line compliance record, including the F5 stamp.
    const line = (
      await tx
        .insert(bondReceiptLine)
        .values({
          tenantId: ctx.tenantId,
          bondReceiptId: receipt.id,
          productId: lineInput.productId,
          skuId: lineInput.skuId,
          lotId: lineInput.lotId ?? null,
          qty: lineInput.qty,
          unitCostMinor: lineInput.unitCostMinor,
          costCurrency: lineInput.costCurrency,
          costScale: lineInput.costScale,
          customsReference: lineInput.customsReference ?? null,
          landedCostReference: lineInput.landedCostReference ?? null,
          // F5 stamp — method is always 'avco' at this point (FIFO was rejected
          // above), but we stamp the resolved value (not a constant) so the
          // guarantee holds even if an admin manually changes the product's
          // category/tenant costing setting later.
          costingMethodApplied: method,
          movementId: movement.id,
        })
        .returning()
    ).at(0);
    if (!line) {
      fail("bond: failed to insert bond receipt line");
    }
    lines.push(line);
  }

  return { receipt, lines };
}
