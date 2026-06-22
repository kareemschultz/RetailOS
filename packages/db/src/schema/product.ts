import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { actor, softDelete, tenantId, timestamps } from "./columns";

export const COSTING_METHODS = ["avco", "fifo"] as const;
export const TRACKING_MODES = ["none", "lot", "serial"] as const;
export const UOM_KINDS = ["count", "weight", "volume", "length"] as const;
export const UOM_ROLES = ["purchase", "stock", "sale", "reporting"] as const;
export const BARCODE_SYMBOLOGIES = [
  "ean13",
  "upca",
  "ean8",
  "code128",
  "gs1",
  "qr",
] as const;

export const category = pgTable(
  "category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    parentCategoryId: uuid("parent_category_id"),
    name: text("name").notNull(),
    code: text("code"),
    costingMethod: text("costing_method", { enum: COSTING_METHODS }),
    trackingMode: text("tracking_mode", { enum: TRACKING_MODES }),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    unique("category_tenantId_code_uq").on(table.tenantId, table.code),
    index("category_tenantId_idx").on(table.tenantId),
    index("category_parentCategoryId_idx").on(table.parentCategoryId),
  ]
);

export const brand = pgTable(
  "brand",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    name: text("name").notNull(),
    code: text("code"),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    unique("brand_tenantId_code_uq").on(table.tenantId, table.code),
    index("brand_tenantId_idx").on(table.tenantId),
  ]
);

export const unitOfMeasure = pgTable(
  "unit_of_measure",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    code: text("code").notNull(),
    name: text("name").notNull(),
    kind: text("kind", { enum: UOM_KINDS }).default("count").notNull(),
    decimalScale: integer("decimal_scale").default(0).notNull(),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    unique("unit_of_measure_tenantId_code_uq").on(table.tenantId, table.code),
    index("unit_of_measure_tenantId_idx").on(table.tenantId),
  ]
);

// Product catalog. Money is stored as integer minor units + currency + scale,
// together (§19/§33) — never a float. Phase 2 adds categories, brands,
// variants, SKUs, barcodes, and UoM; lot/serial tracking lands in the next
// table group.
export const product = pgTable(
  "product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    categoryId: uuid("category_id").references(() => category.id),
    brandId: uuid("brand_id").references(() => brand.id),
    baseUomId: uuid("base_uom_id").references(() => unitOfMeasure.id),
    costingMethod: text("costing_method", { enum: COSTING_METHODS }),
    trackingMode: text("tracking_mode", { enum: TRACKING_MODES })
      .default("none")
      .notNull(),
    // Money minor units are int8 (bigint) — int4 caps at ~$21M, too small for an
    // enterprise/wholesale ERP. mode:"number" keeps a JS number (safe to 2^53).
    priceMinor: bigint("price_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    scale: integer("scale").default(2).notNull(),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    unique("product_tenantId_sku_uq").on(table.tenantId, table.sku),
    index("product_tenantId_idx").on(table.tenantId),
    index("product_categoryId_idx").on(table.categoryId),
    index("product_brandId_idx").on(table.brandId),
    index("product_baseUomId_idx").on(table.baseUomId),
  ]
);

export const variant = pgTable(
  "variant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id),
    name: text("name").notNull(),
    value: text("value").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    unique("variant_tenantId_product_name_value_uq").on(
      table.tenantId,
      table.productId,
      table.name,
      table.value
    ),
    index("variant_tenantId_idx").on(table.tenantId),
    index("variant_productId_idx").on(table.productId),
  ]
);

export const sku = pgTable(
  "sku",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id),
    code: text("code").notNull(),
    name: text("name"),
    baseUomId: uuid("base_uom_id").references(() => unitOfMeasure.id),
    costingMethod: text("costing_method", { enum: COSTING_METHODS }),
    trackingMode: text("tracking_mode", { enum: TRACKING_MODES })
      .default("none")
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    unique("sku_tenantId_code_uq").on(table.tenantId, table.code),
    index("sku_tenantId_idx").on(table.tenantId),
    index("sku_productId_idx").on(table.productId),
    index("sku_baseUomId_idx").on(table.baseUomId),
  ]
);

export const barcode = pgTable(
  "barcode",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    skuId: uuid("sku_id")
      .notNull()
      .references(() => sku.id),
    value: text("value").notNull(),
    symbology: text("symbology", { enum: BARCODE_SYMBOLOGIES })
      .default("ean13")
      .notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    unique("barcode_tenantId_value_uq").on(table.tenantId, table.value),
    index("barcode_tenantId_idx").on(table.tenantId),
    index("barcode_skuId_idx").on(table.skuId),
  ]
);

export const uomConversion = pgTable(
  "uom_conversion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    categoryId: uuid("category_id").references(() => category.id),
    productId: uuid("product_id").references(() => product.id),
    skuId: uuid("sku_id").references(() => sku.id),
    fromUomId: uuid("from_uom_id")
      .notNull()
      .references(() => unitOfMeasure.id),
    toUomId: uuid("to_uom_id")
      .notNull()
      .references(() => unitOfMeasure.id),
    role: text("role", { enum: UOM_ROLES }).notNull(),
    factor: integer("factor").notNull(),
    factorScale: integer("factor_scale").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    unique("uom_conversion_tenant_scope_role_uq")
      .on(
        table.tenantId,
        table.categoryId,
        table.productId,
        table.skuId,
        table.fromUomId,
        table.toUomId,
        table.role
      )
      .nullsNotDistinct(),
    index("uom_conversion_tenantId_idx").on(table.tenantId),
    index("uom_conversion_categoryId_idx").on(table.categoryId),
    index("uom_conversion_productId_idx").on(table.productId),
    index("uom_conversion_skuId_idx").on(table.skuId),
  ]
);

export const bundle = pgTable(
  "bundle",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id),
    name: text("name").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    unique("bundle_tenantId_productId_uq").on(table.tenantId, table.productId),
    index("bundle_tenantId_idx").on(table.tenantId),
    index("bundle_productId_idx").on(table.productId),
  ]
);

export const bom = pgTable(
  "bom",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id),
    name: text("name").notNull(),
    status: text("status").default("active").notNull(),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    unique("bom_tenantId_productId_name_uq").on(
      table.tenantId,
      table.productId,
      table.name
    ),
    index("bom_tenantId_idx").on(table.tenantId),
    index("bom_productId_idx").on(table.productId),
  ]
);

export const bomLine = pgTable(
  "bom_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    bomId: uuid("bom_id")
      .notNull()
      .references(() => bom.id),
    componentSkuId: uuid("component_sku_id")
      .notNull()
      .references(() => sku.id),
    qtyBase: bigint("qty_base", { mode: "number" }).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("bom_line_tenantId_bom_component_uq").on(
      table.tenantId,
      table.bomId,
      table.componentSkuId
    ),
    index("bom_line_tenantId_idx").on(table.tenantId),
    index("bom_line_bomId_idx").on(table.bomId),
    index("bom_line_componentSkuId_idx").on(table.componentSkuId),
  ]
);
