import { and, eq, sql } from "drizzle-orm";
import {
  company,
  goodsReceipt,
  goodsReceiptLine,
  location as locationTable,
  product,
  purchaseOrder,
  purchaseOrderLine,
  sku,
  supplier,
} from "../schema";
import type { TenantTransaction } from "../tenant";
import { recordAudit } from "./audit";
import { applyValuation } from "./costing";
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
