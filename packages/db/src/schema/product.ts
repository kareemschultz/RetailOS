import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { actor, softDelete, tenantId, timestamps } from "./columns";

// Minimal catalog for VS#1 (charter §18). Money is stored as integer minor
// units + currency + scale, together (§19/§33) — never a float. Variants,
// barcodes, UoM, serial/batch/expiry are deferred to Phase 2.
export const product = pgTable(
  "product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    sku: text("sku").notNull(),
    name: text("name").notNull(),
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
  ]
);
