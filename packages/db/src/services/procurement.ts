import { and, eq, sql } from "drizzle-orm";
import {
  company,
  goodsReceipt,
  goodsReceiptLine,
  landedCostAllocation,
  landedCostPool,
  location as locationTable,
  product,
  purchaseOrder,
  purchaseOrderLine,
  sku,
  supplier,
  supplierBill,
  supplierBillLine,
} from "../schema";
import type { TenantTransaction } from "../tenant";
import { recordAudit } from "./audit";
import { applyValuation, resolveCostingMethod } from "./costing";
import { DomainEventType, emitEvent } from "./outbox";
import { appendStockMovement } from "./stock-ledger";
import type { ServiceContext } from "./types";

export class ProcurementError extends Error {
  readonly code: "NOT_FOUND" | "INVALID_STATE";

  constructor(message: string, code: "NOT_FOUND" | "INVALID_STATE") {
    super(message);
    this.code = code;
    this.name = "ProcurementError";
  }
}

export interface CreateSupplierInput {
  code: string;
  email?: string | null;
  name: string;
  phone?: string | null;
  taxIdentificationNumber?: string | null;
}

export async function createSupplier(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: CreateSupplierInput
) {
  const row = (
    await tx
      .insert(supplier)
      .values({
        tenantId: ctx.tenantId,
        code: input.code,
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        taxIdentificationNumber: input.taxIdentificationNumber ?? null,
        createdBy: ctx.actorUserId ?? null,
      })
      .returning()
  ).at(0);
  if (!row) {
    throw new Error("createSupplier: insert failed");
  }
  await recordAudit(tx, ctx, {
    action: "procurement.supplier.create",
    entityType: "supplier",
    entityId: row.id,
    after: row,
  });
  return row;
}

export interface CreatePurchaseOrderLineInput {
  currency?: string;
  description?: string | null;
  productId: string;
  qtyOrdered: number;
  scale?: number;
  skuId: string;
  unitCostMinor: number;
}

export interface CreatePurchaseOrderInput {
  companyId: string;
  currency: string;
  lines: CreatePurchaseOrderLineInput[];
  notes?: string | null;
  number: string;
  scale?: number;
  supplierId: string;
}

async function assertVisibleRefs(
  tx: TenantTransaction,
  input: CreatePurchaseOrderInput
) {
  const companyRow = (
    await tx
      .select({ id: company.id })
      .from(company)
      .where(eq(company.id, input.companyId))
      .limit(1)
  ).at(0);
  if (!companyRow) {
    throw new ProcurementError("Company not found", "NOT_FOUND");
  }
  const supplierRow = (
    await tx
      .select({ id: supplier.id })
      .from(supplier)
      .where(eq(supplier.id, input.supplierId))
      .limit(1)
  ).at(0);
  if (!supplierRow) {
    throw new ProcurementError("Supplier not found", "NOT_FOUND");
  }
  for (const line of input.lines) {
    const productRow = (
      await tx
        .select({ id: product.id })
        .from(product)
        .where(eq(product.id, line.productId))
        .limit(1)
    ).at(0);
    if (!productRow) {
      throw new ProcurementError("Product not found", "NOT_FOUND");
    }
    const skuRow = (
      await tx
        .select({ id: sku.id })
        .from(sku)
        .where(and(eq(sku.id, line.skuId), eq(sku.productId, line.productId)))
        .limit(1)
    ).at(0);
    if (!skuRow) {
      throw new ProcurementError("SKU not found for product", "NOT_FOUND");
    }
  }
}

