import { sql } from "drizzle-orm";
import type { TenantTransaction } from "../tenant";
import { applyValuation } from "./costing";
import { appendStockMovement, stockOnHandForSku } from "./stock-ledger";
import type { ServiceContext } from "./types";

export type OversellPolicy = "allow_with_flag" | "hard_block";

export interface ConvertUomInput {
  categoryId?: string | null;
  fromUomId: string;
  productId?: string | null;
  qty: number;
  role: "purchase" | "stock" | "sale" | "reporting";
  skuId?: string | null;
  toUomId: string;
}

export interface FefoAllocation {
  allocatedQty: number;
  expiryDate: string | null;
  lotId: string;
  lotNumber: string;
}

export interface OversellDecision {
  allowed: boolean;
  discrepancyQty: number;
  policy: OversellPolicy;
}

export interface ReorderSuggestion {
  isBelowMin: boolean;
  maxQty: number;
  minQty: number;
  onHand: number;
  suggestedQty: number;
}

export interface StockCountPostingAdjustment {
  countedQty: number;
  ledgerId: string | null;
  lotId: string | null;
  skuId: string;
  systemQty: number;
  valuationMinor: number;
  varianceQty: number;
}

export interface StockCountPostingResult {
  adjustments: StockCountPostingAdjustment[];
  postedAt: Date;
  stockCountId: string;
}

interface ConversionRow {
  factor: number;
  factor_scale: number;
}

interface FefoLotRow {
  available_qty: number | string;
  expiry_date: string | null;
  lot_id: string;
  lot_number: string;
}

interface ReorderRuleRow {
  max_qty: number | string;
  min_qty: number | string;
}

interface StockCountHeaderRow {
  id: string;
  location_id: string;
  status: string;
}

interface StockCountLineRow {
  counted_qty: number | string;
  currency: string | null;
  id: string;
  lot_id: string | null;
  scale: number | null;
  sku_id: string;
  variance_value_minor: number | string | null;
}

function asNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

export async function convertUom(
  tx: TenantTransaction,
  input: ConvertUomInput
): Promise<number> {
  const rows = await tx.execute(sql`
    SELECT factor, factor_scale
    FROM uom_conversion
    WHERE is_active = true
      AND deleted_at IS NULL
      AND role = ${input.role}
      AND from_uom_id = ${input.fromUomId}
      AND to_uom_id = ${input.toUomId}
      AND (
        sku_id = ${input.skuId ?? null}
        OR product_id = ${input.productId ?? null}
        OR category_id = ${input.categoryId ?? null}
        OR (sku_id IS NULL AND product_id IS NULL AND category_id IS NULL)
      )
    ORDER BY
      CASE
        WHEN sku_id = ${input.skuId ?? null} THEN 0
        WHEN product_id = ${input.productId ?? null} THEN 1
        WHEN category_id = ${input.categoryId ?? null} THEN 2
        ELSE 3
      END
    LIMIT 1
  `);
  const row = rows.rows.at(0) as ConversionRow | undefined;
  if (!row) {
    throw new Error("uom: conversion not found");
  }
  const numerator = input.qty * asNumber(row.factor);
  const denominator = 10 ** asNumber(row.factor_scale);
  if (!Number.isInteger(numerator) || numerator % denominator !== 0) {
    throw new Error("uom: non-exact discrete conversion rejected");
  }
  return numerator / denominator;
}

export async function allocateFefoLots(
  tx: TenantTransaction,
  input: { locationId: string; qty: number; skuId: string }
): Promise<{ allocations: FefoAllocation[]; unallocatedQty: number }> {
  let remaining = input.qty;
  const allocations: FefoAllocation[] = [];
  const rows = await tx.execute(sql`
    SELECT
      l.id AS lot_id,
      l.lot_number,
      l.expiry_date,
      COALESCE(SUM(sl.qty_delta), 0)::bigint AS available_qty
    FROM lot l
    JOIN stock_ledger sl ON sl.lot_id = l.id
    WHERE sl.location_id = ${input.locationId}
      AND sl.sku_id = ${input.skuId}
      AND l.status = 'available'
      AND l.deleted_at IS NULL
    GROUP BY l.id, l.lot_number, l.expiry_date
    HAVING COALESCE(SUM(sl.qty_delta), 0) > 0
    ORDER BY l.expiry_date NULLS LAST, l.created_at, l.id
  `);
  for (const row of rows.rows as unknown as FefoLotRow[]) {
    if (remaining <= 0) {
      break;
    }
    const availableQty = asNumber(row.available_qty);
    const allocatedQty = Math.min(remaining, availableQty);
    remaining -= allocatedQty;
    allocations.push({
      allocatedQty,
      expiryDate: row.expiry_date,
      lotId: row.lot_id,
      lotNumber: row.lot_number,
    });
  }
  return { allocations, unallocatedQty: remaining };
}

export function decideOversell(input: {
  onHand: number;
  policy: OversellPolicy;
  requestedQty: number;
}): OversellDecision {
  const discrepancyQty = Math.max(0, input.requestedQty - input.onHand);
  return {
    allowed: input.policy === "allow_with_flag" || discrepancyQty === 0,
    discrepancyQty,
    policy: input.policy,
  };
}

