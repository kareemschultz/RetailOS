import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { actor, tenantId, timestamps } from "./columns";
import { location } from "./company";
import { piiVaultSubject } from "./pii-vault";
import { product, sku } from "./product";
import { sale, saleLine } from "./sales";

// Shopix design §10 — v1 customer/guest principal. Deliberately minimal (do
// NOT pull the Phase-7 CRM model forward): a bare row a guest checkout or
// storefront login can attach a cart/order to. Erasable PII (name, contact,
// delivery address) NEVER lives here as raw columns — only a nullable
// `pii_subject_id` reference into the vault (§25). A guest that never
// completes checkout may have no PII captured at all (piiSubjectId stays
// null).
export const customer = pgTable(
  "customer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    piiSubjectId: uuid("pii_subject_id"),
    isGuest: boolean("is_guest").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    index("customer_tenantId_idx").on(table.tenantId),
    // Composite-FK target (H1 discipline).
    unique("customer_tenant_id_uq").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.piiSubjectId],
      foreignColumns: [piiVaultSubject.tenantId, piiVaultSubject.id],
      name: "customer_pii_subject_composite_fk",
    }),
  ]
);

// Extensible lifecycle (text enum + CHECK, never pgEnum, charter §33).
// "converted" has no writer yet — checkout (design §6, next build step) sets
// it when a cart becomes a paid order.
export const CART_STATUSES = ["active", "converted", "abandoned"] as const;

// Shopix design §5 — server-persisted cart, only once a customer/guest
// principal exists (anonymous browsing carts client-side, never touches this
// table). The AUTHORITATIVE total is always `commerce.quote`, re-priced and
// re-taxed server-side at read/checkout time — a cart line never stores a
// client-submitted price.
export const cart = pgTable(
  "cart",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    customerId: uuid("customer_id").notNull(),
    status: text("status", { enum: CART_STATUSES }).default("active").notNull(),
    ...timestamps,
  },
  (table) => [
    index("cart_tenantId_idx").on(table.tenantId),
    index("cart_customerId_idx").on(table.customerId),
    unique("cart_tenant_id_uq").on(table.tenantId, table.id),
    check(
      "cart_status_chk",
      sql`${table.status} IN ('active','converted','abandoned')`
    ),
    foreignKey({
      columns: [table.tenantId, table.customerId],
      foreignColumns: [customer.tenantId, customer.id],
      name: "cart_customer_composite_fk",
    }),
  ]
);

export const cartLine = pgTable(
  "cart_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    cartId: uuid("cart_id").notNull(),
    productId: uuid("product_id").notNull(),
    // Nullable: a cart line may target the product generically before a
    // specific SKU/variant is chosen. Checkout (§6) requires a resolved SKU.
    skuId: uuid("sku_id"),
    qty: integer("qty").notNull(),
    ...timestamps,
  },
  (table) => [
    index("cart_line_tenantId_idx").on(table.tenantId),
    index("cart_line_cartId_idx").on(table.cartId),
    // One line per (product, sku) per cart — repeat add-to-cart increments
    // qty instead of duplicating rows.
    unique("cart_line_tenant_cart_product_sku_uq")
      .on(table.tenantId, table.cartId, table.productId, table.skuId)
      .nullsNotDistinct(),
    check("cart_line_qty_positive_chk", sql`${table.qty} > 0`),
    foreignKey({
      columns: [table.tenantId, table.cartId],
      foreignColumns: [cart.tenantId, cart.id],
      name: "cart_line_cart_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.productId],
      foreignColumns: [product.tenantId, product.id],
      name: "cart_line_product_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.skuId],
      foreignColumns: [sku.tenantId, sku.id],
      name: "cart_line_sku_composite_fk",
    }),
  ]
);

// Shopix design §7 — the FULFILMENT/customer document. The financial truth is
// the linked `sale`/`sale_line`/`tender` (design §8: an online checkout is a
// channel on the SAME shared ledger, never a parallel posting path — charter
// §21). `sale_id`/`number` stay NULL until the `paid` transition (design §6
// invariant: stock/COGS/sale commit ONLY inside payment confirmation, so an
// order that never pays never consumes a document number — charter §17 no
// numbering gaps for documents that were never really issued).
export const ORDER_STATUSES = [
  "created",
  "payment_pending",
  "paid",
  "fulfilling",
  "fulfilled",
  "completed",
  "cancelled",
  // Reserved: v1's confirm never WRITES this transition (see commerce-
  // checkout.ts) — an availability-gate failure just throws and leaves the
  // order to expire naturally, avoiding the tx-rollback trap of trying to
  // persist a status change in the same transaction that's about to abort.
  "unavailable",
] as const;

