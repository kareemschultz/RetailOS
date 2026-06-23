import { count, eq, sql } from "drizzle-orm";
import { location, stockTransfer, stockTransferLine } from "../schema";
import type { TenantTransaction } from "../tenant";
import type { CostingMethod } from "./costing";
import { applyTransferInValuation, applyValuation } from "./costing";
import { appendStockMovement } from "./stock-ledger";
import type { ServiceContext } from "./types";

// Phase 3 — stock transfers. Two-step: ship (source → per-transfer in-transit
// node) then receive (node → destination), every leg through the sole ledger
// mutator `appendStockMovement`, so QUANTITY is conserved at each step and the
// ledger is never bypassed (the standing #8 write-path discipline).
//
// Commit 3 — VALUE conservation: each SKU-level leg also moves value. `moveLine`
// issues out of the source node (`applyValuation` → V, the exact integer value
// that left) and lands EXACTLY V at the destination node
// (`applyTransferInValuation`). So value flows source → in-transit → destination,
// conserved at every step. Product-level lines have no SKU×location costing cell
// (valuation requires a skuId) and move quantity only — exactly as
// `inventory.receive` valuates only when a skuId is present.

export interface TransferLineInput {
  lotId?: string | null;
  productId: string;
  qty: number;
  skuId?: string | null;
}

// Per-line value moved by a transfer leg (for value-conservation events).
// `valueMinor`/`currency`/`scale`/`method` are null for product-level (unvalued)
// lines and for SKU lines whose source had no valuation basis (nothing to move).
export interface TransferLineValue {
  currency: string | null;
  method: CostingMethod | null;
  productId: string;
  qtyBase: number;
  scale: number | null;
  skuId: string | null;
  valueMinor: number | null;
}

export interface TransferLegResult {
  lineValues: TransferLineValue[];
  transfer: TransferRow;
}

export interface CreateTransferInput {
  destLocationId: string;
  expectedReceiptDate?: string | null;
  lines: TransferLineInput[];
  sourceLocationId: string;
}

type TransferRow = typeof stockTransfer.$inferSelect;
type TransferLineRow = typeof stockTransferLine.$inferSelect;

function fail(message: string): never {
  throw new Error(message);
}

async function loadTransfer(
  tx: TenantTransaction,
  transferId: string
): Promise<{ transfer: TransferRow; lines: TransferLineRow[] }> {
  // FOR UPDATE locks the transfer row so concurrent ship/receive/cancel calls
  // SERIALIZE: a second caller blocks here until the first commits, then re-reads
  // the now-advanced status and fails its guard. Without this, two callers could
  // both pass a stale `status` check and append duplicate valued legs (a
  // pre-existing commit-2 race that commit 3 amplifies — it would now duplicate
  // VALUE, not just quantity, stranding stock+value in the in-transit node).
  const transfer = (
    await tx
      .select()
      .from(stockTransfer)
      .where(eq(stockTransfer.id, transferId))
      .limit(1)
      .for("update")
  ).at(0);
  if (!transfer) {
    fail("transfer: not found in this tenant");
  }
  const lines = await tx
    .select()
    .from(stockTransferLine)
    .where(eq(stockTransferLine.transferId, transferId));
  return { transfer, lines };
}