export async function evaluateReorder(
  tx: TenantTransaction,
  input: { locationId: string; onHand?: number; skuId: string }
): Promise<ReorderSuggestion | null> {
  const rows = await tx.execute(sql`
    SELECT min_qty, max_qty
    FROM reorder_rule
    WHERE sku_id = ${input.skuId}
      AND location_id = ${input.locationId}
      AND is_active = true
      AND deleted_at IS NULL
    LIMIT 1
  `);
  const row = rows.rows.at(0) as ReorderRuleRow | undefined;
  if (!row) {
    return null;
  }
  const minQty = asNumber(row.min_qty);
  const maxQty = asNumber(row.max_qty);
  const onHand =
    input.onHand ??
    (await stockOnHandForSku(tx, input.locationId, input.skuId));
  const isBelowMin = onHand < minQty;
  return {
    isBelowMin,
    maxQty,
    minQty,
    onHand,
    suggestedQty: isBelowMin ? Math.max(0, maxQty - onHand) : 0,
  };
}

export async function postStockCount(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: { stockCountId: string }
): Promise<StockCountPostingResult> {
  const headerRows = await tx.execute(sql`
    SELECT id, location_id, status
    FROM stock_count
    WHERE id = ${input.stockCountId}
      AND deleted_at IS NULL
    FOR UPDATE
  `);
  const header = headerRows.rows.at(0) as StockCountHeaderRow | undefined;
  if (!header) {
    throw new Error("stock-count: not found");
  }
  if (header.status === "posted") {
    throw new Error("stock-count: already posted");
  }
  if (header.status === "void") {
    throw new Error("stock-count: void count cannot be posted");
  }

  const lineRows = await tx.execute(sql`
    SELECT id, sku_id, lot_id, counted_qty, variance_value_minor, currency, scale
    FROM stock_count_line
    WHERE stock_count_id = ${input.stockCountId}
    ORDER BY created_at, id
    FOR UPDATE
  `);
  const adjustments: StockCountPostingAdjustment[] = [];
  for (const line of lineRows.rows as unknown as StockCountLineRow[]) {
    const countedQty = asNumber(line.counted_qty);
    const systemQty = line.lot_id
      ? await stockOnHandForSkuLot(
          tx,
          header.location_id,
          line.sku_id,
          line.lot_id
        )
      : await stockOnHandForSku(tx, header.location_id, line.sku_id);
    const varianceQty = countedQty - systemQty;
    let ledgerId: string | null = null;
    let valuationMinor = 0;
    if (varianceQty !== 0) {
      const positiveCost = positiveAdjustmentCost(line, varianceQty);
      const movement = await appendStockMovement(tx, ctx, {
        costCurrency: positiveCost?.currency ?? null,
        costScale: positiveCost?.scale ?? null,
        idempotencyKey: `stock-count:${input.stockCountId}:${line.id}`,
        locationId: header.location_id,
        lotId: line.lot_id,
        movementType: "adjustment",
        productId: await productIdForSku(tx, line.sku_id),
        qtyDelta: varianceQty,
        refId: input.stockCountId,
        refType: "stock_count",
        skuId: line.sku_id,
        unitCostMinor: positiveCost?.unitCostMinor ?? null,
      });
      ledgerId = movement.id;
      const valuation = await applyValuation(tx, ctx, movement);
      valuationMinor =
        varianceQty > 0
          ? (positiveCost?.unitCostMinor ?? 0) * varianceQty
          : -valuation.cogsMinor;
    }
    await tx.execute(sql`
      UPDATE stock_count_line
      SET system_qty = ${systemQty},
          variance_qty = ${varianceQty},
          variance_value_minor = ${valuationMinor},
          currency = COALESCE(currency, 'USD'),
          scale = COALESCE(scale, 2),
          updated_at = now()
      WHERE id = ${line.id}
    `);
    adjustments.push({
      countedQty,
      ledgerId,
      lotId: line.lot_id,
      skuId: line.sku_id,
      systemQty,
      valuationMinor,
      varianceQty,
    });
  }

  const postedAt = new Date();
  await tx.execute(sql`
    UPDATE stock_count
    SET status = 'posted',
        posted_at = ${postedAt},
        posted_by = ${ctx.actorUserId ?? null},
        updated_at = now()
    WHERE id = ${input.stockCountId}
  `);

  return { adjustments, postedAt, stockCountId: input.stockCountId };
}

async function productIdForSku(
  tx: TenantTransaction,
  skuId: string
): Promise<string> {
  const rows = await tx.execute(sql`
    SELECT product_id
    FROM sku
    WHERE id = ${skuId}
    LIMIT 1
  `);
  const productId = (rows.rows.at(0) as { product_id?: string } | undefined)
    ?.product_id;
  if (!productId) {
    throw new Error("stock-count: SKU not found");
  }
  return productId;
}

function positiveAdjustmentCost(
  line: StockCountLineRow,
  varianceQty: number
): { currency: string; scale: number; unitCostMinor: number } | null {
  if (varianceQty <= 0) {
    return null;
  }
  if (
    line.variance_value_minor == null ||
    line.currency == null ||
    line.scale == null
  ) {
    throw new Error("stock-count: positive variance requires a value triplet");
  }
  const valueMinor = asNumber(line.variance_value_minor);
  if (valueMinor < 0 || valueMinor % varianceQty !== 0) {
    throw new Error("stock-count: positive variance value must divide exactly");
  }
  return {
    currency: line.currency,
    scale: line.scale,
    unitCostMinor: valueMinor / varianceQty,
  };
}

async function stockOnHandForSkuLot(
  tx: TenantTransaction,
  locationId: string,
  skuId: string,
  lotId: string
): Promise<number> {
  const result = await tx.execute(sql`
    SELECT COALESCE(SUM(qty_delta), 0)::bigint AS balance
    FROM stock_ledger
    WHERE location_id = ${locationId}
      AND sku_id = ${skuId}
      AND lot_id = ${lotId}
  `);
  return asNumber(
    (result.rows.at(0) as { balance?: number | string } | undefined)?.balance ??
      0
  );
}
