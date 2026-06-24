CREATE TABLE "tender" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"sale_id" uuid NOT NULL,
	"method" text NOT NULL,
	"currency" text NOT NULL,
	"scale" integer DEFAULT 2 NOT NULL,
	"amount_minor" bigint NOT NULL,
	"change_minor" bigint,
	"settled_amount_minor" bigint,
	"fx_rate_to_sale" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "tender_method_chk" CHECK ("tender"."method" IN ('cash','card','bank_transfer','mobile_money','cheque','store_credit','gift_card')),
	CONSTRAINT "tender_amount_chk" CHECK ("tender"."amount_minor" >= 0),
	CONSTRAINT "tender_change_chk" CHECK ("tender"."change_minor" IS NULL OR "tender"."change_minor" >= 0),
	CONSTRAINT "tender_settled_chk" CHECK ("tender"."settled_amount_minor" IS NULL OR "tender"."settled_amount_minor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "sale_type" text DEFAULT 'sale';--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "original_sale_id" uuid;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "subtotal_minor" bigint;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "discount_minor" bigint;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "tax_minor" bigint;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "shift_id" uuid;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "sales_rep_id" text;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "sale_line" ADD COLUMN "sku_id" uuid;--> statement-breakpoint
ALTER TABLE "sale_line" ADD COLUMN "lot_id" uuid;--> statement-breakpoint
ALTER TABLE "sale_line" ADD COLUMN "qty_base" bigint;--> statement-breakpoint
ALTER TABLE "sale_line" ADD COLUMN "qty_scale" integer;--> statement-breakpoint
ALTER TABLE "sale_line" ADD COLUMN "line_discount_minor" bigint;--> statement-breakpoint
ALTER TABLE "sale_line" ADD COLUMN "line_tax_minor" bigint;--> statement-breakpoint
ALTER TABLE "sale_line" ADD COLUMN "tax_rate_id" uuid;--> statement-breakpoint
ALTER TABLE "sale_line" ADD COLUMN "cogs_minor" bigint;--> statement-breakpoint
ALTER TABLE "sale_line" ADD COLUMN "cogs_currency" text;--> statement-breakpoint
ALTER TABLE "sale_line" ADD COLUMN "cogs_scale" integer;--> statement-breakpoint
ALTER TABLE "sale_line" ADD COLUMN "costing_method_applied" text;--> statement-breakpoint
ALTER TABLE "tender" ADD CONSTRAINT "tender_sale_composite_fk" FOREIGN KEY ("tenant_id","sale_id") REFERENCES "public"."sale"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tender_tenantId_idx" ON "tender" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tender_saleId_idx" ON "tender" USING btree ("sale_id");--> statement-breakpoint
ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_sku_composite_fk" FOREIGN KEY ("tenant_id","sku_id") REFERENCES "public"."sku"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_lot_composite_fk" FOREIGN KEY ("tenant_id","lot_id") REFERENCES "public"."lot"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sale_line_skuId_idx" ON "sale_line" USING btree ("sku_id");--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_sale_type_chk" CHECK ("sale"."sale_type" IN ('sale','return','exchange'));--> statement-breakpoint
-- Phase 4 commit 2 — Minimum Sellable POS. Expand-only: extends sale/sale_line
-- (SKU/lot identity, base-unit qty, line tax/discount, the COGS stamp written by
-- applyValuation #8) and adds the `tender` table. Every sale/sale_line addition
-- is NULLABLE — including `sale_type` (a NOT-NULL retrofit on the existing table
-- is deferred to a later contract migration after backfill; the DEFAULT 'sale' +
-- CHECK hold the shape now). `tender` carries change/settled >= 0 CHECKs so
-- impossible tender math is rejected at the DB. Composite FKs reference
-- (tenant_id, id) targets that already exist (sale: 0017; sku/lot: Phase-3
-- commit 0), so no FK-before-unique reordering is needed within this migration.
--
-- Fail-closed RLS for the new tenant-owned `tender` table (charter §8/§9;
-- coverage gate). drizzle-kit does NOT emit RLS — hand-added (Phase 3 lesson).
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['tender'];
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