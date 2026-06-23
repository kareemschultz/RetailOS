import { count, eq, sql } from "drizzle-orm";
import {
  bondReceipt,
  bondReceiptLine,
  bondRelease,
  bondReleaseLine,
  location as locationTable,
} from "../schema";
import type { TenantTransaction } from "../tenant";
import { applyValuation, resolveCostingMethod } from "./costing";
import { appendStockMovement, stockOnHandForSku } from "./stock-ledger";
import {
  createTransfer,
  receiveTransfer,
  shipTransfer,
  type TransferLineValue,
} from "./transfer";
import type { ServiceContext } from "./types";

// Phase 3 commit 5 — bond release + duty cost-basis link + approval seam (INV-4/5).
//
// executeBondRelease composes existing machinery — it adds NO new costing path:
//   1. create+ship+receive a stock_transfer (bonded → released) — the transfer
//      engine conserves qty AND value (INV-2).
//   2. per line with duty/tax, append a value-only `valuation_adjustment`
//      (qty_delta=0, value_delta=duty+tax) at the released location — the
//      EXISTING AVCO value-only seam (applyAvcoValueOnly via applyValuation).
//      This is an INTENTIONAL value-ADD (raises the released cost basis), NOT
//      conservation.
//
// F5: each line is enforced against the stamped bond_receipt_line method; only
// 'avco' is valid in Phase 3 (LOCKED §I.4). RBAC-immediate; requestedBy/
// approvedBy RESERVED nullable for the §22 workflow.

export interface BondReleaseLineInput {
  bondReceiptLineId: string;
  dutyMinor?: number;
  qty: number;
  taxMinor?: number;
}

export interface ExecuteBondReleaseInput {
  bondReceiptId: string;
  destLocationId: string;
  lines: BondReleaseLineInput[];
}

// Per-line data for the `inventory.bond_released` event (event-map-phase3.md).
// skuId/currency/scale come from the originating receipt line; releasedValueMinor
// is the exact integer value conserved by the transfer leg (INV-2).
export interface BondReleaseEventLine {
  bondReceiptLineId: string;
  currency: string;
  dutyMinor: number;
  qtyBase: number;
  releasedValueMinor: number | null;
  scale: number;
  skuId: string;
  taxMinor: number;
}

type BondReceiptRow = typeof bondReceipt.$inferSelect;
type BondReceiptLineRow = typeof bondReceiptLine.$inferSelect;
type BondReleaseRow = typeof bondRelease.$inferSelect;
type BondReleaseLineRow = typeof bondReleaseLine.$inferSelect;

function fail(msg: string): never {
  throw new Error(msg);
}

// Load the bond receipt (RLS-scoped — confirms tenant ownership).
async function loadReceipt(
  tx: TenantTransaction,
  bondReceiptId: string
): Promise<BondReceiptRow> {
  const receipt = (
    await tx
      .select()
      .from(bondReceipt)
      .where(eq(bondReceipt.id, bondReceiptId))
      .limit(1)
  ).at(0);
  if (!receipt) {
    fail("bond_release: bond receipt not found in this tenant");
  }
  return receipt;
}

// Validate the destination: it must exist in this tenant, belong to the same
// company as the receipt, and NOT be bonded (a release moves stock OUT of the
// bonded node into a sellable location — INV-3 separation). The 3-col composite
// FK on bond_release enforces tenant+company at the DB layer too; this is the
// clean error before the insert.
async function assertReleaseDestination(
  tx: TenantTransaction,
  destLocationId: string,
  companyId: string
): Promise<void> {
  const dest = (
    await tx
      .select({
        companyId: locationTable.companyId,
        isBonded: locationTable.isBonded,
      })
      .from(locationTable)
      .where(eq(locationTable.id, destLocationId))
      .limit(1)
  ).at(0);
  if (!dest) {
    fail("bond_release: destination location not found in this tenant");
  }
  if (dest.companyId !== companyId) {
    fail(
      "bond_release: destination location does not belong to the receipt's company (cross-company release rejected)"
    );
  }
  if (dest.isBonded) {
    fail(
      "bond_release: destination must be a non-bonded (sellable) location — cannot release into another bonded location"
    );
  }
}

