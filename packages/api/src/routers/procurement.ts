import {
  db,
  schema,
  services,
  type TenantTransaction,
  withTenant,
} from "@RetailOS/db";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, isNull, type SQL } from "drizzle-orm";
import { z } from "zod";
import { tenantProcedure } from "../index";
import { assertPermission } from "./vs1";

// Procurement lives in its own module (not inlined into vs1.ts's giant
// router object) purely for file-size hygiene — vs1.ts was already ~9,500
// lines. (Adding this router here originally hit TS7056 — "inferred type
// exceeds the maximum length the compiler will serialize" — but that turned
// out to be `packages/api/tsconfig.json`'s vestigial `declaration`/
// `composite` flags forcing a full declaration-emit check nothing downstream
// consumes; removing them was the actual fix, see that file's comment.)

export interface SupplierListRow {
  code: string;
  email: string | null;
  id: string;
  name: string;
  phone: string | null;
  status: string;
}

function loadSupplierList(
  tx: TenantTransaction,
  includeArchived: boolean
): Promise<SupplierListRow[]> {
  return tx
    .select({
      code: schema.supplier.code,
      email: schema.supplier.email,
      id: schema.supplier.id,
      name: schema.supplier.name,
      phone: schema.supplier.phone,
      status: schema.supplier.status,
    })
    .from(schema.supplier)
    .where(includeArchived ? undefined : isNull(schema.supplier.deletedAt))
    .orderBy(schema.supplier.name);
}

export interface PurchaseOrderListRow {
  companyId: string;
  companyName: string;
  createdAt: Date;
  currency: string;
  id: string;
  number: string;
  scale: number;
  status: string;
  supplierId: string;
  supplierName: string;
}

function loadPurchaseOrderList(
  tx: TenantTransaction,
  supplierId?: string
): Promise<PurchaseOrderListRow[]> {
  const conditions = [
    isNull(schema.purchaseOrder.deletedAt),
    supplierId ? eq(schema.purchaseOrder.supplierId, supplierId) : null,
  ].filter((condition): condition is SQL => condition != null);
  return tx
    .select({
      companyId: schema.purchaseOrder.companyId,
      companyName: schema.company.name,
      createdAt: schema.purchaseOrder.createdAt,
      currency: schema.purchaseOrder.currency,
      id: schema.purchaseOrder.id,
      number: schema.purchaseOrder.number,
      scale: schema.purchaseOrder.scale,
      status: schema.purchaseOrder.status,
      supplierId: schema.purchaseOrder.supplierId,
      supplierName: schema.supplier.name,
    })
    .from(schema.purchaseOrder)
    .innerJoin(
      schema.supplier,
      eq(schema.purchaseOrder.supplierId, schema.supplier.id)
    )
    .innerJoin(
      schema.company,
      eq(schema.purchaseOrder.companyId, schema.company.id)
    )
    .where(and(...conditions))
    .orderBy(desc(schema.purchaseOrder.createdAt));
}

export interface GoodsReceiptListRow {
  id: string;
  number: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  receivedAt: Date;
  status: string;
  supplierId: string;
  supplierName: string;
}

function loadGoodsReceiptList(
  tx: TenantTransaction,
  purchaseOrderId?: string
): Promise<GoodsReceiptListRow[]> {
  const conditions = [
    isNull(schema.goodsReceipt.deletedAt),
    purchaseOrderId
      ? eq(schema.goodsReceipt.purchaseOrderId, purchaseOrderId)
      : null,
  ].filter((condition): condition is SQL => condition != null);
  return tx
    .select({
      id: schema.goodsReceipt.id,
      number: schema.goodsReceipt.number,
      purchaseOrderId: schema.goodsReceipt.purchaseOrderId,
      purchaseOrderNumber: schema.purchaseOrder.number,
      supplierId: schema.goodsReceipt.supplierId,
      supplierName: schema.supplier.name,
      receivedAt: schema.goodsReceipt.receivedAt,
      status: schema.goodsReceipt.status,
    })
    .from(schema.goodsReceipt)
    .innerJoin(
      schema.purchaseOrder,
      eq(schema.goodsReceipt.purchaseOrderId, schema.purchaseOrder.id)
    )
    .innerJoin(
      schema.supplier,
      eq(schema.goodsReceipt.supplierId, schema.supplier.id)
    )
    .where(and(...conditions))
    .orderBy(desc(schema.goodsReceipt.receivedAt));
}