export const FULFILMENT_TYPES = ["pickup", "delivery"] as const;

export const order = pgTable(
  "order",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    saleId: uuid("sale_id"),
    // The fulfilment/stock-source location (design §7's "location_id
    // (fulfilment source)" — one column, not a second `fulfilment_location_id`).
    locationId: uuid("location_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    number: text("number"),
    // Server-minted, high-entropy, expiring (design §6/§9) — the confirm
    // idempotency identity. NEVER a client-supplied key.
    checkoutIntentId: text("checkout_intent_id").notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    scale: integer("scale").default(2).notNull(),
    status: text("status", { enum: ORDER_STATUSES })
      .default("payment_pending")
      .notNull(),
    fulfilmentType: text("fulfilment_type", { enum: FULFILMENT_TYPES })
      .default("pickup")
      .notNull(),
    // PII-vault subject reference, NEVER a raw address column (design §10,
    // charter §25). NULL for pickup orders.
    deliveryAddressSubjectId: uuid("delivery_address_subject_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
    ...actor,
  },
  (table) => [
    index("order_tenantId_idx").on(table.tenantId),
    index("order_customerId_idx").on(table.customerId),
    unique("order_tenant_id_uq").on(table.tenantId, table.id),
    unique("order_tenant_checkout_intent_uq").on(
      table.tenantId,
      table.checkoutIntentId
    ),
    check(
      "order_status_chk",
      sql`${table.status} IN ('created','payment_pending','paid','fulfilling','fulfilled','completed','cancelled','unavailable')`
    ),
    check(
      "order_fulfilment_type_chk",
      sql`${table.fulfilmentType} IN ('pickup','delivery')`
    ),
    foreignKey({
      columns: [table.tenantId, table.saleId],
      foreignColumns: [sale.tenantId, sale.id],
      name: "order_sale_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.locationId],
      foreignColumns: [location.tenantId, location.id],
      name: "order_location_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.customerId],
      foreignColumns: [customer.tenantId, customer.id],
      name: "order_customer_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.deliveryAddressSubjectId],
      foreignColumns: [piiVaultSubject.tenantId, piiVaultSubject.id],
      name: "order_delivery_address_subject_composite_fk",
    }),
  ]
);

export const orderLine = pgTable(
  "order_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    orderId: uuid("order_id").notNull(),
    // NULL until `paid` — the sale line carries the authoritative money/COGS
    // truth once it exists (design §7).
    saleLineId: uuid("sale_line_id"),
    productId: uuid("product_id").notNull(),
    // Resolved at checkout-create time (design §7 comment on `cart_line`) —
    // checkout needs a specific stock cell, unlike the product-level cart.
    skuId: uuid("sku_id").notNull(),
    qty: integer("qty").notNull(),
    // Snapshot at order-CREATE time for customer-facing display before
    // payment; NEVER authoritative (re-quoted fresh again at confirm, design
    // §5/§6 — a stored line price is never trusted).
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),
    lineSubtotalMinor: bigint("line_subtotal_minor", {
      mode: "number",
    }).notNull(),
    lineTaxMinor: bigint("line_tax_minor", { mode: "number" }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("order_line_tenantId_idx").on(table.tenantId),
    index("order_line_orderId_idx").on(table.orderId),
    check("order_line_qty_positive_chk", sql`${table.qty} > 0`),
    foreignKey({
      columns: [table.tenantId, table.orderId],
      foreignColumns: [order.tenantId, order.id],
      name: "order_line_order_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.saleLineId],
      foreignColumns: [saleLine.tenantId, saleLine.id],
      name: "order_line_sale_line_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.productId],
      foreignColumns: [product.tenantId, product.id],
      name: "order_line_product_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.skuId],
      foreignColumns: [sku.tenantId, sku.id],
      name: "order_line_sku_composite_fk",
    }),
  ]
);
