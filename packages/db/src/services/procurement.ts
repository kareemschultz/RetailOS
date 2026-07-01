import { and, eq } from "drizzle-orm";
import {
  company,
  product,
  purchaseOrder,
  purchaseOrderLine,
  sku,
  supplier,
} from "../schema";
import type { TenantTransaction } from "../tenant";
import { recordAudit } from "./audit";
import type { ServiceContext } from "./types";

export class ProcurementError extends Error {
  readonly code: "NOT_FOUND";

  constructor(message: string, code: "NOT_FOUND") {
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