// Moves a line's qty OUT of one node and INTO another, conserving total quantity
// (−qty at `from`, +qty at `to`) AND, for SKU-level lines, total value: the
// exact integer V that leaves the source lands at the destination. Both legs go
// through appendStockMovement (qty) + the costing engine (value).
async function moveLine(
  tx: TenantTransaction,
  ctx: ServiceContext,
  opts: {
    line: TransferLineRow;
    fromLocationId: string;
    toLocationId: string;
    transferId: string;
  }
): Promise<TransferLineValue> {
  const base = {
    productId: opts.line.productId,
    skuId: opts.line.skuId,
    lotId: opts.line.lotId,
    refType: "stock_transfer" as const,
    refId: opts.transferId,
  };
  const outRow = await appendStockMovement(tx, ctx, {
    ...base,
    locationId: opts.fromLocationId,
    movementType: "transfer_out",
    qtyDelta: -opts.line.qty,
  });
  // Product-level lines have no SKU×location valuation cell — move quantity only.
  if (!opts.line.skuId) {
    await appendStockMovement(tx, ctx, {
      ...base,
      locationId: opts.toLocationId,
      movementType: "transfer_in",
      qtyDelta: opts.line.qty,
    });
    return {
      currency: null,
      method: null,
      productId: opts.line.productId,
      qtyBase: opts.line.qty,
      scale: null,
      skuId: null,
      valueMinor: null,
    };
  }
  // VALUE conservation, SKU-level: issue out of the source node (V = exact value
  // that left), then land EXACTLY V at the destination node.
  const out = await applyValuation(tx, ctx, outRow);
  const inRow = await appendStockMovement(tx, ctx, {
    ...base,
    locationId: opts.toLocationId,
    movementType: "transfer_in",
    qtyDelta: opts.line.qty,
  });
  // A null currency means the source had no valuation basis (e.g. transferring
  // stock that was never valued) — V is 0 and there is nothing to land.
  if (out.currency == null || out.scale == null) {
    return {
      currency: null,
      method: out.method,
      productId: opts.line.productId,
      qtyBase: opts.line.qty,
      scale: null,
      skuId: opts.line.skuId,
      valueMinor: out.cogsMinor,
    };
  }
  await applyTransferInValuation(tx, ctx, inRow, {
    currency: out.currency,
    method: out.method,
    remainderAnchorMovementId: outRow.id,
    scale: out.scale,
    valueMinor: out.cogsMinor,
  });
  return {
    currency: out.currency,
    method: out.method,
    productId: opts.line.productId,
    qtyBase: opts.line.qty,
    scale: out.scale,
    skuId: opts.line.skuId,
    valueMinor: out.cogsMinor,
  };
}

