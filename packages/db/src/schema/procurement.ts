import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { actor, softDelete, tenantId, timestamps } from "./columns";
import { company, location } from "./company";
import { stockLedger } from "./inventory";
import { product, sku } from "./product";

export const SUPPLIER_STATUSES = ["active", "archived"] as const;
export const PURCHASE_ORDER_STATUSES = [
  "draft",
  "approved",
  "partially_received",
  "received",
  "cancelled",
] as const;
export const GOODS_RECEIPT_STATUSES = ["posted", "cancelled"] as const;

export const supplier = pgTable(
  "supplier",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    code: text("code").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    taxIdentificationNumber: text("tax_identification_number"),
    status: text("status", { enum: SUPPLIER_STATUSES })
      .default("active")
      .notNull(),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    index("supplier_tenantId_idx").on(table.tenantId),
    unique("supplier_tenant_code_uq").on(table.tenantId, table.code),
    unique("supplier_tenant_id_uq").on(table.tenantId, table.id),
    check("supplier_status_chk", sql`${table.status} IN ('active','archived')`),
  ]
);

export const purchaseOrder = pgTable(
  "purchase_order",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => supplier.id),
    number: text("number").notNull(),
    status: text("status", { enum: PURCHASE_ORDER_STATUSES })
      .default("draft")
      .notNull(),
    currency: text("currency").notNull(),
    scale: bigint("scale", { mode: "number" }).default(2).notNull(),
    notes: text("notes"),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    index("purchase_order_tenantId_idx").on(table.tenantId),
    index("purchase_order_supplier_idx").on(table.supplierId),
    unique("purchase_order_tenant_number_uq").on(table.tenantId, table.number),
    unique("purchase_order_tenant_id_uq").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.companyId],
      foreignColumns: [company.tenantId, company.id],
      name: "purchase_order_company_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.supplierId],
      foreignColumns: [supplier.tenantId, supplier.id],
      name: "purchase_order_supplier_composite_fk",
    }),
    check(
      "purchase_order_status_chk",
      sql`${table.status} IN ('draft','approved','partially_received','received','cancelled')`
    ),
    check("purchase_order_scale_nonnegative_chk", sql`${table.scale} >= 0`),
  ]
);

export const purchaseOrderLine = pgTable(
  "purchase_order_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrder.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id),
    skuId: uuid("sku_id")
      .notNull()
      .references(() => sku.id),
    description: text("description"),
    qtyOrdered: bigint("qty_ordered", { mode: "number" }).notNull(),
    qtyReceived: bigint("qty_received", { mode: "number" })
      .default(0)
      .notNull(),
    unitCostMinor: bigint("unit_cost_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    scale: bigint("scale", { mode: "number" }).default(2).notNull(),
    ...timestamps,
    ...actor,
  },
  (table) => [
    index("purchase_order_line_tenantId_idx").on(table.tenantId),
    index("purchase_order_line_po_idx").on(table.purchaseOrderId),
    unique("purchase_order_line_tenant_id_uq").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.purchaseOrderId],
      foreignColumns: [purchaseOrder.tenantId, purchaseOrder.id],
      name: "purchase_order_line_po_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.productId],
      foreignColumns: [product.tenantId, product.id],
      name: "purchase_order_line_product_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.productId, table.skuId],
      foreignColumns: [sku.tenantId, sku.productId, sku.id],
      name: "purchase_order_line_sku_product_composite_fk",
    }),
    check("purchase_order_line_qty_positive_chk", sql`${table.qtyOrdered} > 0`),
    check(
      "purchase_order_line_qty_received_nonnegative_chk",
      sql`${table.qtyReceived} >= 0`
    ),
    check(
      "purchase_order_line_unit_cost_nonnegative_chk",
      sql`${table.unitCostMinor} >= 0`
    ),
    check(
      "purchase_order_line_scale_nonnegative_chk",
      sql`${table.scale} >= 0`
    ),
  ]
);

