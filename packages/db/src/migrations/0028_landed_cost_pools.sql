CREATE TABLE "landed_cost_allocation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"landed_cost_pool_id" uuid NOT NULL,
	"supplier_bill_id" uuid NOT NULL,
	"supplier_bill_line_id" uuid NOT NULL,
	"goods_receipt_id" uuid NOT NULL,
	"goods_receipt_line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"valuation_adjustment_movement_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"scale" bigint DEFAULT 2 NOT NULL,
	"basis_quantity" bigint NOT NULL,
	"basis_line_value_minor" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "landed_cost_allocation_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "landed_cost_allocation_amount_nonnegative_chk" CHECK ("landed_cost_allocation"."amount_minor" >= 0),
	CONSTRAINT "landed_cost_allocation_basis_qty_nonnegative_chk" CHECK ("landed_cost_allocation"."basis_quantity" >= 0),
	CONSTRAINT "landed_cost_allocation_basis_value_nonnegative_chk" CHECK ("landed_cost_allocation"."basis_line_value_minor" >= 0),
	CONSTRAINT "landed_cost_allocation_scale_nonnegative_chk" CHECK ("landed_cost_allocation"."scale" >= 0)
);
--> statement-breakpoint
CREATE TABLE "landed_cost_pool" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"supplier_bill_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"basis" text NOT NULL,
	"status" text DEFAULT 'posted' NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"scale" bigint DEFAULT 2 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "landed_cost_pool_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "landed_cost_pool_kind_chk" CHECK ("landed_cost_pool"."kind" IN ('freight','insurance','duty','tax','handling','other')),
	CONSTRAINT "landed_cost_pool_basis_chk" CHECK ("landed_cost_pool"."basis" IN ('line_value','quantity')),
	CONSTRAINT "landed_cost_pool_status_chk" CHECK ("landed_cost_pool"."status" IN ('posted')),
	CONSTRAINT "landed_cost_pool_amount_positive_chk" CHECK ("landed_cost_pool"."amount_minor" > 0),
	CONSTRAINT "landed_cost_pool_scale_nonnegative_chk" CHECK ("landed_cost_pool"."scale" >= 0)
);
--> statement-breakpoint
ALTER TABLE "landed_cost_allocation" ADD CONSTRAINT "landed_cost_allocation_pool_composite_fk" FOREIGN KEY ("tenant_id","landed_cost_pool_id") REFERENCES "public"."landed_cost_pool"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_allocation" ADD CONSTRAINT "landed_cost_allocation_bill_composite_fk" FOREIGN KEY ("tenant_id","supplier_bill_id") REFERENCES "public"."supplier_bill"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_allocation" ADD CONSTRAINT "landed_cost_allocation_bill_line_composite_fk" FOREIGN KEY ("tenant_id","supplier_bill_line_id") REFERENCES "public"."supplier_bill_line"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_allocation" ADD CONSTRAINT "landed_cost_allocation_grn_composite_fk" FOREIGN KEY ("tenant_id","goods_receipt_id") REFERENCES "public"."goods_receipt"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_allocation" ADD CONSTRAINT "landed_cost_allocation_grn_line_composite_fk" FOREIGN KEY ("tenant_id","goods_receipt_line_id") REFERENCES "public"."goods_receipt_line"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_allocation" ADD CONSTRAINT "landed_cost_allocation_product_composite_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."product"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_allocation" ADD CONSTRAINT "landed_cost_allocation_sku_product_composite_fk" FOREIGN KEY ("tenant_id","product_id","sku_id") REFERENCES "public"."sku"("tenant_id","product_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_allocation" ADD CONSTRAINT "landed_cost_allocation_location_composite_fk" FOREIGN KEY ("tenant_id","company_id","location_id") REFERENCES "public"."location"("tenant_id","company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_allocation" ADD CONSTRAINT "landed_cost_allocation_movement_fk" FOREIGN KEY ("valuation_adjustment_movement_id") REFERENCES "public"."stock_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_pool" ADD CONSTRAINT "landed_cost_pool_bill_composite_fk" FOREIGN KEY ("tenant_id","supplier_bill_id") REFERENCES "public"."supplier_bill"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_pool" ADD CONSTRAINT "landed_cost_pool_company_composite_fk" FOREIGN KEY ("tenant_id","company_id") REFERENCES "public"."company"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "landed_cost_allocation_tenantId_idx" ON "landed_cost_allocation" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "landed_cost_allocation_pool_idx" ON "landed_cost_allocation" USING btree ("landed_cost_pool_id");--> statement-breakpoint
CREATE INDEX "landed_cost_allocation_bill_idx" ON "landed_cost_allocation" USING btree ("supplier_bill_id");--> statement-breakpoint
CREATE INDEX "landed_cost_pool_tenantId_idx" ON "landed_cost_pool" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "landed_cost_pool_bill_idx" ON "landed_cost_pool" USING btree ("supplier_bill_id");--> statement-breakpoint
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'landed_cost_pool',
    'landed_cost_allocation'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
      t
    );
  END LOOP;
END $$;