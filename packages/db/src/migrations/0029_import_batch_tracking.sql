CREATE TABLE "import_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"supplier_bill_id" uuid NOT NULL,
	"bond_receipt_id" uuid,
	"number" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"customs_reference" text,
	"declaration_number" text,
	"port_of_entry" text,
	"vessel_name" text,
	"eta" timestamp,
	"arrived_at" timestamp,
	"cleared_at" timestamp,
	"currency" text NOT NULL,
	"scale" bigint DEFAULT 2 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "import_batch_tenant_number_uq" UNIQUE("tenant_id","number"),
	CONSTRAINT "import_batch_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "import_batch_status_chk" CHECK ("import_batch"."status" IN ('open','arrived','cleared','cancelled')),
	CONSTRAINT "import_batch_scale_nonnegative_chk" CHECK ("import_batch"."scale" >= 0)
);
--> statement-breakpoint
CREATE TABLE "import_batch_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"import_batch_id" uuid NOT NULL,
	"goods_receipt_id" uuid NOT NULL,
	"goods_receipt_line_id" uuid NOT NULL,
	"supplier_bill_line_id" uuid,
	"landed_cost_pool_id" uuid,
	"landed_cost_allocation_id" uuid,
	"product_id" uuid NOT NULL,
	"sku_id" uuid NOT NULL,
	"qty_received" bigint NOT NULL,
	"currency" text NOT NULL,
	"scale" bigint DEFAULT 2 NOT NULL,
	"customs_line_reference" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "import_batch_line_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "import_batch_line_batch_grn_line_uq" UNIQUE("tenant_id","import_batch_id","goods_receipt_line_id"),
	CONSTRAINT "import_batch_line_qty_positive_chk" CHECK ("import_batch_line"."qty_received" > 0),
	CONSTRAINT "import_batch_line_scale_nonnegative_chk" CHECK ("import_batch_line"."scale" >= 0)
);
--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_company_composite_fk" FOREIGN KEY ("tenant_id","company_id") REFERENCES "public"."company"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_supplier_composite_fk" FOREIGN KEY ("tenant_id","supplier_id") REFERENCES "public"."supplier"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_po_composite_fk" FOREIGN KEY ("tenant_id","purchase_order_id") REFERENCES "public"."purchase_order"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_bill_composite_fk" FOREIGN KEY ("tenant_id","supplier_bill_id") REFERENCES "public"."supplier_bill"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_bond_receipt_composite_fk" FOREIGN KEY ("tenant_id","bond_receipt_id") REFERENCES "public"."bond_receipt"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch_line" ADD CONSTRAINT "import_batch_line_batch_composite_fk" FOREIGN KEY ("tenant_id","import_batch_id") REFERENCES "public"."import_batch"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch_line" ADD CONSTRAINT "import_batch_line_grn_composite_fk" FOREIGN KEY ("tenant_id","goods_receipt_id") REFERENCES "public"."goods_receipt"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch_line" ADD CONSTRAINT "import_batch_line_grn_line_composite_fk" FOREIGN KEY ("tenant_id","goods_receipt_line_id") REFERENCES "public"."goods_receipt_line"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch_line" ADD CONSTRAINT "import_batch_line_bill_line_composite_fk" FOREIGN KEY ("tenant_id","supplier_bill_line_id") REFERENCES "public"."supplier_bill_line"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch_line" ADD CONSTRAINT "import_batch_line_landed_pool_composite_fk" FOREIGN KEY ("tenant_id","landed_cost_pool_id") REFERENCES "public"."landed_cost_pool"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch_line" ADD CONSTRAINT "import_batch_line_landed_allocation_composite_fk" FOREIGN KEY ("tenant_id","landed_cost_allocation_id") REFERENCES "public"."landed_cost_allocation"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch_line" ADD CONSTRAINT "import_batch_line_product_composite_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."product"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch_line" ADD CONSTRAINT "import_batch_line_sku_product_composite_fk" FOREIGN KEY ("tenant_id","product_id","sku_id") REFERENCES "public"."sku"("tenant_id","product_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_batch_tenantId_idx" ON "import_batch" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "import_batch_supplier_idx" ON "import_batch" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "import_batch_purchase_order_idx" ON "import_batch" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "import_batch_supplier_bill_idx" ON "import_batch" USING btree ("supplier_bill_id");--> statement-breakpoint
CREATE INDEX "import_batch_line_tenantId_idx" ON "import_batch_line" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "import_batch_line_batch_idx" ON "import_batch_line" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX "import_batch_line_grn_line_idx" ON "import_batch_line" USING btree ("goods_receipt_line_id");--> statement-breakpoint
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'import_batch',
    'import_batch_line'
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