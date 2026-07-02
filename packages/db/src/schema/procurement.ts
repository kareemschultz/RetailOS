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
import { bondReceipt } from "./bond";
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
export const SUPPLIER_BILL_STATUSES = ["draft", "posted", "cancelled"] as const;
export const LANDED_COST_POOL_STATUSES = ["posted"] as const;
export const IMPORT_BATCH_STATUSES = [
  "open",
  "arrived",
  "cleared",
  "cancelled",
] as const;
export const LANDED_COST_KINDS = [
  "freight",
  "insurance",
  "duty",
  "tax",
  "handling",
  "other",
] as const;
export const LANDED_COST_ALLOCATION_BASES = ["line_value", "quantity"] as const;

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

export const supplierBill = pgTable(
  "supplier_bill",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    companyId: uuid("company_id").notNull(),
    supplierId: uuid("supplier_id").notNull(),
    purchaseOrderId: uuid("purchase_order_id").notNull(),
    number: text("number").notNull(),
    status: text("status", { enum: SUPPLIER_BILL_STATUSES })
      .default("posted")
      .notNull(),
    billDate: timestamp("bill_date").defaultNow().notNull(),
    dueDate: timestamp("due_date"),
    currency: text("currency").notNull(),
    scale: bigint("scale", { mode: "number" }).default(2).notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    notes: text("notes"),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    index("supplier_bill_tenantId_idx").on(table.tenantId),
    index("supplier_bill_supplier_idx").on(table.supplierId),
    index("supplier_bill_purchase_order_idx").on(table.purchaseOrderId),
    unique("supplier_bill_tenant_number_uq").on(table.tenantId, table.number),
    unique("supplier_bill_tenant_id_uq").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.companyId],
      foreignColumns: [company.tenantId, company.id],
      name: "supplier_bill_company_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.supplierId],
      foreignColumns: [supplier.tenantId, supplier.id],
      name: "supplier_bill_supplier_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.purchaseOrderId],
      foreignColumns: [purchaseOrder.tenantId, purchaseOrder.id],
      name: "supplier_bill_po_composite_fk",
    }),
    check(
      "supplier_bill_status_chk",
      sql`${table.status} IN ('draft','posted','cancelled')`
    ),
    check("supplier_bill_total_nonnegative_chk", sql`${table.totalMinor} >= 0`),
    check("supplier_bill_scale_nonnegative_chk", sql`${table.scale} >= 0`),
  ]
);

export const supplierBillLine = pgTable(
  "supplier_bill_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    supplierBillId: uuid("supplier_bill_id").notNull(),
    purchaseOrderId: uuid("purchase_order_id").notNull(),
    purchaseOrderLineId: uuid("purchase_order_line_id").notNull(),
    goodsReceiptId: uuid("goods_receipt_id").notNull(),
    goodsReceiptLineId: uuid("goods_receipt_line_id").notNull(),
    productId: uuid("product_id").notNull(),
    skuId: uuid("sku_id").notNull(),
    qtyBilled: bigint("qty_billed", { mode: "number" }).notNull(),
    unitCostMinor: bigint("unit_cost_minor", { mode: "number" }).notNull(),
    lineTotalMinor: bigint("line_total_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    scale: bigint("scale", { mode: "number" }).default(2).notNull(),
    ...timestamps,
  },
  (table) => [
    index("supplier_bill_line_tenantId_idx").on(table.tenantId),
    index("supplier_bill_line_bill_idx").on(table.supplierBillId),
    index("supplier_bill_line_grn_line_idx").on(table.goodsReceiptLineId),
    unique("supplier_bill_line_tenant_id_uq").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.supplierBillId],
      foreignColumns: [supplierBill.tenantId, supplierBill.id],
      name: "supplier_bill_line_bill_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.purchaseOrderId],
      foreignColumns: [purchaseOrder.tenantId, purchaseOrder.id],
      name: "supplier_bill_line_po_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.purchaseOrderLineId],
      foreignColumns: [purchaseOrderLine.tenantId, purchaseOrderLine.id],
      name: "supplier_bill_line_po_line_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.goodsReceiptId],
      foreignColumns: [goodsReceipt.tenantId, goodsReceipt.id],
      name: "supplier_bill_line_grn_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.goodsReceiptLineId],
      foreignColumns: [goodsReceiptLine.tenantId, goodsReceiptLine.id],
      name: "supplier_bill_line_grn_line_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.productId],
      foreignColumns: [product.tenantId, product.id],
      name: "supplier_bill_line_product_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.productId, table.skuId],
      foreignColumns: [sku.tenantId, sku.productId, sku.id],
      name: "supplier_bill_line_sku_product_composite_fk",
    }),
    check("supplier_bill_line_qty_positive_chk", sql`${table.qtyBilled} > 0`),
    check(
      "supplier_bill_line_unit_cost_nonnegative_chk",
      sql`${table.unitCostMinor} >= 0`
    ),
    check(
      "supplier_bill_line_total_nonnegative_chk",
      sql`${table.lineTotalMinor} >= 0`
    ),
    check("supplier_bill_line_scale_nonnegative_chk", sql`${table.scale} >= 0`),
  ]
);

