import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { bondReceipt, bondReceiptLine } from "./bond";
import { actor, softDelete, tenantId, timestamps } from "./columns";
import { company, location } from "./company";
import { stockTransfer } from "./transfer";

// Phase 3 commit 5 — bond release + duty cost-basis link + approval seam (INV-4/5).
//
// A bond release moves stock OUT of a bonded location into a sellable
// (released) location and raises the released cost basis by the duty + tax
// declared at clearance. It is composed entirely from commit-2/3/4 machinery:
//
//   1. The physical movement is a `stock_transfer` (bonded → released),
//      created+shipped+received by the transfer engine, which conserves both
//      quantity AND value (INV-2 — same proof as a regular transfer).
//   2. The duty/tax cost-basis add is the EXISTING AVCO value-only seam
//      (`valuation_adjustment`, qty_delta=0, value_delta=duty+tax). This is an
//      INTENTIONAL value-ADD, NOT conservation: it raises the released cell's
//      cost basis (INV-5). Zero new costing machinery.
//
// Bonded stock is AVCO-only in Phase 3 (LOCKED §I.4): the release enforces each
// line against the stamped `bond_receipt_line.costing_method_applied` (F5) and
// rejects anything that is not 'avco' rather than run the AVCO value-only path
// under a FIFO stamp.
//
// RBAC-immediate (§I.4): gated behind `bond.release` + `bond.approve_release`
// in the router. The request→approve WORKFLOW (charter §22) is deferred — its
// `requested_by`/`approved_by` columns are RESERVED nullable here and wired
// additively later (never absent → present, which would break a bound consumer).

export const BOND_RELEASE_STATUSES = [
  "pending",
  "approved",
  "released",
] as const;

export const bondRelease = pgTable(
  "bond_release",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    // Denormalised company (F4-class): every location FK below is a 3-col
    // (tenant_id, company_id, location_id) composite so a same-tenant Company-A
    // release cannot target Company-B's location — the cross-company hole a
    // 2-col tenant-only FK would leave open (Codex F4 on bond_receipt). Derived
    // from the source bond_receipt's company at write time.
    companyId: uuid("company_id").notNull(),
    number: text("number").notNull(),
    bondReceiptId: uuid("bond_receipt_id").notNull(),
    // The bonded source location (= the receipt's location, is_bonded=true).
    sourceLocationId: uuid("source_location_id").notNull(),
    // The sellable destination location (is_bonded=false).
    destLocationId: uuid("dest_location_id").notNull(),
    // The stock_transfer that physically moved the goods. NULL until the
    // release executes (the transfer is created inside executeBondRelease).
    transferId: uuid("transfer_id"),
    status: text("status", { enum: BOND_RELEASE_STATUSES })
      .notNull()
      .default("pending"),
    // RESERVED (charter §22 approval workflow). Emitted/stored nullable today
    // so binding them later is additive, never a shape change for consumers.
    requestedBy: text("requested_by"),
    approvedBy: text("approved_by"),
    ...actor,
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index("bond_release_tenantId_idx").on(table.tenantId),
    index("bond_release_bondReceiptId_idx").on(table.bondReceiptId),
    unique("bond_release_tenant_id_uq").on(table.tenantId, table.id),
    // Composite FK: release must belong to a company within this tenant.
    foreignKey({
      columns: [table.tenantId, table.companyId],
      foreignColumns: [company.tenantId, company.id],
      name: "bond_release_company_composite_fk",
    }),
    // Composite FK: release draws from a bond_receipt in the same tenant.
    foreignKey({
      columns: [table.tenantId, table.bondReceiptId],
      foreignColumns: [bondReceipt.tenantId, bondReceipt.id],
      name: "bond_release_receipt_composite_fk",
    }),
    // Composite FK (F4-class): source location must be in the same tenant AND
    // company as the release.
    foreignKey({
      columns: [table.tenantId, table.companyId, table.sourceLocationId],
      foreignColumns: [location.tenantId, location.companyId, location.id],
      name: "bond_release_source_composite_fk",
    }),
    // Composite FK (F4-class): destination location must be in the same tenant
    // AND company as the release.
    foreignKey({
      columns: [table.tenantId, table.companyId, table.destLocationId],
      foreignColumns: [location.tenantId, location.companyId, location.id],
      name: "bond_release_dest_composite_fk",
    }),
    // Composite FK: the executing transfer must be in the same tenant.
    foreignKey({
      columns: [table.tenantId, table.transferId],
      foreignColumns: [stockTransfer.tenantId, stockTransfer.id],
      name: "bond_release_transfer_composite_fk",
    }),
  ]
);

export const bondReleaseLine = pgTable(
  "bond_release_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    bondReleaseId: uuid("bond_release_id").notNull(),
    bondReceiptLineId: uuid("bond_receipt_line_id").notNull(),
    qty: bigint("qty", { mode: "number" }).notNull(),
    // Duty + tax declared at clearance, in minor units. The value-only
    // adjustment adds (duty + tax) to the released cell's cost basis.
    dutyMinor: bigint("duty_minor", { mode: "number" }).notNull().default(0),
    taxMinor: bigint("tax_minor", { mode: "number" }).notNull().default(0),
    // F5 stamp carried from the originating bond_receipt_line. Only 'avco' is
    // valid in Phase 3; the service rejects any other stamped method.
    costingMethodApplied: text("costing_method_applied", {
      enum: ["avco", "fifo"],
    }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("bond_release_line_tenantId_idx").on(table.tenantId),
    index("bond_release_line_bondReleaseId_idx").on(table.bondReleaseId),
    // Composite FK: line belongs to a bond_release in the same tenant.
    foreignKey({
      columns: [table.tenantId, table.bondReleaseId],
      foreignColumns: [bondRelease.tenantId, bondRelease.id],
      name: "bond_release_line_release_composite_fk",
    }),
    // Composite FK (H1-class): the originating receipt line must be in the same
    // tenant. Targets bond_receipt_line's (tenant_id, id) unique (added in
    // commit 5 alongside this table).
    foreignKey({
      columns: [table.tenantId, table.bondReceiptLineId],
      foreignColumns: [bondReceiptLine.tenantId, bondReceiptLine.id],
      name: "bond_release_line_receipt_line_composite_fk",
    }),
    check("bond_release_line_qty_pos_chk", sql`${table.qty} > 0`),
    check("bond_release_line_duty_nonneg_chk", sql`${table.dutyMinor} >= 0`),
    check("bond_release_line_tax_nonneg_chk", sql`${table.taxMinor} >= 0`),
  ]
);
