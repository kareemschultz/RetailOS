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

// Widened from the original onboarding-only ["sales"] to the three GRA-style
// treatments the Shopix design doc requires (standard/zero/exempt). "sales"
// rows are data-migrated to "standard" in the widening migration — same
// concept (the tenant's active flat rate), renamed to match the treatment
// vocabulary now that per-product classification exists.
export const TAX_RATE_KINDS = ["standard", "zero", "exempt"] as const;

export const taxRate = pgTable(
  "tax_rate",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    code: text("code").notNull(),
    name: text("name").notNull(),
    kind: text("kind", { enum: TAX_RATE_KINDS }).default("standard").notNull(),
    // Basis points: 1400 = 14.00%. Integer-only to avoid decimal drift.
    rateBps: integer("rate_bps").notNull(),
    // Tax-inclusive vs exclusive pricing (charter §19). v1 callers assume
    // exclusive; this seam is reserved so inclusive pricing can be wired later
    // without another migration.
    isInclusive: boolean("is_inclusive").default(false).notNull(),
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
    check(
      "tax_rate_kind_chk",
      sql`${table.kind} IN ('standard','zero','exempt')`
    ),
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
