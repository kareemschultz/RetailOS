import { text, timestamp } from "drizzle-orm/pg-core";

// Shared column helpers for tenant-owned tables (charter §8/§33). Not exported
// from the schema barrel — these are column builders, not tables.

// Server-authoritative timestamps (§14). created_at/updated_at on every row.
export const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
};

// Soft-delete marker — no hard deletes for operational data (§8/§33).
export const softDelete = {
  deletedAt: timestamp("deleted_at"),
};

// Actor ownership columns — Better Auth user text ids (§8/§25).
export const actor = {
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
};

// tenant_id scopes a row to a Better Auth organization (§8). The FK to
// organization.id and the fail-closed RLS policy are added in the Migration+RLS
// commit; app-level scoping is defense-in-depth layered on top.
export const tenantId = text("tenant_id").notNull();
