CREATE TABLE "tax_rate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'sales' NOT NULL,
	"rate_bps" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "tax_rate_tenantId_code_uq" UNIQUE("tenant_id","code"),
	CONSTRAINT "tax_rate_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "tax_rate_kind_chk" CHECK ("tax_rate"."kind" IN ('sales')),
	CONSTRAINT "tax_rate_bps_chk" CHECK ("tax_rate"."rate_bps" >= 0 AND "tax_rate"."rate_bps" <= 10000),
	CONSTRAINT "tax_rate_effective_window_chk" CHECK ("tax_rate"."effective_to" IS NULL OR "tax_rate"."effective_from" IS NULL OR "tax_rate"."effective_to" > "tax_rate"."effective_from")
);
--> statement-breakpoint
CREATE INDEX "tax_rate_tenantId_idx" ON "tax_rate" USING btree ("tenant_id");
--> statement-breakpoint
ALTER TABLE "tax_rate" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tax_rate" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_tax_rate" ON "tax_rate" USING ("tenant_id" = current_setting('app.tenant_id', true)) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));