export async function createPurchaseOrder(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: CreatePurchaseOrderInput
) {
  await assertVisibleRefs(tx, input);
  const header = (
    await tx
      .insert(purchaseOrder)
      .values({
        tenantId: ctx.tenantId,
        companyId: input.companyId,
        supplierId: input.supplierId,
        number: input.number,
        currency: input.currency,
        scale: input.scale ?? 2,
        notes: input.notes ?? null,
        createdBy: ctx.actorUserId ?? null,
      })
      .returning()
  ).at(0);
  if (!header) {
    throw new Error("createPurchaseOrder: header insert failed");
  }
  const lines = await tx
    .insert(purchaseOrderLine)
    .values(
      input.lines.map((line) => ({
        tenantId: ctx.tenantId,
        purchaseOrderId: header.id,
        productId: line.productId,
        skuId: line.skuId,
        description: line.description ?? null,
        qtyOrdered: line.qtyOrdered,
        unitCostMinor: line.unitCostMinor,
        currency: line.currency ?? input.currency,
        scale: line.scale ?? input.scale ?? 2,
        createdBy: ctx.actorUserId ?? null,
      }))
    )
    .returning();
  await recordAudit(tx, ctx, {
    action: "procurement.purchase_order.create",
    entityType: "purchase_order",
    entityId: header.id,
    after: { ...header, lines },
  });
  return { ...header, lines };
}

export interface ReceivePurchaseOrderLineInput {
  purchaseOrderLineId: string;
  qtyReceived: number;
}

export interface ReceivePurchaseOrderInput {
  lines: ReceivePurchaseOrderLineInput[];
  locationId: string;
  notes?: string | null;
  number: string;
  purchaseOrderId: string;
  receivedAt?: Date | null;
}

type GoodsReceiptRow = typeof goodsReceipt.$inferSelect;
type GoodsReceiptLineRow = typeof goodsReceiptLine.$inferSelect;
type PurchaseOrderRow = typeof purchaseOrder.$inferSelect;
type PurchaseOrderLineRow = typeof purchaseOrderLine.$inferSelect;

async function assertReceivingLocation(
  tx: TenantTransaction,
  companyId: string,
  locationId: string
): Promise<void> {
  const loc = (
    await tx
      .select({ id: locationTable.id, companyId: locationTable.companyId })
      .from(locationTable)
      .where(eq(locationTable.id, locationId))
      .limit(1)
  ).at(0);
  if (!loc) {
    throw new ProcurementError("Receiving location not found", "NOT_FOUND");
  }
  if (loc.companyId !== companyId) {
    throw new ProcurementError(
      "Receiving location does not belong to the purchase order company",
      "NOT_FOUND"
    );
  }
}

function assertReceiptablePurchaseOrder(status: string): void {
  if (status === "cancelled") {
    throw new ProcurementError(
      "Cancelled purchase order cannot be received",
      "INVALID_STATE"
    );
  }
  if (status === "received") {
    throw new ProcurementError(
      "Purchase order is already fully received",
      "INVALID_STATE"
    );
  }
}

export interface CreateSupplierBillLineInput {
  goodsReceiptLineId: string;
  qtyBilled: number;
}

export interface CreateSupplierBillInput {
  billDate?: Date | null;
  dueDate?: Date | null;
  lines: CreateSupplierBillLineInput[];
  notes?: string | null;
  number: string;
  purchaseOrderId: string;
}

type SupplierBillRow = typeof supplierBill.$inferSelect;
type SupplierBillLineRow = typeof supplierBillLine.$inferSelect;

type BillableReceiptLine = GoodsReceiptLineRow & {
  companyId: string;
  purchaseOrderStatus: string;
  receiptStatus: string;
  supplierId: string;
};

