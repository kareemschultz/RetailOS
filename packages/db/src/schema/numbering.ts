import { sql } from "drizzle-orm";
import {
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
import { company, location } from "./company";

// Sequential, tamper-evident document numbering (charter §17). Single-node
// allocator for the slice; the distributed allocator + offline number-block
// reservation are deferred (architecture-review I3). `next` advances within
// [range_start, range_end].
//
// Phase-4 scope EXPANSION (expand/contract): numbering must be unique per
// company, LOCATION, FISCAL YEAR, doc type, and series (§17 "per company,
// location, fiscal year, document type, and numbering series"). `location_id`
// already existed; `fiscal_year` is added here. The NEW finer-scoped unique
// (`number_block_scoped_uq`, NULLS NOT DISTINCT so the nullable location/year
// columns count as a value, not "distinct") is added ALONGSIDE the old coarse
// `number_block_uq`. Both coexist (the coarse one stays binding) until a future
// CONTRACT migration drops `number_block_uq` once the allocator switches to the
// fine scope — never both-shapes-then-destructive in one release (charter §8).
export const numberBlock = pgTable(
  "number_block",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id),
    locationId: uuid("location_id").references(() => location.id),
    // Fiscal-year scope (§17). Nullable: NULL = a year-agnostic block (the
    // pre-expansion default); a fiscal-year-scoped block carries the year.
    fiscalYear: integer("fiscal_year"),
    // sale | invoice
    docType: text("doc_type").notNull(),
    series: text("series").default("default").notNull(),
    rangeStart: integer("range_start").notNull(),
    rangeEnd: integer("range_end").notNull(),
    next: integer("next").notNull(),
    ...timestamps,
  },
  (table) => [
    // Coarse legacy scope — kept binding until the contract migration drops it.
    unique("number_block_uq").on(
      table.tenantId,
      table.companyId,
      table.docType,
      table.series
    ),
    // Finer §17 scope. NULLS NOT DISTINCT: nullable location/fiscal_year are part
    // of the logical key, so two NULL-location blocks must still collide (the
    // Phase-2 nullable-scoped-uniqueness lesson) — plain UNIQUE would treat NULLs
    // as distinct and allow duplicates.
    unique("number_block_scoped_uq")
      .on(
        table.tenantId,
        table.companyId,
        table.locationId,
        table.fiscalYear,
        table.docType,
        table.series
      )
      .nullsNotDistinct(),
    // Composite-FK target (Phase 3 #5): (tenant_id, id) so offline number-block
    // reservations / fiscal documents can reference a block without the H1
    // cross-tenant FK-bypass.
    unique("number_block_tenant_id_uq").on(table.tenantId, table.id),
    index("number_block_tenantId_idx").on(table.tenantId),
  ]
);

export const NUMBER_LEASE_STATUSES = [
  "active",
  "exhausted",
  "expired",
  "reclaimed",
  "voided",
] as const;
export type NumberLeaseStatus = (typeof NUMBER_LEASE_STATUSES)[number];

export const NUMBER_LEASE_USAGE_STATUSES = [
  "consumed",
  "skipped",
  "voided",
] as const;
export type NumberLeaseUsageStatus =
  (typeof NUMBER_LEASE_USAGE_STATUSES)[number];

