import {
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenantId, timestamps } from "./columns";
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
