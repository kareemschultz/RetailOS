CREATE TABLE "vendor_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"supplier_bill_id" uuid NOT NULL,
	"posting_period_id" uuid NOT NULL,
	"journal_id" uuid NOT NULL,
	"cash_account_id" uuid NOT NULL,
	"accounts_payable_account_id" uuid NOT NULL,
	"number" text NOT NULL,
	"status" text DEFAULT 'posted' NOT NULL,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"scale" bigint DEFAULT 2 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "vendor_payment_tenant_number_uq" UNIQUE("tenant_id","number"),
	CONSTRAINT "vendor_payment_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "vendor_payment_tenant_journal_uq" UNIQUE("tenant_id","journal_id"),
	CONSTRAINT "vendor_payment_status_chk" CHECK ("vendor_payment"."status" IN ('posted','voided')),
	CONSTRAINT "vendor_payment_amount_positive_chk" CHECK ("vendor_payment"."amount_minor" > 0),
	CONSTRAINT "vendor_payment_scale_nonnegative_chk" CHECK ("vendor_payment"."scale" >= 0)
);
--> statement-breakpoint
ALTER TABLE "supplier_bill" ADD COLUMN "ap_journal_id" uuid;--> statement-breakpoint
ALTER TABLE "vendor_payment" ADD CONSTRAINT "vendor_payment_company_composite_fk" FOREIGN KEY ("tenant_id","company_id") REFERENCES "public"."company"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment" ADD CONSTRAINT "vendor_payment_supplier_composite_fk" FOREIGN KEY ("tenant_id","supplier_id") REFERENCES "public"."supplier"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment" ADD CONSTRAINT "vendor_payment_supplier_bill_composite_fk" FOREIGN KEY ("tenant_id","supplier_bill_id") REFERENCES "public"."supplier_bill"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment" ADD CONSTRAINT "vendor_payment_posting_period_composite_fk" FOREIGN KEY ("tenant_id","posting_period_id") REFERENCES "public"."posting_period"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment" ADD CONSTRAINT "vendor_payment_journal_composite_fk" FOREIGN KEY ("tenant_id","journal_id") REFERENCES "public"."journal"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment" ADD CONSTRAINT "vendor_payment_cash_account_composite_fk" FOREIGN KEY ("tenant_id","cash_account_id") REFERENCES "public"."ledger_account"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment" ADD CONSTRAINT "vendor_payment_ap_account_composite_fk" FOREIGN KEY ("tenant_id","accounts_payable_account_id") REFERENCES "public"."ledger_account"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_payment_tenantId_idx" ON "vendor_payment" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "vendor_payment_supplier_idx" ON "vendor_payment" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "vendor_payment_supplier_bill_idx" ON "vendor_payment" USING btree ("supplier_bill_id");--> statement-breakpoint
ALTER TABLE "supplier_bill" ADD CONSTRAINT "supplier_bill_ap_journal_composite_fk" FOREIGN KEY ("tenant_id","ap_journal_id") REFERENCES "public"."journal"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vendor_payment" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "vendor_payment";--> statement-breakpoint
CREATE POLICY tenant_isolation ON "vendor_payment"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));