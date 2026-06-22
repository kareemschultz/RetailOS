import { and, eq, sql } from "drizzle-orm";
import { stockLedger } from "../schema";
import type { TenantTransaction } from "../tenant";
import type { ServiceContext } from "./types";

export type StockMovementType = "receipt" | "sale";

export interface StockMovementInput {
  idempotencyKey?: string | null;
  locationId: string;
  movementType: StockMovementType;
  productId: string;
  qtyDelta: number;
  refId?: string | null;
  refType?: string | null;
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
  const lockKey = `${ctx.tenantId}:${input.locationId}:${input.productId}`;
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
  );

  // RLS already scopes to the tenant; filter by the cell for the running sum.
  const balanceResult = await tx.execute(sql`
    SELECT COALESCE(SUM(qty_delta), 0)::int AS balance
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
      movementType: input.movementType,
      qtyDelta: input.qtyDelta,
      balanceAfter,
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
      balance: sql<number>`COALESCE(SUM(${stockLedger.qtyDelta}), 0)::int`,
    })
    .from(stockLedger)
    .where(
      and(
        eq(stockLedger.locationId, locationId),
        eq(stockLedger.productId, productId)
      )
    );
  return result.at(0)?.balance ?? 0;
}
