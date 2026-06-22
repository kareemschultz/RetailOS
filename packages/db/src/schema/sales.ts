import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { actor, tenantId, timestamps } from "./columns";
import { location } from "./company";
import { product } from "./product";

// POS sale + lines + invoice (charter §19). Money as integer minor units +
// currency + scale. Every sale is idempotent end-to-end: the (tenant_id,
// idempotency_key) pair is unique, so a replayed offline sale collapses to one.
export const sale = pgTable(
  "sale",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    locationId: uuid("location_id")
      .notNull()
      .references(() => location.id),
    number: text("number").notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    scale: integer("scale").default(2).notNull(),
    // completed | void (VS#1)
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
    qty: integer("qty").notNull(),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),
    ...timestamps,
  },
  (table) => [index("sale_line_saleId_idx").on(table.saleId)]
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