export interface SupplierBillListRow {
  apJournalId: string | null;
  billDate: Date;
  currency: string;
  dueDate: Date | null;
  id: string;
  number: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  scale: number;
  status: string;
  supplierId: string;
  supplierName: string;
  totalMinor: number;
}

function loadSupplierBillList(
  tx: TenantTransaction,
  purchaseOrderId?: string
): Promise<SupplierBillListRow[]> {
  const conditions = [
    isNull(schema.supplierBill.deletedAt),
    purchaseOrderId
      ? eq(schema.supplierBill.purchaseOrderId, purchaseOrderId)
      : null,
  ].filter((condition): condition is SQL => condition != null);
  return tx
    .select({
      id: schema.supplierBill.id,
      number: schema.supplierBill.number,
      purchaseOrderId: schema.supplierBill.purchaseOrderId,
      purchaseOrderNumber: schema.purchaseOrder.number,
      supplierId: schema.supplierBill.supplierId,
      supplierName: schema.supplier.name,
      status: schema.supplierBill.status,
      billDate: schema.supplierBill.billDate,
      dueDate: schema.supplierBill.dueDate,
      totalMinor: schema.supplierBill.totalMinor,
      currency: schema.supplierBill.currency,
      scale: schema.supplierBill.scale,
      apJournalId: schema.supplierBill.apJournalId,
    })
    .from(schema.supplierBill)
    .innerJoin(
      schema.purchaseOrder,
      eq(schema.supplierBill.purchaseOrderId, schema.purchaseOrder.id)
    )
    .innerJoin(
      schema.supplier,
      eq(schema.supplierBill.supplierId, schema.supplier.id)
    )
    .where(and(...conditions))
    .orderBy(desc(schema.supplierBill.billDate));
}

export interface PurchaseOrderDetailResult {
  bills: Array<{
    id: string;
    number: string;
    status: string;
    totalMinor: number;
    currency: string;
    scale: number;
    billDate: Date;
  }>;
  header: {
    companyId: string;
    companyName: string;
    createdAt: Date;
    currency: string;
    id: string;
    notes: string | null;
    number: string;
    scale: number;
    status: string;
    supplierId: string;
    supplierName: string;
  };
  lines: Array<{
    id: string;
    productId: string;
    productName: string;
    skuId: string;
    skuCode: string;
    description: string | null;
    qtyOrdered: number;
    qtyReceived: number;
    unitCostMinor: number;
    currency: string;
    scale: number;
  }>;
  receipts: Array<{
    id: string;
    number: string;
    receivedAt: Date;
    status: string;
  }>;
}

async function loadPurchaseOrderDetail(
  tx: TenantTransaction,
  id: string
): Promise<PurchaseOrderDetailResult> {
  const header = (
    await tx
      .select({
        companyId: schema.purchaseOrder.companyId,
        companyName: schema.company.name,
        createdAt: schema.purchaseOrder.createdAt,
        currency: schema.purchaseOrder.currency,
        id: schema.purchaseOrder.id,
        notes: schema.purchaseOrder.notes,
        number: schema.purchaseOrder.number,
        scale: schema.purchaseOrder.scale,
        status: schema.purchaseOrder.status,
        supplierId: schema.purchaseOrder.supplierId,
        supplierName: schema.supplier.name,
      })
      .from(schema.purchaseOrder)
      .innerJoin(
        schema.supplier,
        eq(schema.purchaseOrder.supplierId, schema.supplier.id)
      )
      .innerJoin(
        schema.company,
        eq(schema.purchaseOrder.companyId, schema.company.id)
      )
      .where(eq(schema.purchaseOrder.id, id))
      .limit(1)
  ).at(0);
  if (!header) {
    throw new ORPCError("NOT_FOUND", {
      message: "Purchase order not found",
    });
  }
  const lines = await tx
    .select({
      id: schema.purchaseOrderLine.id,
      productId: schema.purchaseOrderLine.productId,
      productName: schema.product.name,
      skuId: schema.purchaseOrderLine.skuId,
      skuCode: schema.sku.code,
      description: schema.purchaseOrderLine.description,
      qtyOrdered: schema.purchaseOrderLine.qtyOrdered,
      qtyReceived: schema.purchaseOrderLine.qtyReceived,
      unitCostMinor: schema.purchaseOrderLine.unitCostMinor,
      currency: schema.purchaseOrderLine.currency,
      scale: schema.purchaseOrderLine.scale,
    })
    .from(schema.purchaseOrderLine)
    .innerJoin(
      schema.product,
      eq(schema.purchaseOrderLine.productId, schema.product.id)
    )
    .innerJoin(schema.sku, eq(schema.purchaseOrderLine.skuId, schema.sku.id))
    .where(eq(schema.purchaseOrderLine.purchaseOrderId, id))
    .orderBy(schema.purchaseOrderLine.createdAt);
  const receipts = await tx
    .select({
      id: schema.goodsReceipt.id,
      number: schema.goodsReceipt.number,
      receivedAt: schema.goodsReceipt.receivedAt,
      status: schema.goodsReceipt.status,
    })
    .from(schema.goodsReceipt)
    .where(eq(schema.goodsReceipt.purchaseOrderId, id))
    .orderBy(desc(schema.goodsReceipt.receivedAt));
  const bills = await tx
    .select({
      id: schema.supplierBill.id,
      number: schema.supplierBill.number,
      status: schema.supplierBill.status,
      totalMinor: schema.supplierBill.totalMinor,
      currency: schema.supplierBill.currency,
      scale: schema.supplierBill.scale,
      billDate: schema.supplierBill.billDate,
    })
    .from(schema.supplierBill)
    .where(eq(schema.supplierBill.purchaseOrderId, id))
    .orderBy(desc(schema.supplierBill.billDate));
  return { header, lines, receipts, bills };
}