export const landedCostPool = pgTable(
  "landed_cost_pool",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    supplierBillId: uuid("supplier_bill_id").notNull(),
    companyId: uuid("company_id").notNull(),
    kind: text("kind", { enum: LANDED_COST_KINDS }).notNull(),
    basis: text("basis", { enum: LANDED_COST_ALLOCATION_BASES }).notNull(),
    status: text("status", { enum: LANDED_COST_POOL_STATUSES })
      .default("posted")
      .notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    scale: bigint("scale", { mode: "number" }).default(2).notNull(),
    ...timestamps,
    ...actor,
  },
  (table) => [
    index("landed_cost_pool_tenantId_idx").on(table.tenantId),
    index("landed_cost_pool_bill_idx").on(table.supplierBillId),
    unique("landed_cost_pool_tenant_id_uq").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.supplierBillId],
      foreignColumns: [supplierBill.tenantId, supplierBill.id],
      name: "landed_cost_pool_bill_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.companyId],
      foreignColumns: [company.tenantId, company.id],
      name: "landed_cost_pool_company_composite_fk",
    }),
    check(
      "landed_cost_pool_kind_chk",
      sql`${table.kind} IN ('freight','insurance','duty','tax','handling','other')`
    ),
    check(
      "landed_cost_pool_basis_chk",
      sql`${table.basis} IN ('line_value','quantity')`
    ),
    check("landed_cost_pool_status_chk", sql`${table.status} IN ('posted')`),
    check(
      "landed_cost_pool_amount_positive_chk",
      sql`${table.amountMinor} > 0`
    ),
    check("landed_cost_pool_scale_nonnegative_chk", sql`${table.scale} >= 0`),
  ]
);

export const landedCostAllocation = pgTable(
  "landed_cost_allocation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    landedCostPoolId: uuid("landed_cost_pool_id").notNull(),
    supplierBillId: uuid("supplier_bill_id").notNull(),
    supplierBillLineId: uuid("supplier_bill_line_id").notNull(),
    goodsReceiptId: uuid("goods_receipt_id").notNull(),
    goodsReceiptLineId: uuid("goods_receipt_line_id").notNull(),
    productId: uuid("product_id").notNull(),
    skuId: uuid("sku_id").notNull(),
    locationId: uuid("location_id").notNull(),
    companyId: uuid("company_id").notNull(),
    valuationAdjustmentMovementId: uuid(
      "valuation_adjustment_movement_id"
    ).notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    scale: bigint("scale", { mode: "number" }).default(2).notNull(),
    basisQuantity: bigint("basis_quantity", { mode: "number" }).notNull(),
    basisLineValueMinor: bigint("basis_line_value_minor", {
      mode: "number",
    }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("landed_cost_allocation_tenantId_idx").on(table.tenantId),
    index("landed_cost_allocation_pool_idx").on(table.landedCostPoolId),
    index("landed_cost_allocation_bill_idx").on(table.supplierBillId),
    unique("landed_cost_allocation_tenant_id_uq").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.landedCostPoolId],
      foreignColumns: [landedCostPool.tenantId, landedCostPool.id],
      name: "landed_cost_allocation_pool_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.supplierBillId],
      foreignColumns: [supplierBill.tenantId, supplierBill.id],
      name: "landed_cost_allocation_bill_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.supplierBillLineId],
      foreignColumns: [supplierBillLine.tenantId, supplierBillLine.id],
      name: "landed_cost_allocation_bill_line_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.goodsReceiptId],
      foreignColumns: [goodsReceipt.tenantId, goodsReceipt.id],
      name: "landed_cost_allocation_grn_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.goodsReceiptLineId],
      foreignColumns: [goodsReceiptLine.tenantId, goodsReceiptLine.id],
      name: "landed_cost_allocation_grn_line_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.productId],
      foreignColumns: [product.tenantId, product.id],
      name: "landed_cost_allocation_product_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.productId, table.skuId],
      foreignColumns: [sku.tenantId, sku.productId, sku.id],
      name: "landed_cost_allocation_sku_product_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.companyId, table.locationId],
      foreignColumns: [location.tenantId, location.companyId, location.id],
      name: "landed_cost_allocation_location_composite_fk",
    }),
    foreignKey({
      columns: [table.valuationAdjustmentMovementId],
      foreignColumns: [stockLedger.id],
      name: "landed_cost_allocation_movement_fk",
    }),
    check(
      "landed_cost_allocation_amount_nonnegative_chk",
      sql`${table.amountMinor} >= 0`
    ),
    check(
      "landed_cost_allocation_basis_qty_nonnegative_chk",
      sql`${table.basisQuantity} >= 0`
    ),
    check(
      "landed_cost_allocation_basis_value_nonnegative_chk",
      sql`${table.basisLineValueMinor} >= 0`
    ),
    check(
      "landed_cost_allocation_scale_nonnegative_chk",
      sql`${table.scale} >= 0`
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

export const importBatch = pgTable(
  "import_batch",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    companyId: uuid("company_id").notNull(),
    supplierId: uuid("supplier_id").notNull(),
    purchaseOrderId: uuid("purchase_order_id").notNull(),
    supplierBillId: uuid("supplier_bill_id").notNull(),
    bondReceiptId: uuid("bond_receipt_id"),
    number: text("number").notNull(),
    status: text("status", { enum: IMPORT_BATCH_STATUSES })
      .default("open")
      .notNull(),
    customsReference: text("customs_reference"),
    declarationNumber: text("declaration_number"),
    portOfEntry: text("port_of_entry"),
    vesselName: text("vessel_name"),
    eta: timestamp("eta"),
    arrivedAt: timestamp("arrived_at"),
    clearedAt: timestamp("cleared_at"),
    currency: text("currency").notNull(),
    scale: bigint("scale", { mode: "number" }).default(2).notNull(),
    notes: text("notes"),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    index("import_batch_tenantId_idx").on(table.tenantId),
    index("import_batch_supplier_idx").on(table.supplierId),
    index("import_batch_purchase_order_idx").on(table.purchaseOrderId),
    index("import_batch_supplier_bill_idx").on(table.supplierBillId),
    unique("import_batch_tenant_number_uq").on(table.tenantId, table.number),
    unique("import_batch_tenant_id_uq").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.companyId],
      foreignColumns: [company.tenantId, company.id],
      name: "import_batch_company_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.supplierId],
      foreignColumns: [supplier.tenantId, supplier.id],
      name: "import_batch_supplier_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.purchaseOrderId],
      foreignColumns: [purchaseOrder.tenantId, purchaseOrder.id],
      name: "import_batch_po_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.supplierBillId],
      foreignColumns: [supplierBill.tenantId, supplierBill.id],
      name: "import_batch_bill_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.bondReceiptId],
      foreignColumns: [bondReceipt.tenantId, bondReceipt.id],
      name: "import_batch_bond_receipt_composite_fk",
    }),
    check(
      "import_batch_status_chk",
      sql`${table.status} IN ('open','arrived','cleared','cancelled')`
    ),
    check("import_batch_scale_nonnegative_chk", sql`${table.scale} >= 0`),
  ]
);

