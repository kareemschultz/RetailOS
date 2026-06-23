-- Phase 3 commit 2 — stock transfers (stock_transfer + stock_transfer_line).
-- Two new tenant-owned tables ⇒ fail-closed RLS (ENABLE+FORCE+tenant_isolation) below.

CREATE TABLE "stock_transfer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"number" text NOT NULL,
	"source_location_id" uuid NOT NULL,
	"dest_location_id" uuid NOT NULL,
	"in_transit_location_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"shipped_at" timestamp,
	"expected_receipt_date" date,
	"actual_receipt_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "stock_transfer_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "stock_transfer_tenantId_number_uq" UNIQUE("tenant_id","number"),
	CONSTRAINT "stock_transfer_status_chk" CHECK ("stock_transfer"."status" IN ('draft','shipped','received','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "stock_transfer_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"transfer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku_id" uuid,
	"lot_id" uuid,
	"qty" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "stock_transfer_line_qty_chk" CHECK ("stock_transfer_line"."qty" > 0)
);
--> statement-breakpoint
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_company_fk" FOREIGN KEY ("tenant_id","company_id") REFERENCES "public"."company"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_source_fk" FOREIGN KEY ("tenant_id","company_id","source_location_id") REFERENCES "public"."location"("tenant_id","company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_dest_fk" FOREIGN KEY ("tenant_id","company_id","dest_location_id") REFERENCES "public"."location"("tenant_id","company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_transit_fk" FOREIGN KEY ("tenant_id","company_id","in_transit_location_id") REFERENCES "public"."location"("tenant_id","company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_line" ADD CONSTRAINT "stock_transfer_line_transfer_fk" FOREIGN KEY ("tenant_id","transfer_id") REFERENCES "public"."stock_transfer"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_line" ADD CONSTRAINT "stock_transfer_line_product_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."product"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_line" ADD CONSTRAINT "stock_transfer_line_sku_fk" FOREIGN KEY ("tenant_id","sku_id") REFERENCES "public"."sku"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_line" ADD CONSTRAINT "stock_transfer_line_lot_fk" FOREIGN KEY ("tenant_id","lot_id") REFERENCES "public"."lot"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_transfer_tenantId_idx" ON "stock_transfer" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "stock_transfer_line_tenantId_idx" ON "stock_transfer_line" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "stock_transfer_line_transferId_idx" ON "stock_transfer_line" USING btree ("transfer_id");
--> statement-breakpoint
-- Fail-closed RLS for the new tenant-owned tables (charter §8/§9; coverage gate).
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['stock_transfer', 'stock_transfer_line'];
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
