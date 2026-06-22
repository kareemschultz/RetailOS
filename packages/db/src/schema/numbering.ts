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
// reservation are deferred (architecture-review I3). A block is scoped per
// (tenant, company, doc_type, series); `next` advances within [range_start, range_end].
export const numberBlock = pgTable(
  "number_block",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id),
    locationId: uuid("location_id").references(() => location.id),
    // sale | invoice
    docType: text("doc_type").notNull(),
    series: text("series").default("default").notNull(),
    rangeStart: integer("range_start").notNull(),
    rangeEnd: integer("range_end").notNull(),
    next: integer("next").notNull(),
    ...timestamps,
  },
  (table) => [
    unique("number_block_uq").on(
      table.tenantId,
      table.companyId,
      table.docType,
      table.series
    ),
    index("number_block_tenantId_idx").on(table.tenantId),
  ]
);
