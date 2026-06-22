import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { actor, softDelete, tenantId, timestamps } from "./columns";
import { location } from "./company";
import { COSTING_METHODS, product, sku } from "./product";

export const LOT_STATUSES = [
  "available",
  "quarantined",
  "expired",
  "depleted",
] as const;
export const SERIAL_STATUSES = [
  "available",
  "sold",
  "returned",
  "quarantined",
] as const;

export const avgCost = pgTable(
  "avg_cost",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    skuId: uuid("sku_id")
      .notNull()
      .references(() => sku.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => location.id),
    totalValueMinor: bigint("total_value_minor", { mode: "number" })
      .default(0)
      .notNull(),
    qtyOnHand: bigint("qty_on_hand", { mode: "number" }).default(0).notNull(),
    currency: text("currency").notNull(),
    scale: integer("scale").default(2).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    unique("avg_cost_tenantId_sku_location_uq").on(
      table.tenantId,
      table.skuId,
      table.locationId
    ),
    index("avg_cost_tenantId_idx").on(table.tenantId),
    index("avg_cost_sku_location_idx").on(table.skuId, table.locationId),
  ]
);

export const lot = pgTable(
  "lot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    skuId: uuid("sku_id")
      .notNull()
      .references(() => sku.id),
    lotNumber: text("lot_number").notNull(),
    expiryDate: date("expiry_date"),
    manufacturedDate: date("manufactured_date"),
    status: text("status", { enum: LOT_STATUSES })
      .default("available")
      .notNull(),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    unique("lot_tenantId_skuId_lotNumber_uq").on(
      table.tenantId,
      table.skuId,
      table.lotNumber
    ),
    index("lot_tenantId_idx").on(table.tenantId),
    index("lot_skuId_idx").on(table.skuId),
    index("lot_expiryDate_idx").on(table.expiryDate),
  ]
);

export const serial = pgTable(
  "serial",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    skuId: uuid("sku_id")
      .notNull()
      .references(() => sku.id),
    lotId: uuid("lot_id").references(() => lot.id),
    serialNumber: text("serial_number").notNull(),
    status: text("status", { enum: SERIAL_STATUSES })
      .default("available")
      .notNull(),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    unique("serial_tenantId_serialNumber_uq").on(
      table.tenantId,
      table.serialNumber
    ),
    index("serial_tenantId_idx").on(table.tenantId),
    index("serial_skuId_idx").on(table.skuId),
    index("serial_lotId_idx").on(table.lotId),
  ]
);

// Append-only stock ledger — the ONLY way stock changes (charter §18/§33).
// Rows are never updated or deleted; on-hand is derived from the running
// `balance_after`. Movement types for this slice: `receipt`, `sale`.
// Quantities are integer units for VS#1 (fractional/weight UoM deferred).
export const stockLedger = pgTable(
  "stock_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    locationId: uuid("location_id")
      .notNull()
      .references(() => location.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id),
    skuId: uuid("sku_id").references(() => sku.id),
    lotId: uuid("lot_id").references(() => lot.id),
    serialId: uuid("serial_id").references(() => serial.id),
    movementType: text("movement_type").notNull(),
    qtyDelta: bigint("qty_delta", { mode: "number" }).notNull(),
    balanceAfter: bigint("balance_after", { mode: "number" }).notNull(),
    // Quantity-representation seam (§3 / seam #3): base quantities are integer
    // units at scale 0 today. Fractional/weight UoM (deli, produce, fabric,
    // bulk) lands later as qty_delta interpreted at 10^-qty_scale — mirrors the
    // money minor-units pattern. NULL ⇒ 0 (integer units); existing rows keep
    // their exact stored meaning (no historical reinterpretation).
    qtyScale: integer("qty_scale"),
    unitCostMinor: bigint("unit_cost_minor", { mode: "number" }),
    costCurrency: text("cost_currency"),
    costScale: integer("cost_scale"),
    // Value-only valuation adjustment (§2): movement_type = 'valuation_adjustment'
    // carries qty_delta = 0 and a value delta here (AVCO only; FIFO rejected).
    valueDeltaMinor: bigint("value_delta_minor", { mode: "number" }),
    // Write-time stamp of the resolved financial strategy (seam #2): the costing
    // method actually applied to THIS movement, so a later tenant config change
    // can never silently re-interpret historical movements. Append-only history
    // is preserved by stamping, not by live re-resolution.
    costingMethodApplied: text("costing_method_applied", {
      enum: COSTING_METHODS,
    }),
    // Returns-at-original-cost seam (§4): link a return to the originating
    // movement + carry its original unit cost. Optional — no-receipt returns are
    // valid; return-costing policy decides link-strict vs fallback vs block.
    // Bare uuid (no FK) to avoid a self-referential FK; validated at write time.
    sourceMovementId: uuid("source_movement_id"),
    originalUnitCostMinor: bigint("original_unit_cost_minor", {
      mode: "number",
    }),
    refType: text("ref_type"),
    refId: uuid("ref_id"),
    idempotencyKey: text("idempotency_key"),
    // Server time is authoritative for stock movements (§14); device clocks untrusted.
    serverTs: timestamp("server_ts").defaultNow().notNull(),
  },
  (table) => [
    index("stock_ledger_tenantId_idx").on(table.tenantId),
    index("stock_ledger_location_product_idx").on(
      table.locationId,
      table.productId
    ),
    index("stock_ledger_location_sku_idx").on(table.locationId, table.skuId),
    index("stock_ledger_lotId_idx").on(table.lotId),
    index("stock_ledger_serialId_idx").on(table.serialId),
    index("stock_ledger_sourceMovementId_idx").on(table.sourceMovementId),
  ]
);