export interface GoodsReceiptDetailResult {
  header: {
    id: string;
    number: string;
    purchaseOrderId: string;
    purchaseOrderNumber: string;
    supplierId: string;
    supplierName: string;
    locationId: string;
    receivedAt: Date;
    status: string;
    notes: string | null;
  };
  lines: Array<{
    id: string;
    productId: string;
    productName: string;
    skuId: string;
    skuCode: string;
    qtyReceived: number;
    unitCostMinor: number;
    currency: string;
    scale: number;
  }>;
}

async function loadGoodsReceiptDetail(
  tx: TenantTransaction,
  id: string
): Promise<GoodsReceiptDetailResult> {
  const header = (
    await tx
      .select({
        id: schema.goodsReceipt.id,
        number: schema.goodsReceipt.number,
        purchaseOrderId: schema.goodsReceipt.purchaseOrderId,
        purchaseOrderNumber: schema.purchaseOrder.number,
        supplierId: schema.goodsReceipt.supplierId,
        supplierName: schema.supplier.name,
        locationId: schema.goodsReceipt.locationId,
        receivedAt: schema.goodsReceipt.receivedAt,
        status: schema.goodsReceipt.status,
        notes: schema.goodsReceipt.notes,
      })
      .from(schema.goodsReceipt)
      .innerJoin(
        schema.purchaseOrder,
        eq(schema.goodsReceipt.purchaseOrderId, schema.purchaseOrder.id)
      )
      .innerJoin(
        schema.supplier,
        eq(schema.goodsReceipt.supplierId, schema.supplier.id)
      )
      .where(eq(schema.goodsReceipt.id, id))
      .limit(1)
  ).at(0);
  if (!header) {
    throw new ORPCError("NOT_FOUND", {
      message: "Goods receipt not found",
    });
  }
  const lines = await tx
    .select({
      id: schema.goodsReceiptLine.id,
      productId: schema.goodsReceiptLine.productId,
      productName: schema.product.name,
      skuId: schema.goodsReceiptLine.skuId,
      skuCode: schema.sku.code,
      qtyReceived: schema.goodsReceiptLine.qtyReceived,
      unitCostMinor: schema.goodsReceiptLine.unitCostMinor,
      currency: schema.goodsReceiptLine.currency,
      scale: schema.goodsReceiptLine.scale,
    })
    .from(schema.goodsReceiptLine)
    .innerJoin(
      schema.product,
      eq(schema.goodsReceiptLine.productId, schema.product.id)
    )
    .innerJoin(schema.sku, eq(schema.goodsReceiptLine.skuId, schema.sku.id))
    .where(eq(schema.goodsReceiptLine.goodsReceiptId, id))
    .orderBy(schema.goodsReceiptLine.createdAt);
  return { header, lines };
}