// Load each referenced bond_receipt_line, confirm it belongs to the receipt,
// and enforce the F5 stamp (AVCO-only in Phase 3). Returns them aligned to the
// input lines by index.
//
// F5 stamp bypass (Codex F1): the stamp is only the GATE — `applyValuation`
// (called for the transfer legs and the duty value-only step) RE-RESOLVES the
// costing method from the LIVE product/category/tenant setting, NOT from the
// stamp. The #7 set-once trigger locks product/sku costing_method after
// movements, but a TENANT- or CATEGORY-level flip avco→fifo is NOT blocked. If
// that happened after receipt, the gate would pass on the 'avco' stamp while the
// valuation resolved 'fifo' — the duty `valuation_adjustment` would throw
// ("FIFO value-only not supported") or, worse with no duty, the transfer would
// issue from empty FIFO layers and move ZERO value (silent corruption). We close
// this by re-resolving the LIVE method with the SAME resolver `applyValuation`
// uses and rejecting any drift: gate and valuation are then provably consistent.
// (Consequence: a tenant costing flip blocks bonded release until reconciled —
// acceptable since bonded is AVCO-only in Phase 3; surfaced as a 🔒 decision.)
async function loadReceiptLines(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: ExecuteBondReleaseInput
): Promise<BondReceiptLineRow[]> {
  const receiptLines: BondReceiptLineRow[] = [];
  for (const lineInput of input.lines) {
    const rl = (
      await tx
        .select()
        .from(bondReceiptLine)
        .where(eq(bondReceiptLine.id, lineInput.bondReceiptLineId))
        .limit(1)
    ).at(0);
    if (!rl) {
      fail(
        `bond_release: bond_receipt_line ${lineInput.bondReceiptLineId} not found in this tenant`
      );
    }
    if (rl.bondReceiptId !== input.bondReceiptId) {
      fail(
        "bond_release: bond_receipt_line does not belong to the specified bond_receipt"
      );
    }
    if (rl.costingMethodApplied !== "avco") {
      fail(
        `bond_release: bond_receipt_line ${rl.id} has costingMethodApplied='${rl.costingMethodApplied}'; only 'avco' is supported in Phase 3 (F5 guard).`
      );
    }
    // F1: the stamp says avco — confirm the LIVE resolver still agrees, so the
    // downstream applyValuation calls cannot diverge from the gate.
    const liveMethod = await resolveCostingMethod(tx, ctx, {
      productId: rl.productId,
      skuId: rl.skuId,
    });
    if (liveMethod !== "avco") {
      fail(
        `bond_release: SKU ${rl.skuId} was received as 'avco' but now resolves to '${liveMethod}' under current costing; bonded stock is AVCO-only in Phase 3 — reconcile the tenant/category costing before releasing.`
      );
    }
    receiptLines.push(rl);
  }
  return receiptLines;
}

// Reject releasing more than is on hand at the bonded source. Requested qty is
// aggregated PER SKU (two lines on the same SKU must not each pass while their
// sum exceeds the bonded balance). The transfer engine records movements
// faithfully and would otherwise drive the bonded cell negative.
//
// Concurrency (recognized class — commit-3 HIGH-1): the on-hand read is a plain
// SUM with no lock, and the transfer issue that consumes the stock happens
// AFTER this check, so two concurrent releases of the same bonded cell would
// both pass and each issue, over-releasing dutiable bonded goods. We take the
// SAME per-cell transaction advisory lock that `appendStockMovement` uses
// (`${tenant}:${location}:${sku}`) BEFORE reading on-hand: the second caller
// blocks until the first commits, then re-reads the reduced balance and fails.
// The lock is held to commit (xact-scoped) and is re-entrant, so the later ship
// leg re-acquiring the same key is a no-op.
async function assertBondedQtyAvailable(
  tx: TenantTransaction,
  tenantId: string,
  sourceLocationId: string,
  input: ExecuteBondReleaseInput,
  receiptLines: BondReceiptLineRow[]
): Promise<void> {
  const requestedBySku = new Map<string, number>();
  for (let i = 0; i < input.lines.length; i++) {
    const lineInput = input.lines[i];
    const rl = receiptLines[i];
    if (!(lineInput && rl)) {
      continue;
    }
    requestedBySku.set(
      rl.skuId,
      (requestedBySku.get(rl.skuId) ?? 0) + lineInput.qty
    );
  }
  for (const [skuId, requested] of requestedBySku) {
    // Serialize concurrent releases of this bonded cell (same key shape as
    // appendStockMovement) BEFORE reading on-hand — closes the TOCTOU race.
    const lockKey = `${tenantId}:${sourceLocationId}:${skuId}`;
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
    );
    const available = await stockOnHandForSku(tx, sourceLocationId, skuId);
    if (requested > available) {
      fail(
        `bond_release: requested ${requested} of SKU ${skuId} exceeds bonded on-hand ${available} at the source location`
      );
    }
  }
}