export const importBatchLine = pgTable(
  "import_batch_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    importBatchId: uuid("import_batch_id").notNull(),
    goodsReceiptId: uuid("goods_receipt_id").notNull(),
    goodsReceiptLineId: uuid("goods_receipt_line_id").notNull(),
    supplierBillLineId: uuid("supplier_bill_line_id"),
    landedCostPoolId: uuid("landed_cost_pool_id"),
    landedCostAllocationId: uuid("landed_cost_allocation_id"),
    productId: uuid("product_id").notNull(),
    skuId: uuid("sku_id").notNull(),
    qtyReceived: bigint("qty_received", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    scale: bigint("scale", { mode: "number" }).default(2).notNull(),
    customsLineReference: text("customs_line_reference"),
    ...timestamps,
  },
  (table) => [
    index("import_batch_line_tenantId_idx").on(table.tenantId),
    index("import_batch_line_batch_idx").on(table.importBatchId),
    index("import_batch_line_grn_line_idx").on(table.goodsReceiptLineId),
    unique("import_batch_line_tenant_id_uq").on(table.tenantId, table.id),
    unique("import_batch_line_batch_grn_line_uq").on(
      table.tenantId,
      table.importBatchId,
      table.goodsReceiptLineId
    ),
    foreignKey({
      columns: [table.tenantId, table.importBatchId],
      foreignColumns: [importBatch.tenantId, importBatch.id],
      name: "import_batch_line_batch_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.goodsReceiptId],
      foreignColumns: [goodsReceipt.tenantId, goodsReceipt.id],
      name: "import_batch_line_grn_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.goodsReceiptLineId],
      foreignColumns: [goodsReceiptLine.tenantId, goodsReceiptLine.id],
      name: "import_batch_line_grn_line_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.supplierBillLineId],
      foreignColumns: [supplierBillLine.tenantId, supplierBillLine.id],
      name: "import_batch_line_bill_line_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.landedCostPoolId],
      foreignColumns: [landedCostPool.tenantId, landedCostPool.id],
      name: "import_batch_line_landed_pool_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.landedCostAllocationId],
      foreignColumns: [landedCostAllocation.tenantId, landedCostAllocation.id],
      name: "import_batch_line_landed_allocation_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.productId],
      foreignColumns: [product.tenantId, product.id],
      name: "import_batch_line_product_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.productId, table.skuId],
      foreignColumns: [sku.tenantId, sku.productId, sku.id],
      name: "import_batch_line_sku_product_composite_fk",
    }),
    check("import_batch_line_qty_positive_chk", sql`${table.qtyReceived} > 0`),
    check("import_batch_line_scale_nonnegative_chk", sql`${table.scale} >= 0`),
  ]
);