export const procurementRouter = {
  supplierList: tenantProcedure
    .input(z.object({ includeArchived: z.boolean().default(false) }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "procurement.manage");
        return loadSupplierList(tx, input.includeArchived);
      });
    }),
  purchaseOrderList: tenantProcedure
    .input(z.object({ supplierId: z.string().uuid().optional() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "procurement.manage");
        return loadPurchaseOrderList(tx, input.supplierId);
      });
    }),
  purchaseOrderDetail: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "procurement.manage");
        return loadPurchaseOrderDetail(tx, input.id);
      });
    }),
  goodsReceiptList: tenantProcedure
    .input(z.object({ purchaseOrderId: z.string().uuid().optional() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "procurement.manage");
        return loadGoodsReceiptList(tx, input.purchaseOrderId);
      });
    }),
  goodsReceiptDetail: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "procurement.manage");
        return loadGoodsReceiptDetail(tx, input.id);
      });
    }),
  supplierBillList: tenantProcedure
    .input(z.object({ purchaseOrderId: z.string().uuid().optional() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "procurement.manage");
        return loadSupplierBillList(tx, input.purchaseOrderId);
      });
    }),
  supplierCreate: tenantProcedure
    .input(
      z.object({
        code: z.string().min(1).max(64),
        name: z.string().min(1).max(255),
        email: z.string().email().optional(),
        phone: z.string().max(64).optional(),
        taxIdentificationNumber: z.string().max(128).optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "procurement.manage");
        return services.createSupplier(tx, ctx, input);
      });
    }),
  purchaseOrderCreate: tenantProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        supplierId: z.string().uuid(),
        number: z.string().min(1).max(64),
        currency: z.string().min(3).max(3),
        scale: z.number().int().min(0).max(6).default(2),
        notes: z.string().max(2000).optional(),
        lines: z
          .array(
            z.object({
              productId: z.string().uuid(),
              skuId: z.string().uuid(),
              description: z.string().max(500).optional(),
              qtyOrdered: z.number().int().positive(),
              unitCostMinor: z.number().int().nonnegative(),
              currency: z.string().min(3).max(3).optional(),
              scale: z.number().int().min(0).max(6).optional(),
            })
          )
          .min(1),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "procurement.manage");
        try {
          return await services.createPurchaseOrder(tx, ctx, input);
        } catch (error) {
          if (error instanceof services.ProcurementError) {
            throw new ORPCError("NOT_FOUND", { message: error.message });
          }
          throw error;
        }
      });
    }),
  reorderSuggestionToPurchaseOrderCreate: tenantProcedure
    .input(
      z.object({
        reorderRuleId: z.string().uuid(),
        supplierId: z.string().uuid(),
        number: z.string().min(1).max(64),
        currency: z.string().min(3).max(3),
        scale: z.number().int().min(0).max(6).default(2),
        unitCostMinor: z.number().int().nonnegative(),
        notes: z.string().max(2000).optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "procurement.manage");
        try {
          return await services.createPurchaseOrderFromReorderSuggestion(
            tx,
            ctx,
            input
          );
        } catch (error) {
          if (error instanceof services.ProcurementError) {
            if (error.code === "NOT_FOUND") {
              throw new ORPCError("NOT_FOUND", { message: error.message });
            }
            throw new ORPCError("BAD_REQUEST", { message: error.message });
          }
          throw error;
        }
      });
    }),
  goodsReceiptCreate: tenantProcedure
    .input(
      z.object({
        purchaseOrderId: z.string().uuid(),
        locationId: z.string().uuid(),
        number: z.string().min(1).max(64),
        receivedAt: z.coerce.date().optional(),
        notes: z.string().max(2000).optional(),
        lines: z
          .array(
            z.object({
              purchaseOrderLineId: z.string().uuid(),
              qtyReceived: z.number().int().positive(),
            })
          )
          .min(1),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "procurement.manage");
        try {
          return await services.receivePurchaseOrder(tx, ctx, input);
        } catch (error) {
          if (error instanceof services.ProcurementError) {
            if (error.code === "NOT_FOUND") {
              throw new ORPCError("NOT_FOUND", { message: error.message });
            }
            throw new ORPCError("BAD_REQUEST", { message: error.message });
          }
          throw error;
        }
      });
    }),
  supplierBillCreate: tenantProcedure
    .input(
      z.object({
        purchaseOrderId: z.string().uuid(),
        number: z.string().min(1).max(64),
        billDate: z.coerce.date().optional(),
        dueDate: z.coerce.date().optional(),
        notes: z.string().max(2000).optional(),
        lines: z
          .array(
            z.object({
              goodsReceiptLineId: z.string().uuid(),
              qtyBilled: z.number().int().positive(),
            })
          )
          .min(1),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "procurement.manage");
        try {
          return await services.createSupplierBill(tx, ctx, input);
        } catch (error) {
          if (error instanceof services.ProcurementError) {
            if (error.code === "NOT_FOUND") {
              throw new ORPCError("NOT_FOUND", { message: error.message });
            }
            throw new ORPCError("BAD_REQUEST", { message: error.message });
          }
          throw error;
        }
      });
    }),
  supplierBillPostToAccountsPayable: tenantProcedure
    .input(
      z.object({
        supplierBillId: z.string().uuid(),
        postingPeriodId: z.string().uuid(),
        inventoryAccountId: z.string().uuid(),
        accountsPayableAccountId: z.string().uuid(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "procurement.manage");
        try {
          return await services.postSupplierBillToAccountsPayable(
            tx,
            ctx,
            input
          );
        } catch (error) {
          if (error instanceof services.ProcurementError) {
            if (error.code === "NOT_FOUND") {
              throw new ORPCError("NOT_FOUND", { message: error.message });
            }
            throw new ORPCError("BAD_REQUEST", { message: error.message });
          }
          throw error;
        }
      });
    }),
  vendorPaymentCreate: tenantProcedure
    .input(
      z.object({
        supplierBillId: z.string().uuid(),
        number: z.string().min(1).max(64),
        postingPeriodId: z.string().uuid(),
        cashAccountId: z.string().uuid(),
        accountsPayableAccountId: z.string().uuid(),
        amountMinor: z.number().int().positive(),
        paidAt: z.coerce.date().optional(),
        notes: z.string().max(1000).optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "procurement.manage");
        try {
          return await services.createVendorPayment(tx, ctx, input);
        } catch (error) {
          if (error instanceof services.ProcurementError) {
            if (error.code === "NOT_FOUND") {
              throw new ORPCError("NOT_FOUND", { message: error.message });
            }
            throw new ORPCError("BAD_REQUEST", { message: error.message });
          }
          throw error;
        }
      });
    }),
  landedCostPoolCreate: tenantProcedure
    .input(
      z.object({
        supplierBillId: z.string().uuid(),
        pools: z
          .array(
            z.object({
              kind: z.enum(schema.LANDED_COST_KINDS),
              basis: z.enum(schema.LANDED_COST_ALLOCATION_BASES),
              amountMinor: z.number().int().positive(),
            })
          )
          .min(1),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "procurement.manage");
        try {
          return await services.createLandedCostPools(tx, ctx, input);
        } catch (error) {
          if (error instanceof services.ProcurementError) {
            if (error.code === "NOT_FOUND") {
              throw new ORPCError("NOT_FOUND", { message: error.message });
            }
            throw new ORPCError("BAD_REQUEST", { message: error.message });
          }
          throw error;
        }
      });
    }),
  importBatchCreate: tenantProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        supplierId: z.string().uuid(),
        purchaseOrderId: z.string().uuid(),
        supplierBillId: z.string().uuid(),
        bondReceiptId: z.string().uuid().nullable().optional(),
        number: z.string().min(1).max(64),
        currency: z.string().min(3).max(3),
        scale: z.number().int().min(0).max(6).optional(),
        customsReference: z.string().max(128).nullable().optional(),
        declarationNumber: z.string().max(128).nullable().optional(),
        portOfEntry: z.string().max(128).nullable().optional(),
        vesselName: z.string().max(255).nullable().optional(),
        eta: z.coerce.date().nullable().optional(),
        arrivedAt: z.coerce.date().nullable().optional(),
        clearedAt: z.coerce.date().nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
        lines: z
          .array(
            z.object({
              goodsReceiptId: z.string().uuid(),
              goodsReceiptLineId: z.string().uuid(),
              supplierBillLineId: z.string().uuid(),
              landedCostPoolId: z.string().uuid().nullable().optional(),
              landedCostAllocationId: z.string().uuid().nullable().optional(),
              customsLineReference: z.string().max(128).nullable().optional(),
            })
          )
          .min(1),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "procurement.manage");
        try {
          return await services.createImportBatch(tx, ctx, input);
        } catch (error) {
          if (error instanceof services.ProcurementError) {
            if (error.code === "NOT_FOUND") {
              throw new ORPCError("NOT_FOUND", { message: error.message });
            }
            throw new ORPCError("BAD_REQUEST", { message: error.message });
          }
          throw error;
        }
      });
    }),
};

export default procurementRouter;
