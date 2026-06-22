CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"actor_user_id" text,
	"impersonator_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"request_id" text,
	"correlation_id" text,
	"idempotency_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'store' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "stock_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"movement_type" text NOT NULL,
	"qty_delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"ref_type" text,
	"ref_id" uuid,
	"idempotency_key" text,
	"server_ts" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "number_block" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"location_id" uuid,
	"doc_type" text NOT NULL,
	"series" text DEFAULT 'default' NOT NULL,
	"range_start" integer NOT NULL,
	"range_end" integer NOT NULL,
	"next" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "number_block_uq" UNIQUE("tenant_id","company_id","doc_type","series")
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "outbox_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"type" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"correlation_id" text,
	"request_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"price_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"scale" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "product_tenantId_sku_uq" UNIQUE("tenant_id","sku")
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"sale_id" uuid NOT NULL,
	"number" text NOT NULL,
	"total_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"scale" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"number" text NOT NULL,
	"total_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"scale" integer DEFAULT 2 NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "sale_tenantId_idempotencyKey_uq" UNIQUE("tenant_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "sale_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_block" ADD CONSTRAINT "number_block_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_block" ADD CONSTRAINT "number_block_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_tenantId_idx" ON "audit_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "company_tenantId_idx" ON "company" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "location_tenantId_idx" ON "location" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "location_companyId_idx" ON "location" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "stock_ledger_tenantId_idx" ON "stock_ledger" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "stock_ledger_location_product_idx" ON "stock_ledger" USING btree ("location_id","product_id");--> statement-breakpoint
CREATE INDEX "membership_tenantId_idx" ON "membership" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "membership_userId_idx" ON "membership" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "number_block_tenantId_idx" ON "number_block" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "outbox_event_tenantId_idx" ON "outbox_event" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "outbox_event_status_idx" ON "outbox_event" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_tenantId_idx" ON "product" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "invoice_tenantId_idx" ON "invoice" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sale_tenantId_idx" ON "sale" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sale_line_saleId_idx" ON "sale_line" USING btree ("sale_id");