CREATE TABLE "product_image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"object_key" text,
	"alt_text" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "product_image_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_product_composite_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."product"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_image_tenantId_idx" ON "product_image" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "product_image_productId_idx" ON "product_image" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_image_primary_uq" ON "product_image" USING btree ("tenant_id","product_id") WHERE "product_image"."is_primary" = true AND "product_image"."deleted_at" IS NULL;
--> statement-breakpoint
-- Fail-closed RLS for product media (charter §8/§9; coverage gate).
-- drizzle-kit does NOT emit RLS — hand-added.
ALTER TABLE "product_image" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "product_image" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "product_image";
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "product_image"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
