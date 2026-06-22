CREATE TABLE "avg_cost" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"sku_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"total_value_minor" bigint DEFAULT 0 NOT NULL,
	"qty_on_hand" bigint DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"scale" integer DEFAULT 2 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "avg_cost_tenantId_sku_location_uq" UNIQUE("tenant_id","sku_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "valuation_layer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"sku_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"seq" integer NOT NULL,
	"qty_remaining" bigint NOT NULL,
	"unit_cost_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"scale" integer DEFAULT 2 NOT NULL,
	"source_movement_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "valuation_layer_sourceMovementId_uq" UNIQUE("tenant_id","source_movement_id")
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "costing_method" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "barcode_parser_config" jsonb;--> statement-breakpoint
ALTER TABLE "avg_cost" ADD CONSTRAINT "avg_cost_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avg_cost" ADD CONSTRAINT "avg_cost_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_layer" ADD CONSTRAINT "valuation_layer_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_layer" ADD CONSTRAINT "valuation_layer_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_layer" ADD CONSTRAINT "valuation_layer_source_movement_id_stock_ledger_id_fk" FOREIGN KEY ("source_movement_id") REFERENCES "public"."stock_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "avg_cost_tenantId_idx" ON "avg_cost" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "avg_cost_sku_location_idx" ON "avg_cost" USING btree ("sku_id","location_id");--> statement-breakpoint
CREATE INDEX "valuation_layer_tenantId_idx" ON "valuation_layer" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "valuation_layer_consume_idx" ON "valuation_layer" USING btree ("tenant_id","sku_id","location_id","received_at","seq");
--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_costing_method_chk" CHECK ("costing_method" IS NULL OR "costing_method" IN ('avco', 'fifo'));
--> statement-breakpoint
ALTER TABLE "avg_cost" ADD CONSTRAINT "avg_cost_scale_chk" CHECK ("scale" >= 0);
--> statement-breakpoint
ALTER TABLE "avg_cost" ADD CONSTRAINT "avg_cost_zero_qty_zero_value_chk" CHECK ("qty_on_hand" <> 0 OR "total_value_minor" = 0);
--> statement-breakpoint
ALTER TABLE "valuation_layer" ADD CONSTRAINT "valuation_layer_qty_remaining_chk" CHECK ("qty_remaining" >= 0);
--> statement-breakpoint
ALTER TABLE "valuation_layer" ADD CONSTRAINT "valuation_layer_cost_chk" CHECK ("unit_cost_minor" >= 0 AND "scale" >= 0 AND "seq" >= 0);
--> statement-breakpoint
-- Fail-closed RLS for Phase-2 costing projection tables (ADR 0006).
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['avg_cost', 'valuation_layer'];
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
