import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { actor, softDelete, tenantId, timestamps } from "./columns";
import { company } from "./company";
import { sale } from "./sales";

// Fiscalization SEAM (charter §17). RetailOS reserves a pluggable fiscalization
// architecture from day one: country-specific fiscal providers, receipt signing,
// tax-authority submission/clearance, e-invoice status, and credit/debit-note
// fiscal documents. This table is that seam — a RESERVED shape with NO provider
// wired and NO writer yet. Everything provider-specific is NULLABLE so the
// integration lands additively (expand-only). Fail-closed RLS is applied in the
// migration (it carries tenant_id ⇒ the coverage gate requires it).
//
// Credit note is a first-class fiscal document type, not a refund flag (§17).
export const FISCAL_DOC_TYPES = [
  "receipt",
  "invoice",
  "credit_note",
  "debit_note",
] as const;

// Lifecycle of a fiscal submission (§17). Extensible value set ⇒ text({ enum })
// + a DB CHECK (charter §33), never pgEnum.
export const FISCAL_STATUSES = [
  "pending",
  "submitted",
  "accepted",
  "rejected",
  "cancelled",
  "voided",
] as const;

export const fiscalDocument = pgTable(
  "fiscal_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    // The legal entity whose fiscal identity (VAT reg / TIN) the document carries.
    // Composite FK (tenant_id, company_id) → company pins it intra-tenant at the
    // DB layer (H1 kill). Nullable seam until the fiscal writer lands.
    companyId: uuid("company_id"),
    // The POS sale this fiscal document attests (composite FK to the sale target
    // added this commit). Nullable — a fiscal doc may attest an invoice instead.
    saleId: uuid("sale_id"),
    // The invoice this fiscal document attests. Bare-uuid SEAM (NO FK yet) —
    // `invoice` has no (tenant_id, id) composite target, and a plain single-col
    // FK would reopen the H1 cross-tenant class; the composite FK is added when
    // invoice gains its target (same discipline as bond `serial_id`).
    invoiceId: uuid("invoice_id"),
    // receipt | invoice | credit_note | debit_note (§17).
    docType: text("doc_type", { enum: FISCAL_DOC_TYPES }),
    // Pluggable provider id (e.g. a Guyana GRA adapter). Open-ended ⇒ plain text.
    provider: text("provider"),
    providerDocumentId: text("provider_document_id"),
    // The sequential tamper-evident fiscal number (§17), once issued.
    fiscalNumber: text("fiscal_number"),
    status: text("status", { enum: FISCAL_STATUSES }),
    // Signed receipt payload + QR/text for the printed document (§17/§22).
    signature: text("signature"),
    qrPayload: text("qr_payload"),
    submittedAt: timestamp("submitted_at"),
    respondedAt: timestamp("responded_at"),
    // Raw provider response, retained for fiscal-log audit (§17/§25).
    rawResponse: jsonb("raw_response"),
    ...timestamps,
    ...actor,
    ...softDelete,
  },
  (table) => [
    index("fiscal_document_tenantId_idx").on(table.tenantId),
    index("fiscal_document_saleId_idx").on(table.saleId),
    // Composite FKs (H1 kill) — reference the (tenant_id, id) targets so a
    // fiscal document can never point at another tenant's company/sale.
    foreignKey({
      columns: [table.tenantId, table.companyId],
      foreignColumns: [company.tenantId, company.id],
      name: "fiscal_document_company_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.saleId],
      foreignColumns: [sale.tenantId, sale.id],
      name: "fiscal_document_sale_composite_fk",
    }),
    check(
      "fiscal_document_doc_type_chk",
      sql`${table.docType} IS NULL OR ${table.docType} IN ('receipt','invoice','credit_note','debit_note')`
    ),
    check(
      "fiscal_document_status_chk",
      sql`${table.status} IS NULL OR ${table.status} IN ('pending','submitted','accepted','rejected','cancelled','voided')`
    ),
  ]
);
