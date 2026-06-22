CREATE TABLE "lot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"sku_id" uuid NOT NULL,
	"lot_number" text NOT NULL,
	"expiry_date" date,
	"manufactured_date" date,
	"status" text DEFAULT 'available' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "lot_tenantId_skuId_lotNumber_uq" UNIQUE("tenant_id","sku_id","lot_number")
);
--> statement-breakpoint
CREATE TABLE "serial" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"sku_id" uuid NOT NULL,
	"lot_id" uuid,
	"serial_number" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "serial_tenantId_serialNumber_uq" UNIQUE("tenant_id","serial_number")
);
--> statement-breakpoint
ALTER TABLE "stock_ledger" ALTER COLUMN "qty_delta" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "stock_ledger" ALTER COLUMN "balance_after" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD COLUMN "lot_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD COLUMN "serial_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD COLUMN "unit_cost_minor" bigint;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD COLUMN "cost_currency" text;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD COLUMN "cost_scale" integer;--> statement-breakpoint
ALTER TABLE "lot" ADD CONSTRAINT "lot_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serial" ADD CONSTRAINT "serial_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serial" ADD CONSTRAINT "serial_lot_id_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lot_tenantId_idx" ON "lot" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "lot_skuId_idx" ON "lot" USING btree ("sku_id");--> statement-breakpoint
CREATE INDEX "lot_expiryDate_idx" ON "lot" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "serial_tenantId_idx" ON "serial" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "serial_skuId_idx" ON "serial" USING btree ("sku_id");--> statement-breakpoint
CREATE INDEX "serial_lotId_idx" ON "serial" USING btree ("lot_id");--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_lot_id_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_serial_id_serial_id_fk" FOREIGN KEY ("serial_id") REFERENCES "public"."serial"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_ledger_lotId_idx" ON "stock_ledger" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "stock_ledger_serialId_idx" ON "stock_ledger" USING btree ("serial_id");
--> statement-breakpoint
ALTER TABLE "lot" ADD CONSTRAINT "lot_status_chk" CHECK ("status" IN ('available', 'quarantined', 'expired', 'depleted'));
--> statement-breakpoint
ALTER TABLE "lot" ADD CONSTRAINT "lot_date_order_chk" CHECK ("manufactured_date" IS NULL OR "expiry_date" IS NULL OR "manufactured_date" <= "expiry_date");
--> statement-breakpoint
ALTER TABLE "serial" ADD CONSTRAINT "serial_status_chk" CHECK ("status" IN ('available', 'sold', 'returned', 'quarantined'));
--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_cost_triplet_chk" CHECK (
  (
    "unit_cost_minor" IS NULL
    AND "cost_currency" IS NULL
    AND "cost_scale" IS NULL
  )
  OR (
    "unit_cost_minor" IS NOT NULL
    AND "cost_currency" IS NOT NULL
    AND "cost_scale" IS NOT NULL
    AND "cost_scale" >= 0
  )
);
--> statement-breakpoint
-- Fail-closed RLS for Phase-2 tracking tables (ADR 0006). Stock ledger already
-- has RLS from VS#1; these are the new tenant-owned tracking tables.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['lot', 'serial'];
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