// Per-line duty/tax cost-basis add via the AVCO value-only seam. qty_delta=0,
// value_delta = duty + tax. No-op when there is no duty/tax to add.
async function applyDutyAdjustment(
  tx: TenantTransaction,
  ctx: ServiceContext,
  args: {
    destLocationId: string;
    releaseId: string;
    receiptLine: BondReceiptLineRow;
    dutyMinor: number;
    taxMinor: number;
  }
): Promise<void> {
  const totalDutyTax = args.dutyMinor + args.taxMinor;
  if (totalDutyTax <= 0) {
    return;
  }
  const dutyMovement = await appendStockMovement(tx, ctx, {
    locationId: args.destLocationId,
    movementType: "valuation_adjustment",
    productId: args.receiptLine.productId,
    qtyDelta: 0,
    skuId: args.receiptLine.skuId,
    lotId: args.receiptLine.lotId ?? null,
    valueDeltaMinor: totalDutyTax,
    refType: "bond_release",
    refId: args.releaseId,
  });
  await applyValuation(tx, ctx, dutyMovement);
}

// Sum the conserved value the transfer moved, PER SKU. The transfer engine
// returns one TransferLineValue per transfer line; we only need the per-SKU
// total because the per-release-line split is recomputed deterministically
// below. A null value (product-level / no basis) contaminates the SKU's total
// to null (we can't attribute a value we don't have).
function totalConservedValueBySku(
  lineValues: TransferLineValue[]
): Map<string, number | null> {
  const totals = new Map<string, number | null>();
  for (const lv of lineValues) {
    if (lv.skuId == null) {
      continue;
    }
    const prev = totals.has(lv.skuId) ? totals.get(lv.skuId) : 0;
    if (prev == null || lv.valueMinor == null) {
      totals.set(lv.skuId, null);
    } else {
      totals.set(lv.skuId, prev + lv.valueMinor);
    }
  }
  return totals;
}

// Attribute each release line its share of its SKU's conserved value (Codex F3).
// The transfer's per-line value order is NOT reliable (loadTransfer has no
// ORDER BY and TransferLineValue carries no line identity), so two release lines
// on the same SKU could be mis-attributed. Instead we split the SKU's TOTAL
// conserved value across its release lines proportionally to qty, in INPUT
// order, via the largest-remainder method (floor of running cumulative share)
// so the per-SKU sum is EXACTLY conserved and the result is independent of DB
// row order. Single-line-per-SKU (the common case) yields exactly the total.
function allocateReleasedValues(
  input: ExecuteBondReleaseInput,
  receiptLines: BondReceiptLineRow[],
  lineValues: TransferLineValue[]
): (number | null)[] {
  const totalsBySku = totalConservedValueBySku(lineValues);
  const totalQtyBySku = new Map<string, number>();
  for (let i = 0; i < input.lines.length; i++) {
    const li = input.lines[i];
    const rl = receiptLines[i];
    if (!(li && rl)) {
      continue;
    }
    totalQtyBySku.set(rl.skuId, (totalQtyBySku.get(rl.skuId) ?? 0) + li.qty);
  }
  const cumQtyBySku = new Map<string, number>();
  const out: (number | null)[] = [];
  for (let i = 0; i < input.lines.length; i++) {
    const li = input.lines[i];
    const rl = receiptLines[i];
    if (!(li && rl)) {
      out.push(null);
      continue;
    }
    const total = totalsBySku.get(rl.skuId) ?? null;
    const totalQty = totalQtyBySku.get(rl.skuId) ?? 0;
    if (total == null || totalQty === 0) {
      out.push(total);
      continue;
    }
    const prevCum = cumQtyBySku.get(rl.skuId) ?? 0;
    const newCum = prevCum + li.qty;
    cumQtyBySku.set(rl.skuId, newCum);
    out.push(
      Math.floor((total * newCum) / totalQty) -
        Math.floor((total * prevCum) / totalQty)
    );
  }
  return out;
}

