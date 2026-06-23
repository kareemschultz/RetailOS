import {
  foreignKey,
  index,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { actor, softDelete, tenantId, timestamps } from "./columns";
import { REMOVAL_STRATEGIES } from "./product";

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
  (table) => [
    index("company_tenantId_idx").on(table.tenantId),
    // Composite-FK target (Phase 3 #5): lets child tables reference
    // (tenant_id, id) so a cross-tenant FK becomes a DB-layer impossibility.
    // Redundant-but-harmless given id is already a unique PK.
    unique("company_tenant_id_uq").on(table.tenantId, table.id),
  ]
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
    // Location-level operational override (resolver §6). Removal strategy is
    // physical/operational, so it may resolve at the location level.
    removalStrategy: text("removal_strategy", { enum: REMOVAL_STRATEGIES }),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    index("location_tenantId_idx").on(table.tenantId),
    index("location_companyId_idx").on(table.companyId),
    // Composite-FK targets (Phase 3 #5 + F3).
    unique("location_tenant_id_uq").on(table.tenantId, table.id),
    // (tenant_id, company_id, id) target: lets a transfer's source/dest FK pin
    // both endpoints to the SAME company at the DB layer (intra-company-only).
    unique("location_tenant_company_id_uq").on(
      table.tenantId,
      table.companyId,
      table.id
    ),
    // Composite FK on company (ADDITIVE — the existing plain company_id FK is
    // kept): makes a location referencing ANOTHER tenant's company a DB-layer
    // impossibility (the first demonstrable kill of the H1 cross-tenant class).
    foreignKey({
      columns: [table.tenantId, table.companyId],
      foreignColumns: [company.tenantId, company.id],
      name: "location_company_composite_fk",
    }),
  ]
);
