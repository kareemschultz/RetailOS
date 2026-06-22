import { sql } from "drizzle-orm";
import type { TenantTransaction } from "../tenant";
import { stockOnHandForSku } from "./stock-ledger";

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
