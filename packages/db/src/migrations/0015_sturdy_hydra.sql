CREATE TABLE "bond_receipt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"number" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"supplier_ref" text,
	"customs_reference" text,
	"landed_cost_reference" text,
	"received_at" timestamp,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "bond_receipt_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "bond_receipt_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"bond_receipt_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku_id" uuid NOT NULL,
	"lot_id" uuid,
	"qty" bigint NOT NULL,
	"unit_cost_minor" bigint NOT NULL,
	"cost_currency" text NOT NULL,
	"cost_scale" bigint NOT NULL,
	"customs_reference" text,
	"landed_cost_reference" text,
	"costing_method_applied" text NOT NULL,
	"movement_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bond_receipt_line_movementId_uq" UNIQUE("tenant_id","movement_id"),
	CONSTRAINT "bond_receipt_line_cost_pos_chk" CHECK ("bond_receipt_line"."unit_cost_minor" > 0),
	CONSTRAINT "bond_receipt_line_qty_pos_chk" CHECK ("bond_receipt_line"."qty" > 0)
);
--> statement-breakpoint
ALTER TABLE "bond_receipt" ADD CONSTRAINT "bond_receipt_company_composite_fk" FOREIGN KEY ("tenant_id","company_id") REFERENCES "public"."company"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_receipt" ADD CONSTRAINT "bond_receipt_location_composite_fk" FOREIGN KEY ("tenant_id","company_id","location_id") REFERENCES "public"."location"("tenant_id","company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_receipt_line" ADD CONSTRAINT "bond_receipt_line_receipt_composite_fk" FOREIGN KEY ("tenant_id","bond_receipt_id") REFERENCES "public"."bond_receipt"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_receipt_line" ADD CONSTRAINT "bond_receipt_line_product_composite_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."product"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_receipt_line" ADD CONSTRAINT "bond_receipt_line_sku_composite_fk" FOREIGN KEY ("tenant_id","sku_id") REFERENCES "public"."sku"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_receipt_line" ADD CONSTRAINT "bond_receipt_line_lot_composite_fk" FOREIGN KEY ("tenant_id","lot_id") REFERENCES "public"."lot"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_receipt_line" ADD CONSTRAINT "bond_receipt_line_movement_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."stock_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bond_receipt_tenantId_idx" ON "bond_receipt" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bond_receipt_locationId_idx" ON "bond_receipt" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "bond_receipt_line_tenantId_idx" ON "bond_receipt_line" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bond_receipt_line_bondReceiptId_idx" ON "bond_receipt_line" USING btree ("bond_receipt_id");--> statement-breakpoint
CREATE INDEX "bond_receipt_line_skuId_idx" ON "bond_receipt_line" USING btree ("sku_id");--> statement-breakpoint
-- Phase 3 commit 4 — fail-closed RLS on bond_receipt + bond_receipt_line.
-- Same pattern as every other tenant-owned table: ENABLE + FORCE so even
-- BYPASSRLS roles are excluded, then tenant_isolation policy via the GUC.
-- (drizzle-kit does NOT emit RLS — hand-appended; the tenant-isolation-coverage
-- gate fails if a tenant-owned table lacks this block.)
DO $$ DECLARE
  tbls text[] := ARRAY['bond_receipt', 'bond_receipt_line'];
  t text;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      $pol$
      CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.tenant_id', true))
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
      $pol$, t
    );
  END LOOP;
END $$;