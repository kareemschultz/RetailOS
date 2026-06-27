CREATE TABLE "number_lease" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"number_block_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"location_id" uuid,
	"fiscal_year" integer,
	"doc_type" text NOT NULL,
	"series" text DEFAULT 'default' NOT NULL,
	"terminal_id" text NOT NULL,
	"device_id" text,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"range_start" integer NOT NULL,
	"range_end" integer NOT NULL,
	"next_number" integer NOT NULL,
	"consumed_through" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"exhausted_at" timestamp,
	"reclaimed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "number_lease_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "number_lease_idempotency_uq" UNIQUE("tenant_id","idempotency_key"),
	CONSTRAINT "number_lease_status_chk" CHECK ("number_lease"."status" IN ('active','exhausted','expired','reclaimed','voided')),
	CONSTRAINT "number_lease_range_chk" CHECK ("number_lease"."range_end" >= "number_lease"."range_start"),
	CONSTRAINT "number_lease_next_chk" CHECK ("number_lease"."next_number" >= "number_lease"."range_start" AND "number_lease"."next_number" - 1 <= "number_lease"."range_end"),
	CONSTRAINT "number_lease_consumed_chk" CHECK ("number_lease"."consumed_through" IS NULL OR ("number_lease"."consumed_through" >= "number_lease"."range_start" - 1 AND "number_lease"."consumed_through" <= "number_lease"."range_end"))
);
--> statement-breakpoint
CREATE TABLE "number_lease_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"lease_id" uuid NOT NULL,
	"number_block_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"location_id" uuid,
	"fiscal_year" integer,
	"doc_type" text NOT NULL,
	"series" text DEFAULT 'default' NOT NULL,
	"number" integer NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"source_type" text,
	"source_id" uuid,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "number_lease_usage_number_uq" UNIQUE("tenant_id","number_block_id","number"),
	CONSTRAINT "number_lease_usage_status_chk" CHECK ("number_lease_usage"."status" IN ('consumed','skipped','voided'))
);
--> statement-breakpoint
ALTER TABLE "number_lease" ADD CONSTRAINT "number_lease_block_composite_fk" FOREIGN KEY ("tenant_id","number_block_id") REFERENCES "public"."number_block"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_lease" ADD CONSTRAINT "number_lease_company_composite_fk" FOREIGN KEY ("tenant_id","company_id") REFERENCES "public"."company"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_lease" ADD CONSTRAINT "number_lease_location_composite_fk" FOREIGN KEY ("tenant_id","company_id","location_id") REFERENCES "public"."location"("tenant_id","company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_lease_usage" ADD CONSTRAINT "number_lease_usage_lease_composite_fk" FOREIGN KEY ("tenant_id","lease_id") REFERENCES "public"."number_lease"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_lease_usage" ADD CONSTRAINT "number_lease_usage_block_composite_fk" FOREIGN KEY ("tenant_id","number_block_id") REFERENCES "public"."number_block"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_lease_usage" ADD CONSTRAINT "number_lease_usage_company_composite_fk" FOREIGN KEY ("tenant_id","company_id") REFERENCES "public"."company"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_lease_usage" ADD CONSTRAINT "number_lease_usage_location_composite_fk" FOREIGN KEY ("tenant_id","company_id","location_id") REFERENCES "public"."location"("tenant_id","company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "number_lease_tenantId_idx" ON "number_lease" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "number_lease_numberBlockId_idx" ON "number_lease" USING btree ("number_block_id");--> statement-breakpoint
CREATE INDEX "number_lease_terminal_idx" ON "number_lease" USING btree ("tenant_id","terminal_id");--> statement-breakpoint
CREATE INDEX "number_lease_usage_tenantId_idx" ON "number_lease_usage" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "number_lease_usage_leaseId_idx" ON "number_lease_usage" USING btree ("lease_id");
--> statement-breakpoint
-- Database backstop for the allocator invariant. The service locks and advances
-- number_block.next, but this trigger rejects overlapping ranges even if a
-- future write path tries to insert a lease directly.
CREATE OR REPLACE FUNCTION number_lease_prevent_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('number_lease:' || NEW.tenant_id || ':' || NEW.number_block_id::text, 0)
  );

  -- int8range with explicit bigint casts so `range_end + 1` cannot overflow int4
  -- even if a lease row carries an int4-max ceiling (e.g. a block created by the
  -- legacy count-based allocator). The backstop must never raise "integer out of
  -- range"; it must cleanly accept or reject.
  IF EXISTS (
    SELECT 1
    FROM number_lease existing
    WHERE existing.tenant_id = NEW.tenant_id
      AND existing.number_block_id = NEW.number_block_id
      AND existing.id <> NEW.id
      AND int8range(existing.range_start::bigint, existing.range_end::bigint + 1, '[)')
        && int8range(NEW.range_start::bigint, NEW.range_end::bigint + 1, '[)')
  ) THEN
    RAISE EXCEPTION 'number lease range overlaps existing lease'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER number_lease_prevent_overlap_trg
BEFORE INSERT OR UPDATE OF tenant_id, number_block_id, range_start, range_end
ON number_lease
FOR EACH ROW
EXECUTE FUNCTION number_lease_prevent_overlap();
--> statement-breakpoint
-- Fail-closed RLS for the new tenant-owned tables (charter §8/§9; coverage gate).
-- drizzle-kit does NOT emit RLS — hand-added (Phase 3 lesson).
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['number_lease', 'number_lease_usage'];
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