export async function executeBondRelease(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: ExecuteBondReleaseInput
): Promise<{
  release: BondReleaseRow;
  releaseLines: BondReleaseLineRow[];
  eventLines: BondReleaseEventLine[];
  transferId: string;
}> {
  if (input.lines.length === 0) {
    fail("bond_release: at least one line is required");
  }

  const receipt = await loadReceipt(tx, input.bondReceiptId);
  await assertReleaseDestination(tx, input.destLocationId, receipt.companyId);
  const receiptLines = await loadReceiptLines(tx, ctx, input);
  await assertBondedQtyAvailable(
    tx,
    ctx.tenantId,
    receipt.locationId,
    input,
    receiptLines
  );

  // Gapless per-tenant bond release number (advisory-locked, same pattern as
  // bond receipt / transfer numbering — deterministic, no device clock).
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`bondreleasenum:${ctx.tenantId}`}, 0))`
  );
  const seq =
    ((await tx.select({ c: count() }).from(bondRelease)).at(0)?.c ?? 0) + 1;

  // Create the pending bond_release row. companyId is derived from the receipt
  // so the source/dest 3-col composite FKs pin both endpoints to that company.
  const release = (
    await tx
      .insert(bondRelease)
      .values({
        tenantId: ctx.tenantId,
        companyId: receipt.companyId,
        number: `BRL-${seq}`,
        bondReceiptId: input.bondReceiptId,
        sourceLocationId: receipt.locationId,
        destLocationId: input.destLocationId,
        status: "pending",
        requestedBy: ctx.actorUserId ?? null,
        approvedBy: null,
        createdBy: ctx.actorUserId ?? null,
      })
      .returning()
  ).at(0);
  if (!release) {
    fail("bond_release: failed to create bond_release record");
  }

  // Step 1: the physical move — a transfer (bonded → released), value conserved.
  const transferLines = input.lines.map((lineInput, i) => {
    const rl = receiptLines[i];
    if (!rl) {
      return fail("bond_release: missing receipt line");
    }
    return {
      productId: rl.productId,
      skuId: rl.skuId,
      lotId: rl.lotId ?? null,
      qty: lineInput.qty,
    };
  });
  const { transfer } = await createTransfer(tx, ctx, {
    sourceLocationId: receipt.locationId,
    destLocationId: input.destLocationId,
    lines: transferLines,
  });
  await shipTransfer(tx, ctx, transfer.id);
  const received = await receiveTransfer(tx, ctx, transfer.id);
  // Per-release-line conserved value, attributed deterministically (input order,
  // proportional-by-qty per SKU) — independent of transfer-line row order (F3).
  const releasedValues = allocateReleasedValues(
    input,
    receiptLines,
    received.lineValues
  );

  const updatedRelease = (
    await tx
      .update(bondRelease)
      .set({ transferId: transfer.id, status: "released" })
      .where(eq(bondRelease.id, release.id))
      .returning()
  ).at(0);
  if (!updatedRelease) {
    fail("bond_release: failed to update release status");
  }

  // Step 2: per line — record the release line + the duty/tax value-only add.
  const releaseLines: BondReleaseLineRow[] = [];
  const eventLines: BondReleaseEventLine[] = [];
  for (let i = 0; i < input.lines.length; i++) {
    const lineInput = input.lines[i];
    const rl = receiptLines[i];
    if (!(lineInput && rl)) {
      continue;
    }
    const dutyMinor = lineInput.dutyMinor ?? 0;
    const taxMinor = lineInput.taxMinor ?? 0;
    const relLine = (
      await tx
        .insert(bondReleaseLine)
        .values({
          tenantId: ctx.tenantId,
          bondReleaseId: release.id,
          bondReceiptLineId: lineInput.bondReceiptLineId,
          qty: lineInput.qty,
          dutyMinor,
          taxMinor,
          costingMethodApplied: rl.costingMethodApplied,
        })
        .returning()
    ).at(0);
    if (!relLine) {
      fail("bond_release: failed to insert bond_release_line");
    }
    releaseLines.push(relLine);
    // Conserved value moved for this line (deterministic per-SKU allocation).
    const releasedValueMinor = releasedValues[i] ?? null;
    eventLines.push({
      bondReceiptLineId: lineInput.bondReceiptLineId,
      skuId: rl.skuId,
      qtyBase: lineInput.qty,
      dutyMinor,
      taxMinor,
      currency: rl.costCurrency,
      scale: rl.costScale,
      releasedValueMinor,
    });
    await applyDutyAdjustment(tx, ctx, {
      destLocationId: input.destLocationId,
      releaseId: release.id,
      receiptLine: rl,
      dutyMinor,
      taxMinor,
    });
  }

  return {
    release: updatedRelease,
    releaseLines,
    eventLines,
    transferId: transfer.id,
  };
}
