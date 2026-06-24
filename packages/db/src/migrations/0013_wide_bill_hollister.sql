-- Phase 3 commit 1 — unified self-referential location model. Expand-only.
-- type → CHECK enum; parent_location_id self-FK pinned to (tenant_id, company_id)
-- so a child shares tenant+company with its parent; behaviour flags; bin capacity seam.

ALTER TABLE "location" ADD COLUMN "parent_location_id" uuid;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "is_sellable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "is_quarantine" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "is_bonded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "is_transit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "max_weight" bigint;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "max_volume" bigint;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_parent_composite_fk" FOREIGN KEY ("tenant_id","company_id","parent_location_id") REFERENCES "public"."location"("tenant_id","company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "location_parentLocationId_idx" ON "location" USING btree ("parent_location_id");--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_type_chk" CHECK ("location"."type" IN ('store','warehouse','bonded','distribution_center','fulfillment_center','in_transit','zone','aisle','rack','shelf','bin'));