CREATE TABLE "cart" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cart_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "cart_status_chk" CHECK ("cart"."status" IN ('active','converted','abandoned'))
);
--> statement-breakpoint
CREATE TABLE "cart_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"cart_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku_id" uuid,
	"qty" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cart_line_tenant_cart_product_sku_uq" UNIQUE NULLS NOT DISTINCT("tenant_id","cart_id","product_id","sku_id"),
	CONSTRAINT "cart_line_qty_positive_chk" CHECK ("cart_line"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"pii_subject_id" uuid,
	"is_guest" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "pii_vault_field" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"field_key" text NOT NULL,
	"ciphertext" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pii_vault_field_tenant_subject_key_uq" UNIQUE("tenant_id","subject_id","field_key")
);
--> statement-breakpoint
CREATE TABLE "pii_vault_subject" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"wrapped_dek" text,
	"erased_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "pii_vault_subject_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_customer_composite_fk" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customer"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_line" ADD CONSTRAINT "cart_line_cart_composite_fk" FOREIGN KEY ("tenant_id","cart_id") REFERENCES "public"."cart"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_line" ADD CONSTRAINT "cart_line_product_composite_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."product"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_line" ADD CONSTRAINT "cart_line_sku_composite_fk" FOREIGN KEY ("tenant_id","sku_id") REFERENCES "public"."sku"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_pii_subject_composite_fk" FOREIGN KEY ("tenant_id","pii_subject_id") REFERENCES "public"."pii_vault_subject"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pii_vault_field" ADD CONSTRAINT "pii_vault_field_subject_composite_fk" FOREIGN KEY ("tenant_id","subject_id") REFERENCES "public"."pii_vault_subject"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cart_tenantId_idx" ON "cart" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cart_customerId_idx" ON "cart" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "cart_line_tenantId_idx" ON "cart_line" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cart_line_cartId_idx" ON "cart_line" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "customer_tenantId_idx" ON "customer" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "pii_vault_field_tenantId_idx" ON "pii_vault_field" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "pii_vault_subject_tenantId_idx" ON "pii_vault_subject" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "cart" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cart" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "cart";--> statement-breakpoint
CREATE POLICY tenant_isolation ON "cart"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
ALTER TABLE "cart_line" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cart_line" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "cart_line";--> statement-breakpoint
CREATE POLICY tenant_isolation ON "cart_line"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
ALTER TABLE "customer" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "customer";--> statement-breakpoint
CREATE POLICY tenant_isolation ON "customer"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
ALTER TABLE "pii_vault_field" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pii_vault_field" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "pii_vault_field";--> statement-breakpoint
CREATE POLICY tenant_isolation ON "pii_vault_field"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
ALTER TABLE "pii_vault_subject" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pii_vault_subject" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "pii_vault_subject";--> statement-breakpoint
CREATE POLICY tenant_isolation ON "pii_vault_subject"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));