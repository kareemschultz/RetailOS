import { and, eq, sql } from "drizzle-orm";
import { stockLedger } from "../schema";
import type { TenantTransaction } from "../tenant";
import type { ServiceContext } from "./types";

export type StockMovementType =
  | "adjustment"
  | "receipt"
  | "sale"
  // §2 value-only valuation adjustment (qty_delta = 0, value moves).
  | "valuation_adjustment"
  // §4 return movement (may link a source movement + original cost).
  | "return";

export interface StockMovementInput {
  costCurrency?: string | null;
  // Write-time stamp of the resolved financial strategy (seam #2): immutable
  // record of which costing method this movement was valued under.
  costingMethodApplied?: "avco" | "fifo" | null;
  costScale?: number | null;
  idempotencyKey?: string | null;
  locationId: string;
  lotId?: string | null;
  movementType: StockMovementType;
  // §4 returns-at-original-cost seam.
  originalUnitCostMinor?: number | null;
  productId: string;
  qtyDelta: number;
  // §3 quantity-representation seam (NULL ⇒ scale 0 / integer units).
  qtyScale?: number | null;
  refId?: string | null;
  refType?: string | null;
  serialId?: string | null;
  skuId?: string | null;
  sourceMovementId?: string | null;
  unitCostMinor?: number | null;
  // §2 value delta for value-only adjustments (minor units).
  valueDeltaMinor?: number | null;
}

// The ONLY way stock changes (charter §18/§33): append an immutable ledger row
// and record the running balance_after. Concurrent appends for the same
// (tenant, location, product) are serialized with a transaction-scoped advisory
// lock so balance_after is always correct. Whether the balance may go negative
// (oversell policy, §14) is NOT decided here — that is a per-tenant business
// rule applied by the caller; this service only records movements faithfully.
export async function appendStockMovement(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: StockMovementInput
) {
  // Serialize appends for this stock cell within the transaction.
  const stockCellId = input.skuId ?? input.productId;
  const lockKey = `${ctx.tenantId}:${input.locationId}:${stockCellId}`;
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
  );

  // RLS already scopes to the tenant; filter by the cell for the running sum.
  const balanceResult = input.skuId
    ? await tx.execute(sql`
        SELECT COALESCE(SUM(qty_delta), 0)::bigint AS balance
        FROM stock_ledger
        WHERE location_id = ${input.locationId} AND sku_id = ${input.skuId}
      `)
    : await tx.execute(sql`
        SELECT COALESCE(SUM(qty_delta), 0)::bigint AS balance
        FROM stock_ledger
        WHERE location_id = ${input.locationId} AND product_id = ${input.productId}
      `);
  const currentBalance = Number(
    (balanceResult.rows.at(0) as { balance?: number } | undefined)?.balance ?? 0
  );
  const balanceAfter = currentBalance + input.qtyDelta;

  const inserted = await tx
    .insert(stockLedger)
    .values({
      tenantId: ctx.tenantId,
      locationId: input.locationId,
      productId: input.productId,
      skuId: input.skuId ?? null,
      lotId: input.lotId ?? null,
      serialId: input.serialId ?? null,
      movementType: input.movementType,
      qtyDelta: input.qtyDelta,
      balanceAfter,
      qtyScale: input.qtyScale ?? null,
      unitCostMinor: input.unitCostMinor ?? null,
      costCurrency: input.costCurrency ?? null,
      costScale: input.costScale ?? null,
      valueDeltaMinor: input.valueDeltaMinor ?? null,
      costingMethodApplied: input.costingMethodApplied ?? null,
      sourceMovementId: input.sourceMovementId ?? null,
      originalUnitCostMinor: input.originalUnitCostMinor ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    })
    .returning();
  const row = inserted.at(0);
  if (!row) {
    throw new Error("appendStockMovement: failed to insert ledger row");
  }
  return row;
}

// Current on-hand for a stock cell, derived from the ledger (never a counter).
export async function stockOnHand(
  tx: TenantTransaction,
  locationId: string,
  productId: string
): Promise<number> {
  const result = await tx
    .select({
      balance: sql<number>`COALESCE(SUM(${stockLedger.qtyDelta}), 0)::bigint`,
    })
    .from(stockLedger)
    .where(
      and(
        eq(stockLedger.locationId, locationId),
        eq(stockLedger.productId, productId)
      )
    );
  return Number(result.at(0)?.balance ?? 0);
}

export async function stockOnHandForSku(
  tx: TenantTransaction,
  locationId: string,
  skuId: string
): Promise<number> {
  const result = await tx
    .select({
      balance: sql<number>`COALESCE(SUM(${stockLedger.qtyDelta}), 0)::bigint`,
    })
    .from(stockLedger)
    .where(
      and(eq(stockLedger.locationId, locationId), eq(stockLedger.skuId, skuId))
    );
  return Number(result.at(0)?.balance ?? 0);
}
