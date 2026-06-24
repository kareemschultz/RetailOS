-- Phase 4 commit 1 — Foundation & schema seams (expand-only; NO drops, NO NOT-NULL
-- retrofits, NO type changes). Adds: the fiscalization seam (fiscal_document, all
-- provider fields nullable, fail-closed RLS below); VAT/TIN tax-identity seams on
-- organization + company; number_block fiscal-year scope + finer scoped UNIQUE
-- (NULLS NOT DISTINCT) kept ALONGSIDE the legacy coarse UNIQUE (contract/drop is a
-- later migration); and (tenant_id, id) composite-FK targets on sale + number_block.
--
-- HAND-ORDERED (drizzle-kit lesson, Phase 3 commit 0): drizzle emitted the
-- fiscal_document→sale composite FK BEFORE the sale (tenant_id, id) UNIQUE it
-- references. A composite FK needs its target UNIQUE to exist first, so all UNIQUE
-- targets are created BEFORE the composite FKs below.

CREATE TABLE "fiscal_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" uuid,
	"sale_id" uuid,
	"invoice_id" uuid,
	"doc_type" text,
	"provider" text,
	"provider_document_id" text,
	"fiscal_number" text,
	"status" text,
	"signature" text,
	"qr_payload" text,
	"submitted_at" timestamp,
	"responded_at" timestamp,
	"raw_response" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "fiscal_document_doc_type_chk" CHECK ("fiscal_document"."doc_type" IS NULL OR "fiscal_document"."doc_type" IN ('receipt','invoice','credit_note','debit_note')),
	CONSTRAINT "fiscal_document_status_chk" CHECK ("fiscal_document"."status" IS NULL OR "fiscal_document"."status" IN ('pending','submitted','accepted','rejected','cancelled','voided'))
);
--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "vat_registration_number" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "tax_identification_number" text;--> statement-breakpoint
ALTER TABLE "number_block" ADD COLUMN "fiscal_year" integer;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "vat_registration_number" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "tax_identification_number" text;--> statement-breakpoint
-- UNIQUE targets FIRST (must exist before the composite FKs that reference them).
ALTER TABLE "sale" ADD CONSTRAINT "sale_tenant_id_uq" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "number_block" ADD CONSTRAINT "number_block_scoped_uq" UNIQUE NULLS NOT DISTINCT("tenant_id","company_id","location_id","fiscal_year","doc_type","series");--> statement-breakpoint
ALTER TABLE "number_block" ADD CONSTRAINT "number_block_tenant_id_uq" UNIQUE("tenant_id","id");--> statement-breakpoint
-- Composite FKs AFTER their target UNIQUEs (company target is pre-existing from 0013;
-- sale target is the sale_tenant_id_uq created just above).
ALTER TABLE "fiscal_document" ADD CONSTRAINT "fiscal_document_company_composite_fk" FOREIGN KEY ("tenant_id","company_id") REFERENCES "public"."company"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_document" ADD CONSTRAINT "fiscal_document_sale_composite_fk" FOREIGN KEY ("tenant_id","sale_id") REFERENCES "public"."sale"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fiscal_document_tenantId_idx" ON "fiscal_document" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "fiscal_document_saleId_idx" ON "fiscal_document" USING btree ("sale_id");
--> statement-breakpoint
-- Fail-closed RLS for the new tenant-owned table (charter §8/§9; coverage gate).
-- drizzle-kit does NOT emit RLS — hand-added (Phase 3 lesson).
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['fiscal_document'];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I'
      || ' USING (tenant_id = current_setting(''app.tenant_id'', true))'
      || ' WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
      t
    );
  END LOOP;
END
$$;
