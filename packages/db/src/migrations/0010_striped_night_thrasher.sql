ALTER TABLE "location" ADD COLUMN "removal_strategy" text;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD COLUMN "qty_scale" integer;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD COLUMN "value_delta_minor" bigint;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD COLUMN "costing_method_applied" text;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD COLUMN "source_movement_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD COLUMN "original_unit_cost_minor" bigint;--> statement-breakpoint
ALTER TABLE "valuation_layer" ADD COLUMN "lot_id" uuid;--> statement-breakpoint
ALTER TABLE "valuation_layer" ADD COLUMN "serial_id" uuid;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "removal_strategy" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "return_costing_policy" text;--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "removal_strategy" text;--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "return_costing_policy" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "purchase_uom_id" uuid;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "sale_uom_id" uuid;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "reporting_uom_id" uuid;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "removal_strategy" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "return_costing_policy" text;--> statement-breakpoint
ALTER TABLE "sku" ADD COLUMN "purchase_uom_id" uuid;--> statement-breakpoint
ALTER TABLE "sku" ADD COLUMN "sale_uom_id" uuid;--> statement-breakpoint
ALTER TABLE "sku" ADD COLUMN "reporting_uom_id" uuid;--> statement-breakpoint
ALTER TABLE "sku" ADD COLUMN "removal_strategy" text;--> statement-breakpoint
ALTER TABLE "sku" ADD COLUMN "return_costing_policy" text;--> statement-breakpoint
ALTER TABLE "valuation_layer" ADD CONSTRAINT "valuation_layer_lot_id_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_purchase_uom_id_unit_of_measure_id_fk" FOREIGN KEY ("purchase_uom_id") REFERENCES "public"."unit_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_sale_uom_id_unit_of_measure_id_fk" FOREIGN KEY ("sale_uom_id") REFERENCES "public"."unit_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_reporting_uom_id_unit_of_measure_id_fk" FOREIGN KEY ("reporting_uom_id") REFERENCES "public"."unit_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sku" ADD CONSTRAINT "sku_purchase_uom_id_unit_of_measure_id_fk" FOREIGN KEY ("purchase_uom_id") REFERENCES "public"."unit_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sku" ADD CONSTRAINT "sku_sale_uom_id_unit_of_measure_id_fk" FOREIGN KEY ("sale_uom_id") REFERENCES "public"."unit_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sku" ADD CONSTRAINT "sku_reporting_uom_id_unit_of_measure_id_fk" FOREIGN KEY ("reporting_uom_id") REFERENCES "public"."unit_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_ledger_sourceMovementId_idx" ON "stock_ledger" USING btree ("source_movement_id");--> statement-breakpoint
CREATE INDEX "valuation_layer_lotId_idx" ON "valuation_layer" USING btree ("lot_id");