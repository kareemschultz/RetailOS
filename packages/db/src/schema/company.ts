import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { actor, softDelete, tenantId, timestamps } from "./columns";

// Tenant → Company → Location (charter §8). Location types cover retail stores,
// warehouses, bonded warehouses, DCs, and fulfilment centres.

export const company = pgTable(
  "company",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    name: text("name").notNull(),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [index("company_tenantId_idx").on(table.tenantId)]
);

export const location = pgTable(
  "location",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id),
    name: text("name").notNull(),
    // store | warehouse | bonded | distribution_center | fulfillment_center
    type: text("type").default("store").notNull(),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    index("location_tenantId_idx").on(table.tenantId),
    index("location_companyId_idx").on(table.companyId),
  ]
);