// Distributed document-number leasing (Phase 4 Commit 6). The allocator row is
// `number_block`; leases are disjoint ranges handed to terminals/registers so
// offline clients can issue stable receipt/invoice/fiscal numbers without
// colliding. Fiscal policy: leased numbers are NEVER reissued. Unused reclaimed
// tails are recorded as skipped usage rows, making gaps explainable/auditable.
export const numberLease = pgTable(
  "number_lease",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    numberBlockId: uuid("number_block_id").notNull(),
    companyId: uuid("company_id").notNull(),
    locationId: uuid("location_id"),
    fiscalYear: integer("fiscal_year"),
    docType: text("doc_type").notNull(),
    series: text("series").default("default").notNull(),
    terminalId: text("terminal_id").notNull(),
    deviceId: text("device_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    rangeStart: integer("range_start").notNull(),
    rangeEnd: integer("range_end").notNull(),
    // Next number the terminal should consume locally. `range_end + 1` means the
    // lease is exhausted.
    nextNumber: integer("next_number").notNull(),
    consumedThrough: integer("consumed_through"),
    status: text("status", { enum: NUMBER_LEASE_STATUSES })
      .default("active")
      .notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    exhaustedAt: timestamp("exhausted_at"),
    reclaimedAt: timestamp("reclaimed_at"),
    ...timestamps,
    ...actor,
  },
  (table) => [
    index("number_lease_tenantId_idx").on(table.tenantId),
    index("number_lease_numberBlockId_idx").on(table.numberBlockId),
    index("number_lease_terminal_idx").on(table.tenantId, table.terminalId),
    unique("number_lease_tenant_id_uq").on(table.tenantId, table.id),
    unique("number_lease_idempotency_uq").on(
      table.tenantId,
      table.idempotencyKey
    ),
    foreignKey({
      columns: [table.tenantId, table.numberBlockId],
      foreignColumns: [numberBlock.tenantId, numberBlock.id],
      name: "number_lease_block_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.companyId],
      foreignColumns: [company.tenantId, company.id],
      name: "number_lease_company_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.companyId, table.locationId],
      foreignColumns: [location.tenantId, location.companyId, location.id],
      name: "number_lease_location_composite_fk",
    }),
    check(
      "number_lease_status_chk",
      sql`${table.status} IN ('active','exhausted','expired','reclaimed','voided')`
    ),
    check(
      "number_lease_range_chk",
      sql`${table.rangeEnd} >= ${table.rangeStart}`
    ),
    // `next_number - 1 <= range_end` is the overflow-safe form of
    // `next_number <= range_end + 1`: it never evaluates `range_end + 1`, so it
    // cannot raise int4 overflow even when range_end is at the int4 ceiling.
    check(
      "number_lease_next_chk",
      sql`${table.nextNumber} >= ${table.rangeStart} AND ${table.nextNumber} - 1 <= ${table.rangeEnd}`
    ),
    check(
      "number_lease_consumed_chk",
      sql`${table.consumedThrough} IS NULL OR (${table.consumedThrough} >= ${table.rangeStart} - 1 AND ${table.consumedThrough} <= ${table.rangeEnd})`
    ),
  ]
);

export const numberLeaseUsage = pgTable(
  "number_lease_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    leaseId: uuid("lease_id").notNull(),
    numberBlockId: uuid("number_block_id").notNull(),
    companyId: uuid("company_id").notNull(),
    locationId: uuid("location_id"),
    fiscalYear: integer("fiscal_year"),
    docType: text("doc_type").notNull(),
    series: text("series").default("default").notNull(),
    number: integer("number").notNull(),
    status: text("status", { enum: NUMBER_LEASE_USAGE_STATUSES }).notNull(),
    reason: text("reason"),
    sourceType: text("source_type"),
    sourceId: uuid("source_id"),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
    ...timestamps,
    ...actor,
  },
  (table) => [
    index("number_lease_usage_tenantId_idx").on(table.tenantId),
    index("number_lease_usage_leaseId_idx").on(table.leaseId),
    unique("number_lease_usage_number_uq").on(
      table.tenantId,
      table.numberBlockId,
      table.number
    ),
    foreignKey({
      columns: [table.tenantId, table.leaseId],
      foreignColumns: [numberLease.tenantId, numberLease.id],
      name: "number_lease_usage_lease_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.numberBlockId],
      foreignColumns: [numberBlock.tenantId, numberBlock.id],
      name: "number_lease_usage_block_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.companyId],
      foreignColumns: [company.tenantId, company.id],
      name: "number_lease_usage_company_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.companyId, table.locationId],
      foreignColumns: [location.tenantId, location.companyId, location.id],
      name: "number_lease_usage_location_composite_fk",
    }),
    check(
      "number_lease_usage_status_chk",
      sql`${table.status} IN ('consumed','skipped','voided')`
    ),
  ]
);
