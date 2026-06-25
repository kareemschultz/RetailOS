CREATE TABLE "cash_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"shift_id" uuid NOT NULL,
	"type" text NOT NULL,
	"currency" text NOT NULL,
	"scale" integer DEFAULT 2 NOT NULL,
	"amount_minor" bigint NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "cash_movement_type_chk" CHECK ("cash_movement"."type" IN ('open_float','pay_in','pay_out','drop','close_count')),
	CONSTRAINT "cash_movement_amount_chk" CHECK ("cash_movement"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "shift" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"terminal_id" text NOT NULL,
	"cashier_user_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"z_report_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "shift_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "shift_status_chk" CHECK ("shift"."status" IN ('open','closed'))
);
--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "shift_enforcement" text;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "blind_close" text;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "cash_drawer" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "shift_enforcement" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "blind_close" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "cash_drawer" text;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_shift_enforcement_chk" CHECK ("location"."shift_enforcement" IN ('required','optional','disabled'));--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_blind_close_chk" CHECK ("location"."blind_close" IN ('on','off'));--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_cash_drawer_chk" CHECK ("location"."cash_drawer" IN ('on','off'));--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_shift_enforcement_chk" CHECK ("organization"."shift_enforcement" IN ('required','optional','disabled'));--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_blind_close_chk" CHECK ("organization"."blind_close" IN ('on','off'));--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_cash_drawer_chk" CHECK ("organization"."cash_drawer" IN ('on','off'));--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_shift_composite_fk" FOREIGN KEY ("tenant_id","shift_id") REFERENCES "public"."shift"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_location_composite_fk" FOREIGN KEY ("tenant_id","company_id","location_id") REFERENCES "public"."location"("tenant_id","company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_company_fk" FOREIGN KEY ("tenant_id","company_id") REFERENCES "public"."company"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_movement_tenantId_idx" ON "cash_movement" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cash_movement_shiftId_idx" ON "cash_movement" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "shift_tenantId_idx" ON "shift" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "shift_locationId_idx" ON "shift" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_one_open_per_terminal_uq" ON "shift" USING btree ("tenant_id","terminal_id") WHERE status = 'open';--> statement-breakpoint
-- Phase 4 commit 4 — Configurable Cash Control. Expand-only: two new tenant-
-- owned tables (shift, cash_movement) + nullable cash-control toggle columns on
-- organization/location (NULL ⇒ resolve to the platform default). No drops, no
-- NOT-NULL retrofits, no type changes. FK targets all pre-exist (shift's
-- (tenant_id,id) UNIQUE is inline above; location's (tenant_id,company_id,id)
-- and company's (tenant_id,id) from 0012), so no FK-before-unique reordering is
-- needed. `sale.shift_id` already exists (0018) — wired in code, not schema.
--
-- Fail-closed RLS for the new tenant-owned tables (charter §8/§9; coverage gate).
-- drizzle-kit does NOT emit RLS — hand-added (Phase 3 lesson).
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['shift', 'cash_movement'];
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