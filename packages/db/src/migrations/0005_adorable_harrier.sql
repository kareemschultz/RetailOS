CREATE TABLE "barcode" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"sku_id" uuid NOT NULL,
	"value" text NOT NULL,
	"symbology" text DEFAULT 'ean13' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "barcode_tenantId_value_uq" UNIQUE("tenant_id","value")
);
--> statement-breakpoint
CREATE TABLE "brand" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "brand_tenantId_code_uq" UNIQUE("tenant_id","code")
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"parent_category_id" uuid,
	"name" text NOT NULL,
	"code" text,
	"costing_method" text,
	"tracking_mode" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "category_tenantId_code_uq" UNIQUE("tenant_id","code")
);
--> statement-breakpoint
CREATE TABLE "sku" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text,
	"base_uom_id" uuid,
	"costing_method" text,
	"tracking_mode" text DEFAULT 'none' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "sku_tenantId_code_uq" UNIQUE("tenant_id","code")
);
--> statement-breakpoint
CREATE TABLE "unit_of_measure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'count' NOT NULL,
	"decimal_scale" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "unit_of_measure_tenantId_code_uq" UNIQUE("tenant_id","code")
);
--> statement-breakpoint
CREATE TABLE "uom_conversion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"category_id" uuid,
	"product_id" uuid,
	"sku_id" uuid,
	"from_uom_id" uuid NOT NULL,
	"to_uom_id" uuid NOT NULL,
	"role" text NOT NULL,
	"factor" integer NOT NULL,
	"factor_scale" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "uom_conversion_tenant_scope_role_uq" UNIQUE NULLS NOT DISTINCT ("tenant_id","category_id","product_id","sku_id","from_uom_id","to_uom_id","role")
);
--> statement-breakpoint
CREATE TABLE "variant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "variant_tenantId_product_name_value_uq" UNIQUE("tenant_id","product_id","name","value")
);
--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "base_uom_id" uuid;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "costing_method" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "tracking_mode" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "barcode" ADD CONSTRAINT "barcode_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sku" ADD CONSTRAINT "sku_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sku" ADD CONSTRAINT "sku_base_uom_id_unit_of_measure_id_fk" FOREIGN KEY ("base_uom_id") REFERENCES "public"."unit_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uom_conversion" ADD CONSTRAINT "uom_conversion_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uom_conversion" ADD CONSTRAINT "uom_conversion_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uom_conversion" ADD CONSTRAINT "uom_conversion_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uom_conversion" ADD CONSTRAINT "uom_conversion_from_uom_id_unit_of_measure_id_fk" FOREIGN KEY ("from_uom_id") REFERENCES "public"."unit_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uom_conversion" ADD CONSTRAINT "uom_conversion_to_uom_id_unit_of_measure_id_fk" FOREIGN KEY ("to_uom_id") REFERENCES "public"."unit_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant" ADD CONSTRAINT "variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "barcode_tenantId_idx" ON "barcode" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "barcode_skuId_idx" ON "barcode" USING btree ("sku_id");--> statement-breakpoint
CREATE INDEX "brand_tenantId_idx" ON "brand" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "category_tenantId_idx" ON "category" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "category_parentCategoryId_idx" ON "category" USING btree ("parent_category_id");--> statement-breakpoint
CREATE INDEX "sku_tenantId_idx" ON "sku" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sku_productId_idx" ON "sku" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "sku_baseUomId_idx" ON "sku" USING btree ("base_uom_id");--> statement-breakpoint
CREATE INDEX "unit_of_measure_tenantId_idx" ON "unit_of_measure" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "uom_conversion_tenantId_idx" ON "uom_conversion" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "uom_conversion_categoryId_idx" ON "uom_conversion" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "uom_conversion_productId_idx" ON "uom_conversion" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "uom_conversion_skuId_idx" ON "uom_conversion" USING btree ("sku_id");--> statement-breakpoint
CREATE INDEX "variant_tenantId_idx" ON "variant" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "variant_productId_idx" ON "variant" USING btree ("product_id");--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_base_uom_id_unit_of_measure_id_fk" FOREIGN KEY ("base_uom_id") REFERENCES "public"."unit_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_categoryId_idx" ON "product" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_brandId_idx" ON "product" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "product_baseUomId_idx" ON "product" USING btree ("base_uom_id");
--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_costing_method_chk" CHECK ("costing_method" IS NULL OR "costing_method" IN ('avco', 'fifo'));
--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_tracking_mode_chk" CHECK ("tracking_mode" IS NULL OR "tracking_mode" IN ('none', 'lot', 'serial'));
--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_costing_method_chk" CHECK ("costing_method" IS NULL OR "costing_method" IN ('avco', 'fifo'));
--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_tracking_mode_chk" CHECK ("tracking_mode" IN ('none', 'lot', 'serial'));
--> statement-breakpoint
ALTER TABLE "sku" ADD CONSTRAINT "sku_costing_method_chk" CHECK ("costing_method" IS NULL OR "costing_method" IN ('avco', 'fifo'));
--> statement-breakpoint
ALTER TABLE "sku" ADD CONSTRAINT "sku_tracking_mode_chk" CHECK ("tracking_mode" IN ('none', 'lot', 'serial'));
--> statement-breakpoint
ALTER TABLE "unit_of_measure" ADD CONSTRAINT "unit_of_measure_kind_chk" CHECK ("kind" IN ('count', 'weight', 'volume', 'length'));
--> statement-breakpoint
ALTER TABLE "unit_of_measure" ADD CONSTRAINT "unit_of_measure_decimal_scale_chk" CHECK ("decimal_scale" >= 0);
--> statement-breakpoint
ALTER TABLE "barcode" ADD CONSTRAINT "barcode_symbology_chk" CHECK ("symbology" IN ('ean13', 'upca', 'ean8', 'code128', 'gs1', 'qr'));
--> statement-breakpoint
ALTER TABLE "uom_conversion" ADD CONSTRAINT "uom_conversion_role_chk" CHECK ("role" IN ('purchase', 'stock', 'sale', 'reporting'));
--> statement-breakpoint
ALTER TABLE "uom_conversion" ADD CONSTRAINT "uom_conversion_factor_chk" CHECK ("factor" > 0 AND "factor_scale" >= 0);
--> statement-breakpoint
ALTER TABLE "uom_conversion" ADD CONSTRAINT "uom_conversion_distinct_uom_chk" CHECK ("from_uom_id" <> "to_uom_id");
--> statement-breakpoint
ALTER TABLE "uom_conversion" ADD CONSTRAINT "uom_conversion_scope_chk" CHECK (num_nonnulls("category_id", "product_id", "sku_id") <= 1);
--> statement-breakpoint
-- Fail-closed RLS for Phase-2 catalog tables (ADR 0006). Product already has
-- RLS from VS#1; these are the new tenant-owned catalog tables from Commit 1.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'category', 'brand', 'variant', 'sku', 'barcode',
    'unit_of_measure', 'uom_conversion'
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
