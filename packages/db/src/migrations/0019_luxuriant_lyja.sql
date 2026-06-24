-- Phase 4 commit 3 — Returns / Refunds / Voids / Exchanges. Expand-only: adds
-- the return/exchange linkage seams. `sale.exchange_group_id` links the two legs
-- of an exchange (a return + a sale share it). `sale_line.original_sale_line_id`
-- points a return line at the original sale line it reverses (the refund derives
-- restockedValueMinor + commission clawback proportionally from the original's
-- stamped COGS — event-map-phase4 HIGH-4). Both columns NULLABLE — no drops, no
-- NOT-NULL retrofits, no type changes; no new tenant table (returns reuse
-- sale/sale_line/tender, so the tenant-isolation-coverage gate is unaffected).
--
-- ORDERING (Phase-3 commit-0 lesson): drizzle-kit emitted the composite FK
-- BEFORE its target UNIQUE. A composite FK requires the referenced columns to
-- already carry a UNIQUE/PK, so the UNIQUE target is hand-moved ABOVE the FK
-- here (verified the full chain 0000→0019 applies on a fresh PG18).
ALTER TABLE "sale" ADD COLUMN "exchange_group_id" uuid;--> statement-breakpoint
ALTER TABLE "sale_line" ADD COLUMN "original_sale_line_id" uuid;--> statement-breakpoint
ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_tenant_id_uq" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_original_composite_fk" FOREIGN KEY ("tenant_id","original_sale_line_id") REFERENCES "public"."sale_line"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sale_line_originalSaleLineId_idx" ON "sale_line" USING btree ("original_sale_line_id");
