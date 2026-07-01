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
CREATE INDEX "supplier_bill_tenantId_idx" ON "supplier_bill" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "supplier_bill_supplier_idx" ON "supplier_bill" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_bill_purchase_order_idx" ON "supplier_bill" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "supplier_bill_line_tenantId_idx" ON "supplier_bill_line" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "supplier_bill_line_bill_idx" ON "supplier_bill_line" USING btree ("supplier_bill_id");--> statement-breakpoint
CREATE INDEX "supplier_bill_line_grn_line_idx" ON "supplier_bill_line" USING btree ("goods_receipt_line_id");--> statement-breakpoint
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'supplier_bill',
    'supplier_bill_line'
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