export const valuationLayer = pgTable(
  "valuation_layer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    skuId: uuid("sku_id")
      .notNull()
      .references(() => sku.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => location.id),
    // Lot-aware FIFO (§1): real FK to the existing lot entity (the one the H1
    // tenant guards validate). Nullable — only populated when tracking_mode
    // includes lot/expiry.
    lotId: uuid("lot_id").references(() => lot.id),
    // Serial-aware FIFO (§1): intentionally a BARE nullable column with NO
    // foreign-key constraint — serial CAPTURE/tracking workflows are deferred.
    // FK to `serial` added when serial tracking lands (asymmetric to lot_id by
    // design). Populated only when tracking_mode includes serial.
    serialId: uuid("serial_id"),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
    seq: integer("seq").notNull(),
    qtyRemaining: bigint("qty_remaining", { mode: "number" }).notNull(),
    unitCostMinor: bigint("unit_cost_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    scale: integer("scale").default(2).notNull(),
    sourceMovementId: uuid("source_movement_id")
      .notNull()
      .references(() => stockLedger.id),
    ...timestamps,
  },
  (table) => [
    unique("valuation_layer_sourceMovementId_uq").on(
      table.tenantId,
      table.sourceMovementId
    ),
    index("valuation_layer_tenantId_idx").on(table.tenantId),
    index("valuation_layer_consume_idx").on(
      table.tenantId,
      table.skuId,
      table.locationId,
      table.receivedAt,
      table.seq
    ),
    index("valuation_layer_lotId_idx").on(table.lotId),
  ]
);

export const reorderRule = pgTable(
  "reorder_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    skuId: uuid("sku_id")
      .notNull()
      .references(() => sku.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => location.id),
    minQty: bigint("min_qty", { mode: "number" }).notNull(),
    maxQty: bigint("max_qty", { mode: "number" }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    unique("reorder_rule_tenantId_sku_location_uq").on(
      table.tenantId,
      table.skuId,
      table.locationId
    ),
    index("reorder_rule_tenantId_idx").on(table.tenantId),
    index("reorder_rule_sku_location_idx").on(table.skuId, table.locationId),
  ]
);

export const stockCount = pgTable(
  "stock_count",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    locationId: uuid("location_id")
      .notNull()
      .references(() => location.id),
    scope: text("scope").default("cycle").notNull(),
    status: text("status").default("draft").notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    postedAt: timestamp("posted_at"),
    postedBy: text("posted_by"),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    index("stock_count_tenantId_idx").on(table.tenantId),
    index("stock_count_locationId_idx").on(table.locationId),
  ]
);

export const stockCountLine = pgTable(
  "stock_count_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    stockCountId: uuid("stock_count_id")
      .notNull()
      .references(() => stockCount.id),
    skuId: uuid("sku_id")
      .notNull()
      .references(() => sku.id),
    lotId: uuid("lot_id").references(() => lot.id),
    countedQty: bigint("counted_qty", { mode: "number" }).notNull(),
    systemQty: bigint("system_qty", { mode: "number" }),
    varianceQty: bigint("variance_qty", { mode: "number" }),
    varianceValueMinor: bigint("variance_value_minor", { mode: "number" }),
    currency: text("currency"),
    scale: integer("scale"),
    ...timestamps,
  },
  (table) => [
    unique("stock_count_line_tenant_count_sku_lot_uq")
      .on(table.tenantId, table.stockCountId, table.skuId, table.lotId)
      .nullsNotDistinct(),
    index("stock_count_line_tenantId_idx").on(table.tenantId),
    index("stock_count_line_stockCountId_idx").on(table.stockCountId),
    index("stock_count_line_skuId_idx").on(table.skuId),
  ]
);
