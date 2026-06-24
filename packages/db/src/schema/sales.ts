import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { actor, tenantId, timestamps } from "./columns";
import { location } from "./company";
import { lot } from "./inventory";
import { product, sku } from "./product";

// POS sale + lines + tenders + invoice (charter §19). Money as integer minor
// units + currency + scale. Every sale is idempotent end-to-end: the (tenant_id,
// idempotency_key) pair is unique, so a replayed offline sale collapses to one.
//
// Phase-4 (MSP) EXPAND (expand-only): the sale gains shift/rep/customer seams,
// subtotal/discount/tax money fields, a sale_type, and an originalSaleId seam
// for returns; sale_line gains SKU/lot identity, base-unit quantity, line tax/
// discount, and the COGS stamp written by `applyValuation` (#8). A `tender`
// table records how the sale was paid. All new columns are nullable (present-
// but-null preserves the contract for single-currency MSP) — no drops, no
// NOT-NULL retrofits, no type changes.

// Sale document kinds (§19). Extensible ⇒ text({ enum }) + CHECK, never pgEnum.
export const SALE_TYPES = ["sale", "return", "exchange"] as const;

export const sale = pgTable(
  "sale",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    locationId: uuid("location_id")
      .notNull()
      .references(() => location.id),
    number: text("number").notNull(),
    // sale | return | exchange (§19). Returns/exchanges are built in a later
    // commit; the column + originalSaleId seam are reserved now (set-once shape).
    saleType: text("sale_type", { enum: SALE_TYPES }).default("sale").notNull(),
    originalSaleId: uuid("original_sale_id"),
    // Money breakdown (nullable seams until the pricing/tax engine fills them;
    // MSP fills subtotal+total, leaves discount/tax 0/null where not used).
    subtotalMinor: bigint("subtotal_minor", { mode: "number" }),
    discountMinor: bigint("discount_minor", { mode: "number" }),
    taxMinor: bigint("tax_minor", { mode: "number" }),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    scale: integer("scale").default(2).notNull(),
    // Operational seams (nullable): the shift the sale belongs to (cash recon is
    // a later commit — sale records WITHOUT a shift, INV-P4-7/event-map), the
    // sales rep (commission, later), and the customer (CRM, Phase 7).
    shiftId: uuid("shift_id"),
    salesRepId: text("sales_rep_id"),
    customerId: uuid("customer_id"),
    // completed | void
    status: text("status").default("completed").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    ...timestamps,
    ...actor,
  },
  (table) => [
    index("sale_tenantId_idx").on(table.tenantId),
    unique("sale_tenantId_idempotencyKey_uq").on(
      table.tenantId,
      table.idempotencyKey
    ),
    // Composite-FK target (Phase 3 #5 pattern): lets child tables (lines,
    // tenders, refunds, fiscal documents) reference (tenant_id, id) so a
    // cross-tenant FK becomes a DB-layer impossibility (kills the H1 class).
    unique("sale_tenant_id_uq").on(table.tenantId, table.id),
    check(
      "sale_sale_type_chk",
      sql`${table.saleType} IN ('sale','return','exchange')`
    ),
  ]
);

export const saleLine = pgTable(
  "sale_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sale.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id),
    // SKU/lot identity (nullable — untracked products sell without a SKU). The
    // composite FKs below pin them intra-tenant (H1 kill); valuation is SKU-level.
    skuId: uuid("sku_id"),
    lotId: uuid("lot_id"),
    // Legacy each-count qty (VS#1) kept; qtyBase is the base-unit-minor quantity
    // (int8, the ERP-safe ledger type) — nullable until callers populate it.
    qty: integer("qty").notNull(),
    qtyBase: bigint("qty_base", { mode: "number" }),
    qtyScale: integer("qty_scale"),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),
    lineDiscountMinor: bigint("line_discount_minor", { mode: "number" }),
    lineTaxMinor: bigint("line_tax_minor", { mode: "number" }),
    taxRateId: uuid("tax_rate_id"),
    // COGS stamp — written by `applyValuation` (#8): the inventory cost the sale
    // consumed (FIFO layers / AVCO value) + which method valued it. Nullable
    // (untracked lines have no COGS). The basis can be a different currency/scale
    // than the sale (ADR-0008/INV-P5-4), so it carries its own money triple.
    cogsMinor: bigint("cogs_minor", { mode: "number" }),
    cogsCurrency: text("cogs_currency"),
    cogsScale: integer("cogs_scale"),
    costingMethodApplied: text("costing_method_applied"),
    ...timestamps,
  },
  (table) => [
    index("sale_line_saleId_idx").on(table.saleId),
    index("sale_line_skuId_idx").on(table.skuId),
    // Composite FKs (H1 kill) — reference the (tenant_id, id) targets so a line
    // can never point at another tenant's sku/lot.
    foreignKey({
      columns: [table.tenantId, table.skuId],
      foreignColumns: [sku.tenantId, sku.id],
      name: "sale_line_sku_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.lotId],
      foreignColumns: [lot.tenantId, lot.id],
      name: "sale_line_lot_composite_fk",
    }),
  ]
);

// How a sale was paid (§19). One row per tender; split + multi-currency tenders
// are a later "payments maturity" commit — MSP records single/simple tenders.
export const TENDER_METHODS = [
  "cash",
  "card",
  "bank_transfer",
  "mobile_money",
  "cheque",
  "store_credit",
  "gift_card",
] as const;

export const tender = pgTable(
  "tender",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    saleId: uuid("sale_id").notNull(),
    method: text("method", { enum: TENDER_METHODS }).notNull(),
    currency: text("currency").notNull(),
    scale: integer("scale").default(2).notNull(),
    // amountMinor = tendered; changeMinor = returned (cash overpay); settled =
    // amount applied to the sale total (amount − change). FX seam reserved.
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    changeMinor: bigint("change_minor", { mode: "number" }),
    settledAmountMinor: bigint("settled_amount_minor", { mode: "number" }),
    fxRateToSale: text("fx_rate_to_sale"),
    ...timestamps,
    ...actor,
  },
  (table) => [
    index("tender_tenantId_idx").on(table.tenantId),
    index("tender_saleId_idx").on(table.saleId),
    // Composite FK (H1 kill) → the sale (tenant_id, id) target from Commit 1.
    foreignKey({
      columns: [table.tenantId, table.saleId],
      foreignColumns: [sale.tenantId, sale.id],
      name: "tender_sale_composite_fk",
    }),
    check(
      "tender_method_chk",
      sql`${table.method} IN ('cash','card','bank_transfer','mobile_money','cheque','store_credit','gift_card')`
    ),
    check("tender_amount_chk", sql`${table.amountMinor} >= 0`),
  ]
);

// Minimal invoice record for the slice; full AR/document workflow is Phase 5.
export const invoice = pgTable(
  "invoice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sale.id),
    number: text("number").notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    scale: integer("scale").default(2).notNull(),
    ...timestamps,
  },
  (table) => [index("invoice_tenantId_idx").on(table.tenantId)]
);
