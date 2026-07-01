CREATE TABLE "offline_sync_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"terminal_row_id" uuid NOT NULL,
	"terminal_id" text NOT NULL,
	"device_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload_hash" text NOT NULL,
	"mutation_count" bigint NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "offline_sync_batch_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "offline_sync_batch_idempotency_uq" UNIQUE("tenant_id","idempotency_key"),
	CONSTRAINT "offline_sync_batch_status_chk" CHECK ("offline_sync_batch"."status" IN ('received','accepted','partially_rejected','rejected')),
	CONSTRAINT "offline_sync_batch_count_chk" CHECK ("offline_sync_batch"."mutation_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "offline_sync_mutation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"batch_id" uuid NOT NULL,
	"terminal_row_id" uuid NOT NULL,
	"terminal_id" text NOT NULL,
	"device_id" text NOT NULL,
	"monotonic_counter" bigint NOT NULL,
	"mutation_id" text NOT NULL,
	"mutation_type" text NOT NULL,
	"payload_version" text NOT NULL,
	"payload_hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"client_created_at" timestamp,
	"replay_status" text DEFAULT 'new' NOT NULL,
	"upcast_status" text DEFAULT 'pending' NOT NULL,
	"upcast_error" text,
	"applied_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "offline_sync_mutation_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "offline_sync_mutation_counter_uq" UNIQUE("tenant_id","terminal_id","device_id","monotonic_counter"),
	CONSTRAINT "offline_sync_mutation_mutation_id_uq" UNIQUE("tenant_id","terminal_id","device_id","mutation_id"),
	CONSTRAINT "offline_sync_mutation_counter_chk" CHECK ("offline_sync_mutation"."monotonic_counter" > 0),
	CONSTRAINT "offline_sync_mutation_replay_status_chk" CHECK ("offline_sync_mutation"."replay_status" IN ('new','replay','conflict')),
	CONSTRAINT "offline_sync_mutation_upcast_status_chk" CHECK ("offline_sync_mutation"."upcast_status" IN ('pending','upcasted','failed'))
);
--> statement-breakpoint
CREATE TABLE "offline_terminal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"terminal_id" text NOT NULL,
	"device_id" text NOT NULL,
	"location_id" uuid,
	"public_key_fingerprint" text,
	"app_version" text,
	"sqlite_schema_version" text,
	"status" text DEFAULT 'active' NOT NULL,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "offline_terminal_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "offline_terminal_identity_uq" UNIQUE("tenant_id","terminal_id","device_id"),
	CONSTRAINT "offline_terminal_status_chk" CHECK ("offline_terminal"."status" IN ('active','suspended','retired'))
);
--> statement-breakpoint
ALTER TABLE "offline_sync_batch" ADD CONSTRAINT "offline_sync_batch_terminal_composite_fk" FOREIGN KEY ("tenant_id","terminal_row_id") REFERENCES "public"."offline_terminal"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_sync_mutation" ADD CONSTRAINT "offline_sync_mutation_batch_composite_fk" FOREIGN KEY ("tenant_id","batch_id") REFERENCES "public"."offline_sync_batch"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_sync_mutation" ADD CONSTRAINT "offline_sync_mutation_terminal_composite_fk" FOREIGN KEY ("tenant_id","terminal_row_id") REFERENCES "public"."offline_terminal"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_terminal" ADD CONSTRAINT "offline_terminal_location_composite_fk" FOREIGN KEY ("tenant_id","location_id") REFERENCES "public"."location"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "offline_sync_batch_tenantId_idx" ON "offline_sync_batch" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "offline_sync_batch_terminal_idx" ON "offline_sync_batch" USING btree ("tenant_id","terminal_id");--> statement-breakpoint
CREATE INDEX "offline_sync_mutation_tenantId_idx" ON "offline_sync_mutation" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "offline_sync_mutation_batchId_idx" ON "offline_sync_mutation" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "offline_sync_mutation_terminal_idx" ON "offline_sync_mutation" USING btree ("tenant_id","terminal_id");--> statement-breakpoint
CREATE INDEX "offline_terminal_tenantId_idx" ON "offline_terminal" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "offline_terminal_locationId_idx" ON "offline_terminal" USING btree ("location_id");--> statement-breakpoint
ALTER TABLE "offline_terminal" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "offline_terminal" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "offline_terminal";--> statement-breakpoint
CREATE POLICY tenant_isolation ON "offline_terminal"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
ALTER TABLE "offline_sync_batch" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "offline_sync_batch" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "offline_sync_batch";--> statement-breakpoint
CREATE POLICY tenant_isolation ON "offline_sync_batch"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
ALTER TABLE "offline_sync_mutation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "offline_sync_mutation" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "offline_sync_mutation";--> statement-breakpoint
CREATE POLICY tenant_isolation ON "offline_sync_mutation"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
