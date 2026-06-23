CREATE TABLE "bond_release" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"number" text NOT NULL,
	"bond_receipt_id" uuid NOT NULL,
	"source_location_id" uuid NOT NULL,
	"dest_location_id" uuid NOT NULL,
	"transfer_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" text,
	"approved_by" text,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "bond_release_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "bond_release_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"bond_release_id" uuid NOT NULL,
	"bond_receipt_line_id" uuid NOT NULL,
	"qty" bigint NOT NULL,
	"duty_minor" bigint DEFAULT 0 NOT NULL,
	"tax_minor" bigint DEFAULT 0 NOT NULL,
	"costing_method_applied" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bond_release_line_qty_pos_chk" CHECK ("bond_release_line"."qty" > 0),
	CONSTRAINT "bond_release_line_duty_nonneg_chk" CHECK ("bond_release_line"."duty_minor" >= 0),
	CONSTRAINT "bond_release_line_tax_nonneg_chk" CHECK ("bond_release_line"."tax_minor" >= 0)
);
--> statement-breakpoint
-- Add the (tenant_id, id) composite-FK TARGET on bond_receipt_line BEFORE the
-- bond_release_line FK that references it. drizzle-kit emits the FK before this
-- UNIQUE (no intra-migration FK-after-target-unique ordering — commit-0 lesson),
-- so it is hand-reordered here; applying as generated would fail with
-- "no unique constraint matching given keys".
ALTER TABLE "bond_receipt_line" ADD CONSTRAINT "bond_receipt_line_tenant_id_uq" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "bond_release" ADD CONSTRAINT "bond_release_company_composite_fk" FOREIGN KEY ("tenant_id","company_id") REFERENCES "public"."company"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_release" ADD CONSTRAINT "bond_release_receipt_composite_fk" FOREIGN KEY ("tenant_id","bond_receipt_id") REFERENCES "public"."bond_receipt"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_release" ADD CONSTRAINT "bond_release_source_composite_fk" FOREIGN KEY ("tenant_id","company_id","source_location_id") REFERENCES "public"."location"("tenant_id","company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_release" ADD CONSTRAINT "bond_release_dest_composite_fk" FOREIGN KEY ("tenant_id","company_id","dest_location_id") REFERENCES "public"."location"("tenant_id","company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_release" ADD CONSTRAINT "bond_release_transfer_composite_fk" FOREIGN KEY ("tenant_id","transfer_id") REFERENCES "public"."stock_transfer"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_release_line" ADD CONSTRAINT "bond_release_line_release_composite_fk" FOREIGN KEY ("tenant_id","bond_release_id") REFERENCES "public"."bond_release"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_release_line" ADD CONSTRAINT "bond_release_line_receipt_line_composite_fk" FOREIGN KEY ("tenant_id","bond_receipt_line_id") REFERENCES "public"."bond_receipt_line"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bond_release_tenantId_idx" ON "bond_release" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bond_release_bondReceiptId_idx" ON "bond_release" USING btree ("bond_receipt_id");--> statement-breakpoint
CREATE INDEX "bond_release_line_tenantId_idx" ON "bond_release_line" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bond_release_line_bondReleaseId_idx" ON "bond_release_line" USING btree ("bond_release_id");--> statement-breakpoint
-- Phase 3 commit 5 — fail-closed RLS on bond_release + bond_release_line.
-- Same pattern as every other tenant-owned table: ENABLE + FORCE so even
-- BYPASSRLS roles are excluded, then tenant_isolation policy via the GUC.
-- (drizzle-kit does NOT emit RLS — hand-appended; the tenant-isolation-coverage
-- gate fails if a tenant-owned table lacks this block.)
DO $$ DECLARE
  tbls text[] := ARRAY['bond_release', 'bond_release_line'];
  t text;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      $pol$
      CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.tenant_id', true))
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
      $pol$, t
    );
  END LOOP;
END $$;
