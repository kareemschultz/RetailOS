import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { actor, tenantId, timestamps } from "./columns";
import { company, location } from "./company";

// Phase-4 Commit 4 — Configurable Cash Control (charter §19). A `shift` is a
// cashier's drawer session at a terminal: open with a float, run sales/cash
// movements against it, then BLIND-close (count entered without seeing expected;
// the system computes over/short). `cash_movement` is the per-currency drawer
// ledger (opening float, pay-ins/pay-outs/drops, close count). Money is integer
// minor units + currency + scale, per row (split/multi-currency drawers, §12).
//
// Platform-first: shift enforcement / blind-close / cash-drawer behaviour is
// configured via the settings resolver (location → tenant → platform), NOT a
// business-type branch — a single-store owner-operator can disable shifts while
// a multi-register chain enforces them, same code.

export const SHIFT_STATUSES = ["open", "closed"] as const;

export const shift = pgTable(
  "shift",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    // Denormalized so the composite FK can pin (tenant_id, company_id, location)
    // to the SAME company at the DB layer (the H1 cross-tenant kill + intra-
    // company integrity, the Phase-3 pattern).
    companyId: uuid("company_id").notNull(),
    locationId: uuid("location_id").notNull(),
    // The physical register/terminal this drawer session belongs to. One OPEN
    // shift per terminal is enforced by the partial unique index below.
    terminalId: text("terminal_id").notNull(),
    // The cashier who owns the drawer (Better Auth user id, §8). Every switch/
    // override is audited to the resolved user.
    cashierUserId: text("cashier_user_id").notNull(),
    status: text("status", { enum: SHIFT_STATUSES }).default("open").notNull(),
    openedAt: timestamp("opened_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
    // The Z-report (end-of-day final settlement) document number, allocated at
    // close via the same gapless per-tenant advisory-lock allocator as sales.
    zReportNumber: text("z_report_number"),
    ...timestamps,
    ...actor,
  },
  (table) => [
    index("shift_tenantId_idx").on(table.tenantId),
    index("shift_locationId_idx").on(table.locationId),
    // Composite-FK target (H1): lets cash_movement reference (tenant_id, id) so a
    // movement can never point at another tenant's shift.
    unique("shift_tenant_id_uq").on(table.tenantId, table.id),
    // Intra-company composite FK (Phase-3 pattern): the shift's location must be
    // in the SAME tenant AND company — a cross-tenant/cross-company shift is a
    // DB-layer impossibility (a CHECK can't read the referenced location's company).
    foreignKey({
      columns: [table.tenantId, table.companyId, table.locationId],
      foreignColumns: [location.tenantId, location.companyId, location.id],
      name: "shift_location_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.companyId],
      foreignColumns: [company.tenantId, company.id],
      name: "shift_company_fk",
    }),
    // One OPEN shift per terminal (partial unique index) — a second openShift on
    // the same terminal while one is open is a DB-layer rejection, complementing
    // the FOR UPDATE guard in the router.
    uniqueIndex("shift_one_open_per_terminal_uq")
      .on(table.tenantId, table.terminalId)
      .where(sql`status = 'open'`),
    check("shift_status_chk", sql`${table.status} IN ('open','closed')`),
  ]
);

// Per-currency drawer ledger. `open_float` rows are the opening float; pay_in/
// pay_out/drop are mid-shift movements; close_count rows are the cashier's blind
// physical count at close. Expected cash is COMPUTED from these + cash tenders
// settled on sales with this shift (never stored as an authoritative scalar).
export const CASH_MOVEMENT_TYPES = [
  "open_float",
  "pay_in",
  "pay_out",
  "drop",
  "close_count",
] as const;

export const cashMovement = pgTable(
  "cash_movement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    shiftId: uuid("shift_id").notNull(),
    type: text("type", { enum: CASH_MOVEMENT_TYPES }).notNull(),
    currency: text("currency").notNull(),
    scale: integer("scale").default(2).notNull(),
    // Always a non-negative magnitude; the TYPE carries the direction (pay_out/
    // drop reduce expected, pay_in/open_float increase it). Avoids signed-amount
    // ambiguity in the expected-cash computation.
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    reason: text("reason"),
    ...timestamps,
    ...actor,
  },
  (table) => [
    index("cash_movement_tenantId_idx").on(table.tenantId),
    index("cash_movement_shiftId_idx").on(table.shiftId),
    // Composite FK (H1 kill) → the shift (tenant_id, id) target above.
    foreignKey({
      columns: [table.tenantId, table.shiftId],
      foreignColumns: [shift.tenantId, shift.id],
      name: "cash_movement_shift_composite_fk",
    }),
    check(
      "cash_movement_type_chk",
      sql`${table.type} IN ('open_float','pay_in','pay_out','drop','close_count')`
    ),
    check("cash_movement_amount_chk", sql`${table.amountMinor} >= 0`),
  ]
);
