import { sql } from "drizzle-orm";
import type { stockLedger } from "../schema";
import type { TenantTransaction } from "../tenant";
import type { ServiceContext } from "./types";

export type CostingMethod = "avco" | "fifo";

export interface CostingTarget {
  productId?: string;
  skuId?: string | null;
}

export interface ValuationResult {
  cogsMinor: number;
  currency: string | null;
  method: CostingMethod;
  scale: number | null;
  unvaluedQty: number;
}

type StockMovementRow = typeof stockLedger.$inferSelect;

interface AvcoRow {
  currency: string;
  qty_on_hand: number | string;
  scale: number;
  total_value_minor: number | string;
}

interface FifoLayerRow {
  currency: string;
  id: string;
  qty_remaining: number | string;
  scale: number;
  unit_cost_minor: number | string;
}

function asNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function requireSkuId(target: CostingTarget): string {
  if (!target.skuId) {
    throw new Error("costing: skuId is required for Phase-2 valuation");
  }
  return target.skuId;
}

function requireReceiptCost(movement: StockMovementRow) {
  if (
    movement.unitCostMinor == null ||
    movement.costCurrency == null ||
    movement.costScale == null
  ) {
    throw new Error("costing: receipt valuation requires a full cost triplet");
  }
  return {
    currency: movement.costCurrency,
    scale: movement.costScale,
    unitCostMinor: movement.unitCostMinor,
  };
}

export async function resolveCostingMethod(
  tx: TenantTransaction,
  ctx: ServiceContext,
  target: CostingTarget
): Promise<CostingMethod> {
  const rows = target.skuId
    ? await tx.execute(sql`
        SELECT
          p.costing_method AS product_method,
          c.costing_method AS category_method,
          o.costing_method AS tenant_method
        FROM sku s
        JOIN product p ON p.id = s.product_id
        LEFT JOIN category c ON c.id = p.category_id
        LEFT JOIN organization o ON o.id = ${ctx.tenantId}
        WHERE s.id = ${target.skuId}
        LIMIT 1
      `)
    : await tx.execute(sql`
        SELECT
          p.costing_method AS product_method,
          c.costing_method AS category_method,
          o.costing_method AS tenant_method
        FROM product p
        LEFT JOIN category c ON c.id = p.category_id
        LEFT JOIN organization o ON o.id = ${ctx.tenantId}
        WHERE p.id = ${target.productId}
        LIMIT 1
      `);
  const row = rows.rows.at(0) as
    | {
        category_method?: CostingMethod | null;
        product_method?: CostingMethod | null;
        tenant_method?: CostingMethod | null;
      }
    | undefined;
  if (!row) {
    throw new Error("costing: target product/SKU not found");
  }
  return (
    row.product_method ?? row.category_method ?? row.tenant_method ?? "avco"
  );
}

async function applyAvcoReceipt(
  tx: TenantTransaction,
  ctx: ServiceContext,
  movement: StockMovementRow,
  skuId: string
): Promise<ValuationResult> {
  const cost = requireReceiptCost(movement);
  const qty = movement.qtyDelta;
  const value = qty * cost.unitCostMinor;
  const existing = await tx.execute(sql`
    SELECT total_value_minor, qty_on_hand, currency, scale
    FROM avg_cost
    WHERE tenant_id = ${ctx.tenantId}
      AND sku_id = ${skuId}
      AND location_id = ${movement.locationId}
    FOR UPDATE
  `);
  const row = existing.rows.at(0) as AvcoRow | undefined;
  if (!row) {
    await tx.execute(sql`
      INSERT INTO avg_cost (
        tenant_id, sku_id, location_id, total_value_minor, qty_on_hand,
        currency, scale, updated_at
      )
      VALUES (
        ${ctx.tenantId}, ${skuId}, ${movement.locationId}, ${value}, ${qty},
        ${cost.currency}, ${cost.scale}, now()
      )
    `);
    return {
      cogsMinor: 0,
      currency: cost.currency,
      method: "avco",
      scale: cost.scale,
      unvaluedQty: 0,
    };
  }
  if (row.currency !== cost.currency || row.scale !== cost.scale) {
    throw new Error("costing: AVCO currency/scale mismatch");
  }
  await tx.execute(sql`
    UPDATE avg_cost
    SET total_value_minor = total_value_minor + ${value},
        qty_on_hand = qty_on_hand + ${qty},
        updated_at = now()
    WHERE tenant_id = ${ctx.tenantId}
      AND sku_id = ${skuId}
      AND location_id = ${movement.locationId}
  `);
  return {
    cogsMinor: 0,
    currency: cost.currency,
    method: "avco",
    scale: cost.scale,
    unvaluedQty: 0,
  };
}