async function loadBillableReceiptLine(
  tx: TenantTransaction,
  purchaseOrderId: string,
  goodsReceiptLineId: string
): Promise<BillableReceiptLine> {
  const row = (
    await tx
      .select({
        id: goodsReceiptLine.id,
        tenantId: goodsReceiptLine.tenantId,
        goodsReceiptId: goodsReceiptLine.goodsReceiptId,
        purchaseOrderId: goodsReceiptLine.purchaseOrderId,
        purchaseOrderLineId: goodsReceiptLine.purchaseOrderLineId,
        productId: goodsReceiptLine.productId,
        skuId: goodsReceiptLine.skuId,
        qtyReceived: goodsReceiptLine.qtyReceived,
        unitCostMinor: goodsReceiptLine.unitCostMinor,
        currency: goodsReceiptLine.currency,
        scale: goodsReceiptLine.scale,
        movementId: goodsReceiptLine.movementId,
        createdAt: goodsReceiptLine.createdAt,
        updatedAt: goodsReceiptLine.updatedAt,
        companyId: goodsReceipt.companyId,
        supplierId: goodsReceipt.supplierId,
        receiptStatus: goodsReceipt.status,
        purchaseOrderStatus: purchaseOrder.status,
      })
      .from(goodsReceiptLine)
      .innerJoin(
        goodsReceipt,
        and(
          eq(goodsReceipt.id, goodsReceiptLine.goodsReceiptId),
          eq(goodsReceipt.purchaseOrderId, purchaseOrderId)
        )
      )
      .innerJoin(
        purchaseOrder,
        eq(purchaseOrder.id, goodsReceiptLine.purchaseOrderId)
      )
      .where(
        and(
          eq(goodsReceiptLine.id, goodsReceiptLineId),
          eq(goodsReceiptLine.purchaseOrderId, purchaseOrderId)
        )
      )
      .limit(1)
  ).at(0);
  if (!row) {
    throw new ProcurementError("Goods receipt line not found", "NOT_FOUND");
  }
  if (row.receiptStatus !== "posted") {
    throw new ProcurementError(
      "Only posted goods receipt lines can be billed",
      "INVALID_STATE"
    );
  }
  if (row.purchaseOrderStatus === "cancelled") {
    throw new ProcurementError(
      "Cancelled purchase order cannot be billed",
      "INVALID_STATE"
    );
  }
  return row;
}

function assertBillableLineMatchesPo(
  receiptLine: BillableReceiptLine,
  po: PurchaseOrderRow
) {
  if (
    receiptLine.companyId !== po.companyId ||
    receiptLine.supplierId !== po.supplierId
  ) {
    throw new ProcurementError(
      "Goods receipt does not match purchase order header",
      "NOT_FOUND"
    );
  }
  if (receiptLine.currency !== po.currency || receiptLine.scale !== po.scale) {
    throw new ProcurementError(
      "Supplier bill lines must use the purchase order currency and scale",
      "INVALID_STATE"
    );
  }
}

async function priorBilledQty(
  tx: TenantTransaction,
  goodsReceiptLineId: string
): Promise<number> {
  return (
    await tx
      .select({ qtyBilled: supplierBillLine.qtyBilled })
      .from(supplierBillLine)
      .innerJoin(
        supplierBill,
        eq(supplierBill.id, supplierBillLine.supplierBillId)
      )
      .where(
        and(
          eq(supplierBillLine.goodsReceiptLineId, goodsReceiptLineId),
          eq(supplierBill.status, "posted")
        )
      )
  ).reduce((sum, row) => sum + row.qtyBilled, 0);
}