export const goodsReceipt = pgTable(
  "goods_receipt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    companyId: uuid("company_id").notNull(),
    supplierId: uuid("supplier_id").notNull(),
    purchaseOrderId: uuid("purchase_order_id").notNull(),
    locationId: uuid("location_id").notNull(),
    number: text("number").notNull(),
    status: text("status", { enum: GOODS_RECEIPT_STATUSES })
      .default("posted")
      .notNull(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
    notes: text("notes"),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    index("goods_receipt_tenantId_idx").on(table.tenantId),
    index("goods_receipt_purchase_order_idx").on(table.purchaseOrderId),
    index("goods_receipt_location_idx").on(table.locationId),
    unique("goods_receipt_tenant_number_uq").on(table.tenantId, table.number),
    unique("goods_receipt_tenant_id_uq").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.companyId],
      foreignColumns: [company.tenantId, company.id],
      name: "goods_receipt_company_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.supplierId],
      foreignColumns: [supplier.tenantId, supplier.id],
      name: "goods_receipt_supplier_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.purchaseOrderId],
      foreignColumns: [purchaseOrder.tenantId, purchaseOrder.id],
      name: "goods_receipt_po_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.companyId, table.locationId],
      foreignColumns: [location.tenantId, location.companyId, location.id],
      name: "goods_receipt_location_composite_fk",
    }),
    check(
      "goods_receipt_status_chk",
      sql`${table.status} IN ('posted','cancelled')`
    ),
  ]
);

export const goodsReceiptLine = pgTable(
  "goods_receipt_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    goodsReceiptId: uuid("goods_receipt_id").notNull(),
    purchaseOrderId: uuid("purchase_order_id").notNull(),
    purchaseOrderLineId: uuid("purchase_order_line_id").notNull(),
    productId: uuid("product_id").notNull(),
    skuId: uuid("sku_id").notNull(),
    qtyReceived: bigint("qty_received", { mode: "number" }).notNull(),
    unitCostMinor: bigint("unit_cost_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    scale: bigint("scale", { mode: "number" }).default(2).notNull(),
    movementId: uuid("movement_id").notNull(),
    ...timestamps,
  },
  (table) => [
    index("goods_receipt_line_tenantId_idx").on(table.tenantId),
    index("goods_receipt_line_receipt_idx").on(table.goodsReceiptId),
    index("goods_receipt_line_po_line_idx").on(table.purchaseOrderLineId),
    unique("goods_receipt_line_movement_uq").on(
      table.tenantId,
      table.movementId
    ),
    unique("goods_receipt_line_tenant_id_uq").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.goodsReceiptId],
      foreignColumns: [goodsReceipt.tenantId, goodsReceipt.id],
      name: "goods_receipt_line_receipt_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.purchaseOrderId],
      foreignColumns: [purchaseOrder.tenantId, purchaseOrder.id],
      name: "goods_receipt_line_po_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.purchaseOrderLineId],
      foreignColumns: [purchaseOrderLine.tenantId, purchaseOrderLine.id],
      name: "goods_receipt_line_po_line_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.productId],
      foreignColumns: [product.tenantId, product.id],
      name: "goods_receipt_line_product_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.productId, table.skuId],
      foreignColumns: [sku.tenantId, sku.productId, sku.id],
      name: "goods_receipt_line_sku_product_composite_fk",
    }),
    foreignKey({
      columns: [table.movementId],
      foreignColumns: [stockLedger.id],
      name: "goods_receipt_line_movement_fk",
    }),
    check("goods_receipt_line_qty_positive_chk", sql`${table.qtyReceived} > 0`),
    check(
      "goods_receipt_line_unit_cost_nonnegative_chk",
      sql`${table.unitCostMinor} >= 0`
    ),
    check("goods_receipt_line_scale_nonnegative_chk", sql`${table.scale} >= 0`),
  ]
);
