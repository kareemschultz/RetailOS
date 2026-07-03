import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenantId, timestamps } from "./columns";
import { piiVaultSubject } from "./pii-vault";
import { product, sku } from "./product";

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
