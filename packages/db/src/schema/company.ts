import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
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
// warehouses, bonded warehouses, DCs, fulfilment centres — AND the internal
// warehouse hierarchy (zone/aisle/rack/shelf/bin) + the in-transit virtual node,
// since Phase 3 models all locations as ONE self-referential tree (parent_location_id).
// Extensible value set ⇒ text({ enum }) + a DB CHECK (charter §33), never pgEnum.
export const LOCATION_TYPES = [
  "store",
  "warehouse",
  "bonded",
  "distribution_center",
  "fulfillment_center",
  "in_transit",
  "zone",
  "aisle",
  "rack",
  "shelf",
  "bin",
] as const;

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
    type: text("type", { enum: LOCATION_TYPES }).default("store").notNull(),
    // Self-referential tree (Phase 3): NULL = top-level node (store/warehouse/
    // bonded/DC). A sub-node (zone/aisle/bin) points at its parent. The composite
    // parent FK below pins parent to the SAME tenant AND company at the DB layer.
    parentLocationId: uuid("parent_location_id"),
    // Behaviour flags — let sales/POS auto-exclude non-sellable stock (damaged,
    // in-transit, duty-unpaid) without per-query special-casing.
    isSellable: boolean("is_sellable").default(true).notNull(),
    isQuarantine: boolean("is_quarantine").default(false).notNull(),
    isBonded: boolean("is_bonded").default(false).notNull(),
    isTransit: boolean("is_transit").default(false).notNull(),
    // Bin capacity SEAM only — reserved for future WMS routing; NO routing logic
    // now. Nullable; unit/scale conventions deferred to the WMS phase.
    maxWeight: bigint("max_weight", { mode: "number" }),
    maxVolume: bigint("max_volume", { mode: "number" }),
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
    index("location_parentLocationId_idx").on(table.parentLocationId),
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
    // Self-referential parent FK on (tenant_id, company_id, parent_location_id)
    // → the (tenant_id, company_id, id) target from commit 0. Enforces at the DB
    // layer that a child node shares BOTH tenant AND company with its parent —
    // a CHECK can't read the parent row (the Codex-F3 lesson), so the composite
    // FK does it. NULL parent (top-level) is unconstrained.
    foreignKey({
      columns: [table.tenantId, table.companyId, table.parentLocationId],
      foreignColumns: [table.tenantId, table.companyId, table.id],
      name: "location_parent_composite_fk",
    }),
    // Extensible-enum DB CHECK (charter §33) — the text({ enum }) is TS-only.
    check(
      "location_type_chk",
      sql`${table.type} IN ('store','warehouse','bonded','distribution_center','fulfillment_center','in_transit','zone','aisle','rack','shelf','bin')`
    ),
  ]
);
