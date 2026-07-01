import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { actor, softDelete, tenantId, timestamps } from "./columns";
import { company } from "./company";
import { product, sku } from "./product";

export const SUPPLIER_STATUSES = ["active", "archived"] as const;
export const PURCHASE_ORDER_STATUSES = [
  "draft",
  "approved",
  "partially_received",
  "received",
  "cancelled",
] as const;

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
