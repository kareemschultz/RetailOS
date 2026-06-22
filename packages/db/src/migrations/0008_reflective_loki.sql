CREATE TABLE "reorder_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"sku_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"min_qty" bigint NOT NULL,
	"max_qty" bigint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "reorder_rule_tenantId_sku_location_uq" UNIQUE("tenant_id","sku_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "stock_count" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"scope" text DEFAULT 'cycle' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"posted_at" timestamp,
	"posted_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "stock_count_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"stock_count_id" uuid NOT NULL,
	"sku_id" uuid NOT NULL,
	"lot_id" uuid,
	"counted_qty" bigint NOT NULL,
	"system_qty" bigint,
	"variance_qty" bigint,
	"variance_value_minor" bigint,
	"currency" text,
	"scale" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_count_line_tenant_count_sku_lot_uq" UNIQUE NULLS NOT DISTINCT ("tenant_id","stock_count_id","sku_id","lot_id")
);
--> statement-breakpoint
CREATE TABLE "bom" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "bom_tenantId_productId_name_uq" UNIQUE("tenant_id","product_id","name")
);
--> statement-breakpoint
CREATE TABLE "bom_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"bom_id" uuid NOT NULL,
	"component_sku_id" uuid NOT NULL,
	"qty_base" bigint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bom_line_tenantId_bom_component_uq" UNIQUE("tenant_id","bom_id","component_sku_id")
);
--> statement-breakpoint
CREATE TABLE "bundle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "bundle_tenantId_productId_uq" UNIQUE("tenant_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "reorder_rule" ADD CONSTRAINT "reorder_rule_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reorder_rule" ADD CONSTRAINT "reorder_rule_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count" ADD CONSTRAINT "stock_count_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_line" ADD CONSTRAINT "stock_count_line_stock_count_id_stock_count_id_fk" FOREIGN KEY ("stock_count_id") REFERENCES "public"."stock_count"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_line" ADD CONSTRAINT "stock_count_line_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_line" ADD CONSTRAINT "stock_count_line_lot_id_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom" ADD CONSTRAINT "bom_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_line" ADD CONSTRAINT "bom_line_bom_id_bom_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."bom"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_line" ADD CONSTRAINT "bom_line_component_sku_id_sku_id_fk" FOREIGN KEY ("component_sku_id") REFERENCES "public"."sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle" ADD CONSTRAINT "bundle_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reorder_rule_tenantId_idx" ON "reorder_rule" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "reorder_rule_sku_location_idx" ON "reorder_rule" USING btree ("sku_id","location_id");--> statement-breakpoint
CREATE INDEX "stock_count_tenantId_idx" ON "stock_count" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "stock_count_locationId_idx" ON "stock_count" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "stock_count_line_tenantId_idx" ON "stock_count_line" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "stock_count_line_stockCountId_idx" ON "stock_count_line" USING btree ("stock_count_id");--> statement-breakpoint
CREATE INDEX "stock_count_line_skuId_idx" ON "stock_count_line" USING btree ("sku_id");--> statement-breakpoint
CREATE INDEX "bom_tenantId_idx" ON "bom" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bom_productId_idx" ON "bom" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "bom_line_tenantId_idx" ON "bom_line" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bom_line_bomId_idx" ON "bom_line" USING btree ("bom_id");--> statement-breakpoint
CREATE INDEX "bom_line_componentSkuId_idx" ON "bom_line" USING btree ("component_sku_id");--> statement-breakpoint
CREATE INDEX "bundle_tenantId_idx" ON "bundle" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bundle_productId_idx" ON "bundle" USING btree ("product_id");
--> statement-breakpoint
ALTER TABLE "reorder_rule" ADD CONSTRAINT "reorder_rule_min_max_chk" CHECK ("min_qty" >= 0 AND "max_qty" >= 0 AND "min_qty" <= "max_qty");
--> statement-breakpoint
ALTER TABLE "stock_count" ADD CONSTRAINT "stock_count_scope_chk" CHECK ("scope" IN ('full', 'cycle', 'zone'));
--> statement-breakpoint
ALTER TABLE "stock_count" ADD CONSTRAINT "stock_count_status_chk" CHECK ("status" IN ('draft', 'started', 'posted', 'void'));
--> statement-breakpoint
ALTER TABLE "stock_count" ADD CONSTRAINT "stock_count_posted_at_chk" CHECK (("status" <> 'posted') OR "posted_at" IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "stock_count_line" ADD CONSTRAINT "stock_count_line_counted_qty_chk" CHECK ("counted_qty" >= 0);
--> statement-breakpoint
ALTER TABLE "stock_count_line" ADD CONSTRAINT "stock_count_line_value_triplet_chk" CHECK (
  (
    "variance_value_minor" IS NULL
    AND "currency" IS NULL
    AND "scale" IS NULL
  )
  OR (
    "variance_value_minor" IS NOT NULL
    AND "currency" IS NOT NULL
    AND "scale" IS NOT NULL
    AND "scale" >= 0
  )
);
--> statement-breakpoint
ALTER TABLE "bom" ADD CONSTRAINT "bom_status_chk" CHECK ("status" IN ('active', 'draft', 'archived'));
--> statement-breakpoint
ALTER TABLE "bom_line" ADD CONSTRAINT "bom_line_qty_chk" CHECK ("qty_base" > 0);
--> statement-breakpoint
-- Fail-closed RLS for Phase-2 reorder/count/BOM tables (ADR 0006).
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'reorder_rule', 'stock_count', 'stock_count_line',
    'bundle', 'bom', 'bom_line'
  ];
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
