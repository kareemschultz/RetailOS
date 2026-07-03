ALTER TABLE "tax_rate" DROP CONSTRAINT "tax_rate_kind_chk";--> statement-breakpoint
-- FORCE ROW LEVEL SECURITY applies RLS even to the table owner, so a
-- migration connection (retailos_owner/retailos_migrator, deliberately
-- NOBYPASSRLS -- roles.sql) with no app.tenant_id GUC set sees ZERO rows on
-- an RLS-scoped SELECT/UPDATE, even though the physical table has real
-- cross-tenant data. A cross-tenant data-fixup statement MUST temporarily
-- drop FORCE for this table, or it silently updates nothing while later
-- schema validation (CHECK, which is NOT RLS-scoped) still sees every row.
ALTER TABLE "tax_rate" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
UPDATE "tax_rate" SET "kind" = 'standard' WHERE "kind" = 'sales';--> statement-breakpoint
ALTER TABLE "tax_rate" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tax_rate" ALTER COLUMN "kind" SET DEFAULT 'standard';--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "tax_rate_id" uuid;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "tax_rate_id" uuid;--> statement-breakpoint
ALTER TABLE "tax_rate" ADD COLUMN "is_inclusive" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_tax_rate_composite_fk" FOREIGN KEY ("tenant_id","tax_rate_id") REFERENCES "public"."tax_rate"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_tax_rate_composite_fk" FOREIGN KEY ("tenant_id","tax_rate_id") REFERENCES "public"."tax_rate"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate" ADD CONSTRAINT "tax_rate_kind_chk" CHECK ("tax_rate"."kind" IN ('standard','zero','exempt'));