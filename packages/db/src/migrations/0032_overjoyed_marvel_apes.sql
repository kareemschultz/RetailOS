CREATE TABLE "order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"sale_id" uuid,
	"location_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"number" text,
	"checkout_intent_id" text NOT NULL,
	"total_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"scale" integer DEFAULT 2 NOT NULL,
	"status" text DEFAULT 'payment_pending' NOT NULL,
	"fulfilment_type" text DEFAULT 'pickup' NOT NULL,
	"delivery_address_subject_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "order_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "order_tenant_checkout_intent_uq" UNIQUE("tenant_id","checkout_intent_id"),
	CONSTRAINT "order_status_chk" CHECK ("order"."status" IN ('created','payment_pending','paid','fulfilling','fulfilled','completed','cancelled','unavailable')),
	CONSTRAINT "order_fulfilment_type_chk" CHECK ("order"."fulfilment_type" IN ('pickup','delivery'))
);
--> statement-breakpoint
CREATE TABLE "order_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"order_id" uuid NOT NULL,
	"sale_line_id" uuid,
	"product_id" uuid NOT NULL,
	"sku_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"line_subtotal_minor" bigint NOT NULL,
	"line_tax_minor" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "order_line_qty_positive_chk" CHECK ("order_line"."qty" > 0)
);
--> statement-breakpoint
ALTER TABLE "tender" DROP CONSTRAINT "tender_method_chk";--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_sale_composite_fk" FOREIGN KEY ("tenant_id","sale_id") REFERENCES "public"."sale"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_location_composite_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."location"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_customer_composite_fk" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customer"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_delivery_address_subject_composite_fk" FOREIGN KEY ("tenant_id","delivery_address_subject_id") REFERENCES "public"."pii_vault_subject"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_order_composite_fk" FOREIGN KEY ("tenant_id","order_id") REFERENCES "public"."order"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_sale_line_composite_fk" FOREIGN KEY ("tenant_id","sale_line_id") REFERENCES "public"."sale_line"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_product_composite_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."product"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_sku_composite_fk" FOREIGN KEY ("tenant_id","sku_id") REFERENCES "public"."sku"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_tenantId_idx" ON "order" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "order_customerId_idx" ON "order" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "order_line_tenantId_idx" ON "order_line" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "order_line_orderId_idx" ON "order_line" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "tender" ADD CONSTRAINT "tender_method_chk" CHECK ("tender"."method" IN ('cash','card','bank_transfer','mobile_money','cheque','store_credit','gift_card','online'));--> statement-breakpoint
ALTER TABLE "order" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "order";--> statement-breakpoint
CREATE POLICY tenant_isolation ON "order"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
ALTER TABLE "order_line" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_line" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "order_line";--> statement-breakpoint
CREATE POLICY tenant_isolation ON "order_line"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));