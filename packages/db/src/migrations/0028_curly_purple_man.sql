CREATE TABLE "goods_receipt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"number" text NOT NULL,
	"status" text DEFAULT 'posted' NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "goods_receipt_tenant_number_uq" UNIQUE("tenant_id","number"),
	CONSTRAINT "goods_receipt_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "goods_receipt_status_chk" CHECK ("goods_receipt"."status" IN ('posted','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "goods_receipt_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"goods_receipt_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku_id" uuid NOT NULL,
	"qty_received" bigint NOT NULL,
	"unit_cost_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"scale" bigint DEFAULT 2 NOT NULL,
	"movement_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "goods_receipt_line_movement_uq" UNIQUE("tenant_id","movement_id"),
	CONSTRAINT "goods_receipt_line_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "goods_receipt_line_qty_positive_chk" CHECK ("goods_receipt_line"."qty_received" > 0),
	CONSTRAINT "goods_receipt_line_unit_cost_nonnegative_chk" CHECK ("goods_receipt_line"."unit_cost_minor" >= 0),
	CONSTRAINT "goods_receipt_line_scale_nonnegative_chk" CHECK ("goods_receipt_line"."scale" >= 0)
);
--> statement-breakpoint
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
CREATE TABLE "supplier_bill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"number" text NOT NULL,
	"status" text DEFAULT 'posted' NOT NULL,
	"bill_date" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp,
	"currency" text NOT NULL,
	"scale" bigint DEFAULT 2 NOT NULL,
	"total_minor" bigint NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "supplier_bill_tenant_number_uq" UNIQUE("tenant_id","number"),
	CONSTRAINT "supplier_bill_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "supplier_bill_status_chk" CHECK ("supplier_bill"."status" IN ('draft','posted','cancelled')),
	CONSTRAINT "supplier_bill_total_nonnegative_chk" CHECK ("supplier_bill"."total_minor" >= 0),
	CONSTRAINT "supplier_bill_scale_nonnegative_chk" CHECK ("supplier_bill"."scale" >= 0)
);
--> statement-breakpoint
CREATE TABLE "supplier_bill_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"supplier_bill_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"goods_receipt_id" uuid NOT NULL,
	"goods_receipt_line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku_id" uuid NOT NULL,
	"qty_billed" bigint NOT NULL,
	"unit_cost_minor" bigint NOT NULL,
	"line_total_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"scale" bigint DEFAULT 2 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_bill_line_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "supplier_bill_line_qty_positive_chk" CHECK ("supplier_bill_line"."qty_billed" > 0),
	CONSTRAINT "supplier_bill_line_unit_cost_nonnegative_chk" CHECK ("supplier_bill_line"."unit_cost_minor" >= 0),
	CONSTRAINT "supplier_bill_line_total_nonnegative_chk" CHECK ("supplier_bill_line"."line_total_minor" >= 0),
	CONSTRAINT "supplier_bill_line_scale_nonnegative_chk" CHECK ("supplier_bill_line"."scale" >= 0)
);
--> statement-breakpoint
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_company_composite_fk" FOREIGN KEY ("tenant_id","company_id") REFERENCES "public"."company"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_supplier_composite_fk" FOREIGN KEY ("tenant_id","supplier_id") REFERENCES "public"."supplier"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_po_composite_fk" FOREIGN KEY ("tenant_id","purchase_order_id") REFERENCES "public"."purchase_order"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_location_composite_fk" FOREIGN KEY ("tenant_id","company_id","location_id") REFERENCES "public"."location"("tenant_id","company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "goods_receipt_line_receipt_composite_fk" FOREIGN KEY ("tenant_id","goods_receipt_id") REFERENCES "public"."goods_receipt"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "goods_receipt_line_po_composite_fk" FOREIGN KEY ("tenant_id","purchase_order_id") REFERENCES "public"."purchase_order"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "goods_receipt_line_po_line_composite_fk" FOREIGN KEY ("tenant_id","purchase_order_line_id") REFERENCES "public"."purchase_order_line"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "goods_receipt_line_product_composite_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."product"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "goods_receipt_line_sku_product_composite_fk" FOREIGN KEY ("tenant_id","product_id","sku_id") REFERENCES "public"."sku"("tenant_id","product_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "goods_receipt_line_movement_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."stock_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "supplier_bill" ADD CONSTRAINT "supplier_bill_company_composite_fk" FOREIGN KEY ("tenant_id","company_id") REFERENCES "public"."company"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bill" ADD CONSTRAINT "supplier_bill_supplier_composite_fk" FOREIGN KEY ("tenant_id","supplier_id") REFERENCES "public"."supplier"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bill" ADD CONSTRAINT "supplier_bill_po_composite_fk" FOREIGN KEY ("tenant_id","purchase_order_id") REFERENCES "public"."purchase_order"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bill_line" ADD CONSTRAINT "supplier_bill_line_bill_composite_fk" FOREIGN KEY ("tenant_id","supplier_bill_id") REFERENCES "public"."supplier_bill"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bill_line" ADD CONSTRAINT "supplier_bill_line_po_composite_fk" FOREIGN KEY ("tenant_id","purchase_order_id") REFERENCES "public"."purchase_order"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bill_line" ADD CONSTRAINT "supplier_bill_line_po_line_composite_fk" FOREIGN KEY ("tenant_id","purchase_order_line_id") REFERENCES "public"."purchase_order_line"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bill_line" ADD CONSTRAINT "supplier_bill_line_grn_composite_fk" FOREIGN KEY ("tenant_id","goods_receipt_id") REFERENCES "public"."goods_receipt"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bill_line" ADD CONSTRAINT "supplier_bill_line_grn_line_composite_fk" FOREIGN KEY ("tenant_id","goods_receipt_line_id") REFERENCES "public"."goods_receipt_line"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bill_line" ADD CONSTRAINT "supplier_bill_line_product_composite_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."product"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bill_line" ADD CONSTRAINT "supplier_bill_line_sku_product_composite_fk" FOREIGN KEY ("tenant_id","product_id","sku_id") REFERENCES "public"."sku"("tenant_id","product_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goods_receipt_tenantId_idx" ON "goods_receipt" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_purchase_order_idx" ON "goods_receipt" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_location_idx" ON "goods_receipt" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_line_tenantId_idx" ON "goods_receipt_line" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_line_receipt_idx" ON "goods_receipt_line" USING btree ("goods_receipt_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_line_po_line_idx" ON "goods_receipt_line" USING btree ("purchase_order_line_id");--> statement-breakpoint
CREATE INDEX "import_batch_tenantId_idx" ON "import_batch" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "import_batch_supplier_idx" ON "import_batch" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "import_batch_purchase_order_idx" ON "import_batch" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "import_batch_supplier_bill_idx" ON "import_batch" USING btree ("supplier_bill_id");--> statement-breakpoint
CREATE INDEX "import_batch_line_tenantId_idx" ON "import_batch_line" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "import_batch_line_batch_idx" ON "import_batch_line" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX "import_batch_line_grn_line_idx" ON "import_batch_line" USING btree ("goods_receipt_line_id");--> statement-breakpoint
CREATE INDEX "landed_cost_allocation_tenantId_idx" ON "landed_cost_allocation" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "landed_cost_allocation_pool_idx" ON "landed_cost_allocation" USING btree ("landed_cost_pool_id");--> statement-breakpoint
CREATE INDEX "landed_cost_allocation_bill_idx" ON "landed_cost_allocation" USING btree ("supplier_bill_id");--> statement-breakpoint
CREATE INDEX "landed_cost_pool_tenantId_idx" ON "landed_cost_pool" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "landed_cost_pool_bill_idx" ON "landed_cost_pool" USING btree ("supplier_bill_id");--> statement-breakpoint
CREATE INDEX "supplier_bill_tenantId_idx" ON "supplier_bill" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "supplier_bill_supplier_idx" ON "supplier_bill" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_bill_purchase_order_idx" ON "supplier_bill" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "supplier_bill_line_tenantId_idx" ON "supplier_bill_line" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "supplier_bill_line_bill_idx" ON "supplier_bill_line" USING btree ("supplier_bill_id");--> statement-breakpoint
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'goods_receipt',
    'goods_receipt_line',
    'supplier_bill',
    'supplier_bill_line',
    'landed_cost_pool',
    'landed_cost_allocation',
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
CREATE INDEX "supplier_bill_line_grn_line_idx" ON "supplier_bill_line" USING btree ("goods_receipt_line_id");