export async function createSupplierBill(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: CreateSupplierBillInput
): Promise<{ bill: SupplierBillRow; lines: SupplierBillLineRow[] }> {
  if (input.lines.length === 0) {
    throw new ProcurementError(
      "At least one supplier bill line is required",
      "INVALID_STATE"
    );
  }

  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`supplier-bill:${ctx.tenantId}:${input.purchaseOrderId}`}, 0))`
  );

  const po = (
    await tx
      .select()
      .from(purchaseOrder)
      .where(eq(purchaseOrder.id, input.purchaseOrderId))
      .limit(1)
  ).at(0);
  if (!po) {
    throw new ProcurementError("Purchase order not found", "NOT_FOUND");
  }
  if (po.status === "cancelled") {
    throw new ProcurementError(
      "Cancelled purchase order cannot be billed",
      "INVALID_STATE"
    );
  }

  const seenReceiptLineIds = new Set<string>();
  const billableLines: Array<BillableReceiptLine & { qtyBilled: number }> = [];
  let totalMinor = 0;

  for (const line of input.lines) {
    if (line.qtyBilled <= 0) {
      throw new ProcurementError(
        "Bill quantity must be positive",
        "INVALID_STATE"
      );
    }
    if (seenReceiptLineIds.has(line.goodsReceiptLineId)) {
      throw new ProcurementError(
        "Duplicate goods receipt line on supplier bill",
        "INVALID_STATE"
      );
    }
    seenReceiptLineIds.add(line.goodsReceiptLineId);

    const receiptLine = await loadBillableReceiptLine(
      tx,
      input.purchaseOrderId,
      line.goodsReceiptLineId
    );
    assertBillableLineMatchesPo(receiptLine, po);

    const alreadyBilled = await priorBilledQty(tx, receiptLine.id);
    if (alreadyBilled + line.qtyBilled > receiptLine.qtyReceived) {
      throw new ProcurementError(
        "Supplier bill quantity exceeds received quantity",
        "INVALID_STATE"
      );
    }

    totalMinor += line.qtyBilled * receiptLine.unitCostMinor;
    billableLines.push({ ...receiptLine, qtyBilled: line.qtyBilled });
  }

  const bill = (
    await tx
      .insert(supplierBill)
      .values({
        tenantId: ctx.tenantId,
        companyId: po.companyId,
        supplierId: po.supplierId,
        purchaseOrderId: po.id,
        number: input.number,
        billDate: input.billDate ?? new Date(),
        dueDate: input.dueDate ?? null,
        currency: po.currency,
        scale: po.scale,
        totalMinor,
        notes: input.notes ?? null,
        createdBy: ctx.actorUserId ?? null,
      })
      .returning()
  ).at(0);
  if (!bill) {
    throw new Error("createSupplierBill: header insert failed");
  }

  const lines = await tx
    .insert(supplierBillLine)
    .values(
      billableLines.map((line) => ({
        tenantId: ctx.tenantId,
        supplierBillId: bill.id,
        purchaseOrderId: po.id,
        purchaseOrderLineId: line.purchaseOrderLineId,
        goodsReceiptId: line.goodsReceiptId,
        goodsReceiptLineId: line.id,
        productId: line.productId,
        skuId: line.skuId,
        qtyBilled: line.qtyBilled,
        unitCostMinor: line.unitCostMinor,
        lineTotalMinor: line.qtyBilled * line.unitCostMinor,
        currency: line.currency,
        scale: line.scale,
      }))
    )
    .returning();

  await recordAudit(tx, ctx, {
    action: "procurement.supplier_bill.create",
    entityType: "supplier_bill",
    entityId: bill.id,
    after: { ...bill, lines },
  });
  await emitEvent(tx, ctx, {
    payload: {
      aggregateId: bill.id,
      aggregateType: "supplier_bill",
      companyId: bill.companyId,
      purchaseOrderId: bill.purchaseOrderId,
      supplierBillId: bill.id,
      supplierId: bill.supplierId,
      totalMinor: bill.totalMinor,
      currency: bill.currency,
      scale: bill.scale,
      lines,
    },
    type: "procurement.supplier_bill.created",
  });

  return { bill, lines };
}

export type LandedCostKind =
  | "freight"
  | "insurance"
  | "duty"
  | "tax"
  | "handling"
  | "other";
export type LandedCostAllocationBasis = "line_value" | "quantity";

export interface CreateLandedCostPoolInput {
  amountMinor: number;
  basis: LandedCostAllocationBasis;
  kind: LandedCostKind;
}

export interface CreateLandedCostPoolsInput {
  pools: CreateLandedCostPoolInput[];
  supplierBillId: string;
}

type LandedCostPoolRow = typeof landedCostPool.$inferSelect;
type LandedCostAllocationRow = typeof landedCostAllocation.$inferSelect;

type LandedCostBillLine = SupplierBillLineRow & {
  companyId: string;
  locationId: string;
  supplierBillStatus: string;
};

interface AllocationDraft {
  amountMinor: number;
  basisLineValueMinor: number;
  basisQuantity: number;
  line: LandedCostBillLine;
}

function largestRemainderAllocations(
  amountMinor: number,
  basisRows: Array<{ basis: number; line: LandedCostBillLine }>
): AllocationDraft[] {
  const totalBasis = basisRows.reduce((sum, row) => sum + row.basis, 0);
  if (totalBasis <= 0) {
    throw new ProcurementError(
      "Landed cost allocation basis must be positive",
      "INVALID_STATE"
    );
  }
  const drafts = basisRows.map((row, index) => {
    const numerator = amountMinor * row.basis;
    return {
      amountMinor: Math.trunc(numerator / totalBasis),
      basisLineValueMinor: row.line.lineTotalMinor,
      basisQuantity: row.line.qtyBilled,
      index,
      line: row.line,
      remainder: numerator % totalBasis,
    };
  });
  let remainderMinor =
    amountMinor - drafts.reduce((sum, draft) => sum + draft.amountMinor, 0);
  const ranked = [...drafts].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index
  );
  for (const draft of ranked) {
    if (remainderMinor <= 0) {
      break;
    }
    draft.amountMinor += 1;
    remainderMinor -= 1;
  }
  return drafts
    .sort((a, b) => a.index - b.index)
    .map(({ index: _index, remainder: _remainder, ...draft }) => draft);
}

async function loadLandedCostBill(
  tx: TenantTransaction,
  supplierBillId: string
): Promise<{ bill: SupplierBillRow; lines: LandedCostBillLine[] }> {
  const bill = (
    await tx
      .select()
      .from(supplierBill)
      .where(eq(supplierBill.id, supplierBillId))
      .limit(1)
  ).at(0);
  if (!bill) {
    throw new ProcurementError("Supplier bill not found", "NOT_FOUND");
  }
  if (bill.status !== "posted") {
    throw new ProcurementError(
      "Only posted supplier bills can receive landed cost pools",
      "INVALID_STATE"
    );
  }
  const lines = await tx
    .select({
      id: supplierBillLine.id,
      tenantId: supplierBillLine.tenantId,
      supplierBillId: supplierBillLine.supplierBillId,
      purchaseOrderId: supplierBillLine.purchaseOrderId,
      purchaseOrderLineId: supplierBillLine.purchaseOrderLineId,
      goodsReceiptId: supplierBillLine.goodsReceiptId,
      goodsReceiptLineId: supplierBillLine.goodsReceiptLineId,
      productId: supplierBillLine.productId,
      skuId: supplierBillLine.skuId,
      qtyBilled: supplierBillLine.qtyBilled,
      unitCostMinor: supplierBillLine.unitCostMinor,
      lineTotalMinor: supplierBillLine.lineTotalMinor,
      currency: supplierBillLine.currency,
      scale: supplierBillLine.scale,
      createdAt: supplierBillLine.createdAt,
      updatedAt: supplierBillLine.updatedAt,
      companyId: goodsReceipt.companyId,
      locationId: goodsReceipt.locationId,
      supplierBillStatus: supplierBill.status,
    })
    .from(supplierBillLine)
    .innerJoin(
      goodsReceipt,
      and(
        eq(goodsReceipt.id, supplierBillLine.goodsReceiptId),
        eq(goodsReceipt.purchaseOrderId, supplierBillLine.purchaseOrderId)
      )
    )
    .innerJoin(
      supplierBill,
      eq(supplierBill.id, supplierBillLine.supplierBillId)
    )
    .where(eq(supplierBillLine.supplierBillId, supplierBillId));
  if (lines.length === 0) {
    throw new ProcurementError(
      "Supplier bill has no allocatable lines",
      "INVALID_STATE"
    );
  }
  for (const line of lines) {
    if (
      line.currency !== bill.currency ||
      line.scale !== bill.scale ||
      line.companyId !== bill.companyId
    ) {
      throw new ProcurementError(
        "Supplier bill line graph does not match the supplier bill header",
        "NOT_FOUND"
      );
    }
  }
  return { bill, lines };
}

async function assertLandedCostAvcoOnly(
  tx: TenantTransaction,
  ctx: ServiceContext,
  lines: LandedCostBillLine[]
) {
  for (const line of lines) {
    const method = await resolveCostingMethod(tx, ctx, {
      productId: line.productId,
      skuId: line.skuId,
    });
    if (method !== "avco") {
      throw new ProcurementError(
        "Only AVCO landed cost value-only adjustments are supported in this slice",
        "INVALID_STATE"
      );
    }
  }
}

async function insertLandedCostPool(
  tx: TenantTransaction,
  ctx: ServiceContext,
  bill: SupplierBillRow,
  poolInput: CreateLandedCostPoolInput
): Promise<LandedCostPoolRow> {
  if (poolInput.amountMinor <= 0) {
    throw new ProcurementError(
      "Landed cost pool amount must be positive",
      "INVALID_STATE"
    );
  }
  const pool = (
    await tx
      .insert(landedCostPool)
      .values({
        tenantId: ctx.tenantId,
        supplierBillId: bill.id,
        companyId: bill.companyId,
        kind: poolInput.kind,
        basis: poolInput.basis,
        amountMinor: poolInput.amountMinor,
        currency: bill.currency,
        scale: bill.scale,
        createdBy: ctx.actorUserId ?? null,
      })
      .returning()
  ).at(0);
  if (!pool) {
    throw new Error("createLandedCostPools: pool insert failed");
  }
  return pool;
}

function allocationBasisRows(
  poolInput: CreateLandedCostPoolInput,
  lines: LandedCostBillLine[]
) {
  return lines.map((line) => ({
    basis:
      poolInput.basis === "line_value" ? line.lineTotalMinor : line.qtyBilled,
    line,
  }));
}

async function createLandedCostAllocation(
  tx: TenantTransaction,
  ctx: ServiceContext,
  bill: SupplierBillRow,
  pool: LandedCostPoolRow,
  draft: AllocationDraft
): Promise<LandedCostAllocationRow> {
  const movement = await appendStockMovement(tx, ctx, {
    costCurrency: bill.currency,
    costScale: bill.scale,
    locationId: draft.line.locationId,
    movementType: "valuation_adjustment",
    productId: draft.line.productId,
    qtyDelta: 0,
    refId: pool.id,
    refType: "landed_cost_pool",
    skuId: draft.line.skuId,
    unitCostMinor: 0,
    valueDeltaMinor: draft.amountMinor,
  });
  try {
    await applyValuation(tx, ctx, movement);
  } catch (error) {
    throw new ProcurementError(
      error instanceof Error ? error.message : "Landed cost valuation failed",
      "INVALID_STATE"
    );
  }
  const allocation = (
    await tx
      .insert(landedCostAllocation)
      .values({
        tenantId: ctx.tenantId,
        landedCostPoolId: pool.id,
        supplierBillId: bill.id,
        supplierBillLineId: draft.line.id,
        goodsReceiptId: draft.line.goodsReceiptId,
        goodsReceiptLineId: draft.line.goodsReceiptLineId,
        productId: draft.line.productId,
        skuId: draft.line.skuId,
        locationId: draft.line.locationId,
        companyId: draft.line.companyId,
        valuationAdjustmentMovementId: movement.id,
        amountMinor: draft.amountMinor,
        currency: bill.currency,
        scale: bill.scale,
        basisQuantity: draft.basisQuantity,
        basisLineValueMinor: draft.basisLineValueMinor,
      })
      .returning()
  ).at(0);
  if (!allocation) {
    throw new Error("createLandedCostPools: allocation insert failed");
  }
  return allocation;
}

async function recordLandedCostPoolCreated(
  tx: TenantTransaction,
  ctx: ServiceContext,
  bill: SupplierBillRow,
  pools: LandedCostPoolRow[],
  allocations: LandedCostAllocationRow[]
) {
  await recordAudit(tx, ctx, {
    action: "procurement.landed_cost_pool.create",
    entityType: "landed_cost_pool",
    entityId: pools[0]?.id ?? bill.id,
    after: { supplierBillId: bill.id, pools, allocations },
  });
  await emitEvent(tx, ctx, {
    payload: {
      aggregateId: bill.id,
      aggregateType: "supplier_bill",
      companyId: bill.companyId,
      currency: bill.currency,
      scale: bill.scale,
      supplierBillId: bill.id,
      pools,
      allocations,
    },
    type: "procurement.landed_cost.allocated",
  });
}

export async function createLandedCostPools(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: CreateLandedCostPoolsInput
): Promise<{
  allocations: LandedCostAllocationRow[];
  pools: LandedCostPoolRow[];
}> {
  if (input.pools.length === 0) {
    throw new ProcurementError(
      "At least one landed cost pool is required",
      "INVALID_STATE"
    );
  }

  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`landed-cost:${ctx.tenantId}:${input.supplierBillId}`}, 0))`
  );

  const { bill, lines } = await loadLandedCostBill(tx, input.supplierBillId);
  await assertLandedCostAvcoOnly(tx, ctx, lines);

  const pools: LandedCostPoolRow[] = [];
  const allocations: LandedCostAllocationRow[] = [];

  for (const poolInput of input.pools) {
    const pool = await insertLandedCostPool(tx, ctx, bill, poolInput);
    pools.push(pool);
    const drafts = largestRemainderAllocations(
      poolInput.amountMinor,
      allocationBasisRows(poolInput, lines)
    );
    for (const draft of drafts) {
      allocations.push(
        await createLandedCostAllocation(tx, ctx, bill, pool, draft)
      );
    }
  }

  await recordLandedCostPoolCreated(tx, ctx, bill, pools, allocations);
  return { pools, allocations };
}