async function applyAvcoIssue(
  tx: TenantTransaction,
  ctx: ServiceContext,
  movement: StockMovementRow,
  skuId: string
): Promise<ValuationResult> {
  const qtyIssued = Math.abs(movement.qtyDelta);
  const existing = await tx.execute(sql`
    SELECT total_value_minor, qty_on_hand, currency, scale
    FROM avg_cost
    WHERE tenant_id = ${ctx.tenantId}
      AND sku_id = ${skuId}
      AND location_id = ${movement.locationId}
    FOR UPDATE
  `);
  const row = existing.rows.at(0) as AvcoRow | undefined;
  if (!row) {
    return {
      cogsMinor: 0,
      currency: null,
      method: "avco",
      scale: null,
      unvaluedQty: qtyIssued,
    };
  }
  const qtyOnHand = asNumber(row.qty_on_hand);
  const totalValueMinor = asNumber(row.total_value_minor);
  const valuedQty = Math.max(0, Math.min(qtyIssued, qtyOnHand));
  const cogsMinor =
    valuedQty >= qtyOnHand
      ? totalValueMinor
      : Math.trunc((totalValueMinor * valuedQty) / qtyOnHand);
  const nextQty = qtyOnHand - qtyIssued;
  const nextValue = valuedQty >= qtyOnHand ? 0 : totalValueMinor - cogsMinor;
  await tx.execute(sql`
    UPDATE avg_cost
    SET total_value_minor = ${nextValue},
        qty_on_hand = ${nextQty},
        updated_at = now()
    WHERE tenant_id = ${ctx.tenantId}
      AND sku_id = ${skuId}
      AND location_id = ${movement.locationId}
  `);
  return {
    cogsMinor,
    currency: row.currency,
    method: "avco",
    scale: row.scale,
    unvaluedQty: qtyIssued - valuedQty,
  };
}

async function applyFifoReceipt(
  tx: TenantTransaction,
  ctx: ServiceContext,
  movement: StockMovementRow,
  skuId: string
): Promise<ValuationResult> {
  const cost = requireReceiptCost(movement);
  const seqResult = await tx.execute(sql`
    SELECT COALESCE(MAX(seq) + 1, 0)::integer AS next_seq
    FROM valuation_layer
    WHERE tenant_id = ${ctx.tenantId}
      AND sku_id = ${skuId}
      AND location_id = ${movement.locationId}
  `);
  const nextSeq = asNumber(
    (seqResult.rows.at(0) as { next_seq?: number | string } | undefined)
      ?.next_seq ?? 0
  );
  await tx.execute(sql`
    INSERT INTO valuation_layer (
      tenant_id, sku_id, location_id, received_at, seq, qty_remaining,
      unit_cost_minor, currency, scale, source_movement_id, created_at, updated_at
    )
    VALUES (
      ${ctx.tenantId}, ${skuId}, ${movement.locationId}, ${movement.serverTs},
      ${nextSeq}, ${movement.qtyDelta}, ${cost.unitCostMinor}, ${cost.currency},
      ${cost.scale}, ${movement.id}, now(), now()
    )
    ON CONFLICT (tenant_id, source_movement_id) DO NOTHING
  `);
  return {
    cogsMinor: 0,
    currency: cost.currency,
    method: "fifo",
    scale: cost.scale,
    unvaluedQty: 0,
  };
}

async function applyFifoIssue(
  tx: TenantTransaction,
  ctx: ServiceContext,
  movement: StockMovementRow,
  skuId: string
): Promise<ValuationResult> {
  let remaining = Math.abs(movement.qtyDelta);
  let cogsMinor = 0;
  let currency: string | null = null;
  let scale: number | null = null;
  const layers = await tx.execute(sql`
    SELECT id, qty_remaining, unit_cost_minor, currency, scale
    FROM valuation_layer
    WHERE tenant_id = ${ctx.tenantId}
      AND sku_id = ${skuId}
      AND location_id = ${movement.locationId}
      AND qty_remaining > 0
    ORDER BY received_at, seq, id
    FOR UPDATE
  `);
  for (const layer of layers.rows as unknown as FifoLayerRow[]) {
    if (remaining <= 0) {
      break;
    }
    if (currency && (currency !== layer.currency || scale !== layer.scale)) {
      throw new Error("costing: FIFO currency/scale mismatch");
    }
    currency = layer.currency;
    scale = layer.scale;
    const qtyRemaining = asNumber(layer.qty_remaining);
    const unitCostMinor = asNumber(layer.unit_cost_minor);
    const consumed = Math.min(remaining, qtyRemaining);
    remaining -= consumed;
    cogsMinor += consumed * unitCostMinor;
    await tx.execute(sql`
      UPDATE valuation_layer
      SET qty_remaining = qty_remaining - ${consumed},
          updated_at = now()
      WHERE id = ${layer.id}
        AND tenant_id = ${ctx.tenantId}
    `);
  }
  return {
    cogsMinor,
    currency,
    method: "fifo",
    scale,
    unvaluedQty: remaining,
  };
}

export async function applyValuation(
  tx: TenantTransaction,
  ctx: ServiceContext,
  movement: StockMovementRow
): Promise<ValuationResult> {
  const skuId = requireSkuId(movement);
  const method = await resolveCostingMethod(tx, ctx, {
    productId: movement.productId,
    skuId,
  });
  if (movement.qtyDelta === 0) {
    return {
      cogsMinor: 0,
      currency: null,
      method,
      scale: null,
      unvaluedQty: 0,
    };
  }
  if (method === "avco") {
    return movement.qtyDelta > 0
      ? applyAvcoReceipt(tx, ctx, movement, skuId)
      : applyAvcoIssue(tx, ctx, movement, skuId);
  }
  return movement.qtyDelta > 0
    ? applyFifoReceipt(tx, ctx, movement, skuId)
    : applyFifoIssue(tx, ctx, movement, skuId);
}
