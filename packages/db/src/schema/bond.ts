import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { actor, softDelete, tenantId, timestamps } from "./columns";
import { company, location } from "./company";
import { lot, stockLedger } from "./inventory";
import { product, sku } from "./product";

// Phase 3 commit 4 — bonded receiving and bonded/sellable separation (INV-3).
//
// A bond receipt is an import batch received INTO a bonded location
// (`is_bonded=true`, `is_sellable=false`). It is a REGULAR stock receipt
// (stock_ledger row with movementType='receipt') decorated with compliance
// metadata (customs reference, landed-cost reference, supplier reference) and
// a LOCKED costing-method stamp per line (F5: Codex fix — makes the AVCO-only
// bonded guarantee durable against later category/tenant costing changes).
//
// Bonded stock stays AVCO-only in Phase 3 (LOCKED §I.4): bond-receipt REJECTS
// a SKU whose resolved costing method is FIFO. The value-only duty seam
// (Phase 3 commit 5) is AVCO-only today; a FIFO-bonded need later is a clean
// change-request.
//
// Customs/landed-cost columns are REFERENCE SEAMS only — nullable generic
// identifiers/links, no allocation behaviour (that is Phase 6).

export const BOND_RECEIPT_STATUSES = ["open", "closed"] as const;

export const bondReceipt = pgTable(
  "bond_receipt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    companyId: uuid("company_id").notNull(),
    // The bonded location this batch was received into. Must be is_bonded=true.
    locationId: uuid("location_id").notNull(),
    number: text("number").notNull(),
    status: text("status", { enum: BOND_RECEIPT_STATUSES })
      .notNull()
      .default("open"),
    // Generic compliance reference seams — NOT GRA/Guyana-specific.
    supplierRef: text("supplier_ref"),
    customsReference: text("customs_reference"),
    landedCostReference: text("landed_cost_reference"),
    // When the physical goods arrived at the bonded location.
    receivedAt: timestamp("received_at"),
    ...actor,
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index("bond_receipt_tenantId_idx").on(table.tenantId),
    index("bond_receipt_locationId_idx").on(table.locationId),
    unique("bond_receipt_tenant_id_uq").on(table.tenantId, table.id),
    // Composite FK: bond receipt must belong to a company within this tenant.
    foreignKey({
      columns: [table.tenantId, table.companyId],
      foreignColumns: [company.tenantId, company.id],
      name: "bond_receipt_company_composite_fk",
    }),
    // Composite FK (Codex F4): the bonded location must be in the same tenant
    // AND the same company as the receipt. The 3-col target prevents a
    // same-tenant Company-A receipt from targeting Company-B's bonded location
    // (a 2-col tenant-only FK would let it through). Kills the cross-company
    // hole at the DB layer for ANY caller, not just the guarded router.
    foreignKey({
      columns: [table.tenantId, table.companyId, table.locationId],
      foreignColumns: [location.tenantId, location.companyId, location.id],
      name: "bond_receipt_location_composite_fk",
    }),
  ]
);

