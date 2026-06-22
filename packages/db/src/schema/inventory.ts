import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tenantId } from "./columns";
import { location } from "./company";
import { product } from "./product";

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
    movementType: text("movement_type").notNull(),
    qtyDelta: integer("qty_delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
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
  ]
);