export async function createTransfer(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: CreateTransferInput
): Promise<{ transfer: TransferRow; lines: TransferLineRow[] }> {
  if (input.sourceLocationId === input.destLocationId) {
    fail("transfer: source and destination must differ");
  }
  if (input.lines.length === 0) {
    fail("transfer: at least one line is required");
  }
  // RLS-scoped reads — confirm both endpoints exist in this tenant and resolve
  // their companies. The DB composite FK also enforces intra-company, but a
  // friendly CONFLICT here beats a raw FK error.
  const endpoints = await tx
    .select({ id: location.id, companyId: location.companyId })
    .from(location)
    .where(
      sql`${location.id} IN (${input.sourceLocationId}, ${input.destLocationId})`
    );
  const source = endpoints.find((l) => l.id === input.sourceLocationId);
  const dest = endpoints.find((l) => l.id === input.destLocationId);
  if (!(source && dest)) {
    fail("transfer: source or destination location not found in this tenant");
  }
  if (source.companyId !== dest.companyId) {
    fail("transfer: inter-company transfers are not allowed (same company_id)");
  }

  // Gapless per-tenant transfer number (single-node allocator; advisory-locked).
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`transfernum:${ctx.tenantId}`}, 0))`
  );
  const seq =
    ((await tx.select({ c: count() }).from(stockTransfer)).at(0)?.c ?? 0) + 1;
  const number = `TRF-${seq}`;

  // Per-transfer in-transit virtual node (NOT shared) — same company as the
  // endpoints, non-sellable.
  const transitNode = (
    await tx
      .insert(location)
      .values({
        tenantId: ctx.tenantId,
        companyId: source.companyId,
        name: `In-Transit ${number}`,
        type: "in_transit",
        isTransit: true,
        isSellable: false,
        createdBy: ctx.actorUserId ?? null,
      })
      .returning()
  ).at(0);
  if (!transitNode) {
    fail("transfer: failed to create in-transit node");
  }

  const transfer = (
    await tx
      .insert(stockTransfer)
      .values({
        tenantId: ctx.tenantId,
        companyId: source.companyId,
        number,
        sourceLocationId: input.sourceLocationId,
        destLocationId: input.destLocationId,
        inTransitLocationId: transitNode.id,
        status: "draft",
        expectedReceiptDate: input.expectedReceiptDate ?? null,
        createdBy: ctx.actorUserId ?? null,
      })
      .returning()
  ).at(0);
  if (!transfer) {
    fail("transfer: failed to create transfer");
  }

  const lines = await tx
    .insert(stockTransferLine)
    .values(
      input.lines.map((l) => ({
        tenantId: ctx.tenantId,
        transferId: transfer.id,
        productId: l.productId,
        skuId: l.skuId ?? null,
        lotId: l.lotId ?? null,
        qty: l.qty,
        createdBy: ctx.actorUserId ?? null,
      }))
    )
    .returning();

  return { transfer, lines };
}

export async function shipTransfer(
  tx: TenantTransaction,
  ctx: ServiceContext,
  transferId: string
): Promise<TransferLegResult> {
  const { transfer, lines } = await loadTransfer(tx, transferId);
  if (transfer.status !== "draft") {
    fail(
      `transfer: only a draft transfer can be shipped (is '${transfer.status}')`
    );
  }
  const lineValues: TransferLineValue[] = [];
  for (const line of lines) {
    lineValues.push(
      await moveLine(tx, ctx, {
        line,
        fromLocationId: transfer.sourceLocationId,
        toLocationId: transfer.inTransitLocationId,
        transferId,
      })
    );
  }
  const updated = (
    await tx
      .update(stockTransfer)
      .set({ status: "shipped", shippedAt: new Date() })
      .where(eq(stockTransfer.id, transferId))
      .returning()
  ).at(0);
  return {
    lineValues,
    transfer: updated ?? fail("transfer: ship update failed"),
  };
}

export async function receiveTransfer(
  tx: TenantTransaction,
  ctx: ServiceContext,
  transferId: string
): Promise<TransferLegResult> {
  const { transfer, lines } = await loadTransfer(tx, transferId);
  if (transfer.status !== "shipped") {
    fail(
      `transfer: only a shipped transfer can be received (is '${transfer.status}')`
    );
  }
  // Receive moves exactly what is in the per-transfer in-transit node (the
  // shipped qty + its value) → destination. There is no received-qty parameter,
  // so you cannot receive MORE than shipped; partial/discrepancy receipt is a
  // deliberately deferred design (receives in full). Because the node holds
  // exactly the shipped value V, the issue out of it returns exactly V → the
  // destination receives exactly V (received value == released value).
  const lineValues: TransferLineValue[] = [];
  for (const line of lines) {
    lineValues.push(
      await moveLine(tx, ctx, {
        line,
        fromLocationId: transfer.inTransitLocationId,
        toLocationId: transfer.destLocationId,
        transferId,
      })
    );
  }
  const updated = (
    await tx
      .update(stockTransfer)
      .set({ status: "received", actualReceiptDate: new Date() })
      .where(eq(stockTransfer.id, transferId))
      .returning()
  ).at(0);
  return {
    lineValues,
    transfer: updated ?? fail("transfer: receive update failed"),
  };
}

export async function cancelTransfer(
  tx: TenantTransaction,
  ctx: ServiceContext,
  transferId: string
): Promise<TransferLegResult> {
  const { transfer, lines } = await loadTransfer(tx, transferId);
  if (transfer.status === "received") {
    fail("transfer: a received transfer cannot be cancelled");
  }
  if (transfer.status === "cancelled") {
    fail("transfer: transfer is already cancelled");
  }
  // If already shipped, return the in-transit stock (qty AND value) to source —
  // otherwise the value shipped into the per-transfer node would be orphaned
  // there (qty 0 but value != 0, breaking the qty==0 ⟺ value==0 invariant for
  // the node). A draft cancel has moved nothing, so there is no value to return.
  const lineValues: TransferLineValue[] = [];
  if (transfer.status === "shipped") {
    for (const line of lines) {
      lineValues.push(
        await moveLine(tx, ctx, {
          line,
          fromLocationId: transfer.inTransitLocationId,
          toLocationId: transfer.sourceLocationId,
          transferId,
        })
      );
    }
  }
  const updated = (
    await tx
      .update(stockTransfer)
      .set({ status: "cancelled" })
      .where(eq(stockTransfer.id, transferId))
      .returning()
  ).at(0);
  return {
    lineValues,
    transfer: updated ?? fail("transfer: cancel update failed"),
  };
}

// In-transit on-hand for a transfer's node (used by tests / read models to
// assert quantity conservation across the gap).
export async function transitBalance(
  tx: TenantTransaction,
  inTransitLocationId: string,
  productId: string
): Promise<number> {
  const rows = await tx.execute(sql`
    SELECT COALESCE(SUM(qty_delta), 0)::bigint AS bal
    FROM stock_ledger
    WHERE location_id = ${inTransitLocationId} AND product_id = ${productId}
  `);
  return Number((rows.rows.at(0) as { bal?: number } | undefined)?.bal ?? 0);
}