export const bondReceiptLine = pgTable(
  "bond_receipt_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    bondReceiptId: uuid("bond_receipt_id").notNull(),
    productId: uuid("product_id").notNull(),
    skuId: uuid("sku_id").notNull(),
    lotId: uuid("lot_id"),
    qty: bigint("qty", { mode: "number" }).notNull(),
    // Cost triplet (mirror of stock_ledger unit_cost fields).
    unitCostMinor: bigint("unit_cost_minor", { mode: "number" }).notNull(),
    costCurrency: text("cost_currency").notNull(),
    costScale: bigint("cost_scale", { mode: "number" }).notNull(),
    // Per-line generic compliance seams.
    customsReference: text("customs_reference"),
    landedCostReference: text("landed_cost_reference"),
    // F5 (Codex): stamp the resolved costing method at receipt time so that a
    // later category/tenant costing change cannot flip a bonded SKU to FIFO and
    // break the duty-on-release value-only path. Bond-receipt REJECTS FIFO SKUs
    // (validated in the service layer); this stamp records the confirmation.
    // Phase 3 = always 'avco'; a FIFO-bonded path is a future change-request.
    costingMethodApplied: text("costing_method_applied", {
      enum: ["avco", "fifo"],
    }).notNull(),
    // FK to the actual stock_ledger row created by the receipt movement. This
    // ties the compliance record to the immutable ledger entry.
    movementId: uuid("movement_id").notNull(),
    ...timestamps,
  },
  (table) => [
    index("bond_receipt_line_tenantId_idx").on(table.tenantId),
    index("bond_receipt_line_bondReceiptId_idx").on(table.bondReceiptId),
    index("bond_receipt_line_skuId_idx").on(table.skuId),
    // One ledger movement → at most one bond_receipt_line (a receipt movement is
    // recorded once). Replay-idempotent.
    unique("bond_receipt_line_movementId_uq").on(
      table.tenantId,
      table.movementId
    ),
    // (tenant_id, id) composite-FK target — lets bond_release_line reference a
    // bond_receipt_line via a (tenant_id, bond_receipt_line_id) composite FK
    // (commit 5), closing the H1 cross-tenant hole at the DB layer. Consistent
    // with the (tenant_id, id) unique every other tenant-owned table carries.
    unique("bond_receipt_line_tenant_id_uq").on(table.tenantId, table.id),
    // Composite FK: line belongs to a bond_receipt in the same tenant.
    foreignKey({
      columns: [table.tenantId, table.bondReceiptId],
      foreignColumns: [bondReceipt.tenantId, bondReceipt.id],
      name: "bond_receipt_line_receipt_composite_fk",
    }),
    // Composite FK: product must be visible to this tenant.
    foreignKey({
      columns: [table.tenantId, table.productId],
      foreignColumns: [product.tenantId, product.id],
      name: "bond_receipt_line_product_composite_fk",
    }),
    // Composite FK: SKU must be visible to this tenant.
    foreignKey({
      columns: [table.tenantId, table.skuId],
      foreignColumns: [sku.tenantId, sku.id],
      name: "bond_receipt_line_sku_composite_fk",
    }),
    // Composite FK (Codex F3): lot is nullable, but when present it must belong
    // to THIS tenant. A single-column (lot_id)→lot(id) FK references the global
    // UUID PK and would accept another tenant's lot id (FK checks bypass RLS).
    // The (tenant_id, lot_id) composite target (lot's commit-0 (tenant_id, id)
    // unique) closes that cross-tenant hole at the DB layer. The lot↔sku
    // relationship is enforced by a router/service guard (lot has no
    // (tenant_id, sku_id, id) unique to FK against — mirrors
    // assertSkuBelongsToProduct).
    foreignKey({
      columns: [table.tenantId, table.lotId],
      foreignColumns: [lot.tenantId, lot.id],
      name: "bond_receipt_line_lot_composite_fk",
    }),
    // Plain FK: movement (stock_ledger row; not composite — movement already
    // has global UUID PK and is always tenant-scoped by RLS).
    foreignKey({
      columns: [table.movementId],
      foreignColumns: [stockLedger.id],
      name: "bond_receipt_line_movement_fk",
    }),
    // Cost must be POSITIVE (Codex F5). Bonded stock is dutiable imported goods
    // with a declared landed cost; a zero unit cost would create qty>0 with
    // value=0 (avg cost 0) and zero the duty-on-release basis (commit 5). The
    // qty=0⟺value=0 DB invariant (`qty_on_hand<>0 OR value=0`) does NOT catch
    // qty>0&value=0, so this is enforced explicitly for bonded receipts.
    check("bond_receipt_line_cost_pos_chk", sql`${table.unitCostMinor} > 0`),
    check("bond_receipt_line_qty_pos_chk", sql`${table.qty} > 0`),
  ]
);
