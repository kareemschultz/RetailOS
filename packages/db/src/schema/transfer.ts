import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
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
import { lot } from "./inventory";
import { product, sku } from "./product";

// Phase 3 commit 2 — stock transfers (quantity conservation only; VALUE
// conservation is commit 3). Two-step model: ship moves source → a PER-TRANSFER
// in-transit node; receive moves that node → destination. Intra-company only:
// all endpoints share (tenant_id, company_id) via composite FKs to the commit-0
// (tenant_id, company_id, id) target — inter-company is a DB-layer impossibility.
export const TRANSFER_STATUSES = [
  "draft",
  "shipped",
  "received",
  "cancelled",
] as const;

export const stockTransfer = pgTable(
  "stock_transfer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    // Denormalized so the source/dest/transit composite FKs can pin all three
    // endpoints to the SAME company (intra-company-only).
    companyId: uuid("company_id").notNull(),
    number: text("number").notNull(),
    sourceLocationId: uuid("source_location_id").notNull(),
    destLocationId: uuid("dest_location_id").notNull(),
    // The per-transfer in-transit virtual node (NOT one shared transit location)
    // — value can't blend across concurrent transfers (Codex F2).
    inTransitLocationId: uuid("in_transit_location_id").notNull(),
    status: text("status", { enum: TRANSFER_STATUSES })
      .default("draft")
      .notNull(),
    // Date seams — ETA/aging without scheduling logic now.
    shippedAt: timestamp("shipped_at"),
    expectedReceiptDate: date("expected_receipt_date"),
    actualReceiptDate: timestamp("actual_receipt_date"),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    index("stock_transfer_tenantId_idx").on(table.tenantId),
    // Composite-FK target for transfer lines.
    unique("stock_transfer_tenant_id_uq").on(table.tenantId, table.id),
    unique("stock_transfer_tenantId_number_uq").on(
      table.tenantId,
      table.number
    ),
    // company FK.
    foreignKey({
      columns: [table.tenantId, table.companyId],
      foreignColumns: [company.tenantId, company.id],
      name: "stock_transfer_company_fk",
    }),
    // All three endpoints share (tenant_id, company_id) → intra-company-only at
    // the DB layer (a CHECK can't read the referenced location's company).
    foreignKey({
      columns: [table.tenantId, table.companyId, table.sourceLocationId],
      foreignColumns: [location.tenantId, location.companyId, location.id],
      name: "stock_transfer_source_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.companyId, table.destLocationId],
      foreignColumns: [location.tenantId, location.companyId, location.id],
      name: "stock_transfer_dest_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.companyId, table.inTransitLocationId],
      foreignColumns: [location.tenantId, location.companyId, location.id],
      name: "stock_transfer_transit_fk",
    }),
    check(
      "stock_transfer_status_chk",
      sql`${table.status} IN ('draft','shipped','received','cancelled')`
    ),
  ]
);

export const stockTransferLine = pgTable(
  "stock_transfer_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    transferId: uuid("transfer_id").notNull(),
    productId: uuid("product_id").notNull(),
    skuId: uuid("sku_id"),
    lotId: uuid("lot_id"),
    qty: bigint("qty", { mode: "number" }).notNull(),
    ...timestamps,
    ...actor,
  },
  (table) => [
    index("stock_transfer_line_tenantId_idx").on(table.tenantId),
    index("stock_transfer_line_transferId_idx").on(table.transferId),
    foreignKey({
      columns: [table.tenantId, table.transferId],
      foreignColumns: [stockTransfer.tenantId, stockTransfer.id],
      name: "stock_transfer_line_transfer_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.productId],
      foreignColumns: [product.tenantId, product.id],
      name: "stock_transfer_line_product_fk",
    }),
    // Nullable FK columns → MATCH SIMPLE skips the check when sku_id/lot_id NULL.
    foreignKey({
      columns: [table.tenantId, table.skuId],
      foreignColumns: [sku.tenantId, sku.id],
      name: "stock_transfer_line_sku_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.lotId],
      foreignColumns: [lot.tenantId, lot.id],
      name: "stock_transfer_line_lot_fk",
    }),
    check("stock_transfer_line_qty_chk", sql`${table.qty} > 0`),
  ]
);