export async function receivePurchaseOrder(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: ReceivePurchaseOrderInput
): Promise<{ receipt: GoodsReceiptRow; lines: GoodsReceiptLineRow[] }> {
  if (input.lines.length === 0) {
    throw new ProcurementError(
      "At least one receipt line is required",
      "INVALID_STATE"
    );
  }

  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`grn:${ctx.tenantId}:${input.purchaseOrderId}`}, 0))`
  );

  const header = (
    await tx
      .select()
      .from(purchaseOrder)
      .where(eq(purchaseOrder.id, input.purchaseOrderId))
      .limit(1)
  ).at(0);
  if (!header) {
    throw new ProcurementError("Purchase order not found", "NOT_FOUND");
  }
  assertReceiptablePurchaseOrder(header.status);
  await assertReceivingLocation(tx, header.companyId, input.locationId);

  const receipt = (
    await tx
      .insert(goodsReceipt)
      .values({
        tenantId: ctx.tenantId,
        companyId: header.companyId,
        supplierId: header.supplierId,
        purchaseOrderId: header.id,
        locationId: input.locationId,
        number: input.number,
        receivedAt: input.receivedAt ?? new Date(),
        notes: input.notes ?? null,
        createdBy: ctx.actorUserId ?? null,
      })
      .returning()
  ).at(0);
  if (!receipt) {
    throw new Error("receivePurchaseOrder: receipt insert failed");
  }

  const createdLines: GoodsReceiptLineRow[] = [];
  const seenLineIds = new Set<string>();

  for (const lineInput of input.lines) {
    if (lineInput.qtyReceived <= 0) {
      throw new ProcurementError(
        "Receipt quantity must be positive",
        "INVALID_STATE"
      );
    }
    if (seenLineIds.has(lineInput.purchaseOrderLineId)) {
      throw new ProcurementError(
        "Duplicate purchase order line on goods receipt",
        "INVALID_STATE"
      );
    }
    seenLineIds.add(lineInput.purchaseOrderLineId);

    const poLine = (
      await tx
        .select()
        .from(purchaseOrderLine)
        .where(
          and(
            eq(purchaseOrderLine.id, lineInput.purchaseOrderLineId),
            eq(purchaseOrderLine.purchaseOrderId, header.id)
          )
        )
        .limit(1)
    ).at(0) as PurchaseOrderLineRow | undefined;
    if (!poLine) {
      throw new ProcurementError("Purchase order line not found", "NOT_FOUND");
    }
    const remaining = poLine.qtyOrdered - poLine.qtyReceived;
    if (lineInput.qtyReceived > remaining) {
      throw new ProcurementError(
        "Receipt quantity exceeds remaining purchase order quantity",
        "INVALID_STATE"
      );
    }

    const movement = await appendStockMovement(tx, ctx, {
      costCurrency: poLine.currency,
      costScale: poLine.scale,
      locationId: input.locationId,
      movementType: "receipt",
      productId: poLine.productId,
      qtyDelta: lineInput.qtyReceived,
      refId: receipt.id,
      refType: "goods_receipt",
      skuId: poLine.skuId,
      unitCostMinor: poLine.unitCostMinor,
    });
    await applyValuation(tx, ctx, movement);

    const created = (
      await tx
        .insert(goodsReceiptLine)
        .values({
          tenantId: ctx.tenantId,
          goodsReceiptId: receipt.id,
          purchaseOrderId: header.id,
          purchaseOrderLineId: poLine.id,
          productId: poLine.productId,
          skuId: poLine.skuId,
          qtyReceived: lineInput.qtyReceived,
          unitCostMinor: poLine.unitCostMinor,
          currency: poLine.currency,
          scale: poLine.scale,
          movementId: movement.id,
        })
        .returning()
    ).at(0);
    if (!created) {
      throw new Error("receivePurchaseOrder: line insert failed");
    }
    createdLines.push(created);

    await tx
      .update(purchaseOrderLine)
      .set({
        qtyReceived: sql`${purchaseOrderLine.qtyReceived} + ${lineInput.qtyReceived}`,
        updatedBy: ctx.actorUserId ?? null,
      })
      .where(eq(purchaseOrderLine.id, poLine.id));
  }

  const lineStates = await tx
    .select({
      qtyOrdered: purchaseOrderLine.qtyOrdered,
      qtyReceived: purchaseOrderLine.qtyReceived,
    })
    .from(purchaseOrderLine)
    .where(eq(purchaseOrderLine.purchaseOrderId, header.id));
  const fullyReceived = lineStates.every(
    (line) => line.qtyReceived >= line.qtyOrdered
  );
  await tx
    .update(purchaseOrder)
    .set({
      status: fullyReceived ? "received" : "partially_received",
      updatedBy: ctx.actorUserId ?? null,
    })
    .where(eq(purchaseOrder.id, header.id));

  await recordAudit(tx, ctx, {
    action: "procurement.goods_receipt.create",
    entityType: "goods_receipt",
    entityId: receipt.id,
    after: { ...receipt, lines: createdLines },
  });
  await emitEvent(tx, ctx, {
    payload: {
      aggregateId: receipt.id,
      aggregateType: "goods_receipt",
      companyId: receipt.companyId,
      goodsReceiptId: receipt.id,
      lines: createdLines,
      locationId: receipt.locationId,
      purchaseOrderId: receipt.purchaseOrderId,
    },
    type: DomainEventType.InventoryReceived,
  });

  return { receipt, lines: createdLines };
}
