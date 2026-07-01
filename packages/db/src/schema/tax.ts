import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { actor, tenantId, timestamps } from "./columns";

export const TAX_RATE_KINDS = ["sales"] as const;

export const taxRate = pgTable(
  "tax_rate",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    code: text("code").notNull(),
    name: text("name").notNull(),
    kind: text("kind", { enum: TAX_RATE_KINDS }).default("sales").notNull(),
    // Basis points: 1400 = 14.00%. Integer-only to avoid decimal drift.
    rateBps: integer("rate_bps").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    ...timestamps,
    ...actor,
  },
  (table) => [
    unique("tax_rate_tenantId_code_uq").on(table.tenantId, table.code),
    unique("tax_rate_tenant_id_uq").on(table.tenantId, table.id),
    index("tax_rate_tenantId_idx").on(table.tenantId),
    check("tax_rate_kind_chk", sql`${table.kind} IN ('sales')`),
    check(
      "tax_rate_bps_chk",
      sql`${table.rateBps} >= 0 AND ${table.rateBps} <= 10000`
    ),
    check(
      "tax_rate_effective_window_chk",
      sql`${table.effectiveTo} IS NULL OR ${table.effectiveFrom} IS NULL OR ${table.effectiveTo} > ${table.effectiveFrom}`
    ),
  ]
);
