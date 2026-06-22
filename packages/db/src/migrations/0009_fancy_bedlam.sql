ALTER TABLE "stock_ledger" ADD COLUMN "sku_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_ledger_location_sku_idx" ON "stock_ledger" USING btree ("location_id","sku_id");