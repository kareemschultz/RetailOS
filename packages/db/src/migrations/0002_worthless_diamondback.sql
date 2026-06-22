CREATE TABLE "idempotency_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"response" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_key_tenantId_key_uq" UNIQUE("tenant_id","key")
);
--> statement-breakpoint
CREATE INDEX "idempotency_key_tenantId_idx" ON "idempotency_key" USING btree ("tenant_id");