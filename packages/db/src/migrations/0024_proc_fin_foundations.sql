CREATE TABLE "journal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"posting_period_id" uuid NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_document_id" uuid,
	"source_outbox_event_id" uuid,
	"memo" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"posted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "journal_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "journal_source_chk" CHECK ("journal"."source" IN ('manual','opening_balance','sale','refund','payment','inventory','transfer','bond','procurement')),
	CONSTRAINT "journal_status_chk" CHECK ("journal"."status" IN ('draft','posted','reversed'))
);
--> statement-breakpoint
CREATE TABLE "journal_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"journal_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"debit_minor" bigint DEFAULT 0 NOT NULL,
	"credit_minor" bigint DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"scale" bigint DEFAULT 2 NOT NULL,
	"memo" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	CONSTRAINT "journal_line_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "journal_line_debit_nonnegative_chk" CHECK ("journal_line"."debit_minor" >= 0),
	CONSTRAINT "journal_line_credit_nonnegative_chk" CHECK ("journal_line"."credit_minor" >= 0),
	CONSTRAINT "journal_line_one_side_chk" CHECK (("journal_line"."debit_minor" > 0 AND "journal_line"."credit_minor" = 0) OR ("journal_line"."credit_minor" > 0 AND "journal_line"."debit_minor" = 0)),
	CONSTRAINT "journal_line_scale_nonnegative_chk" CHECK ("journal_line"."scale" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ledger_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"normal_balance" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "ledger_account_tenant_code_uq" UNIQUE("tenant_id","code"),
	CONSTRAINT "ledger_account_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "ledger_account_type_chk" CHECK ("ledger_account"."type" IN ('asset','liability','equity','revenue','expense')),
	CONSTRAINT "ledger_account_normal_balance_chk" CHECK ("ledger_account"."normal_balance" IN ('debit','credit')),
	CONSTRAINT "ledger_account_status_chk" CHECK ("ledger_account"."status" IN ('active','archived'))
);
--> statement-breakpoint
CREATE TABLE "posting_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "posting_period_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "posting_period_tenant_name_uq" UNIQUE("tenant_id","name"),
	CONSTRAINT "posting_period_date_order_chk" CHECK ("posting_period"."starts_on" <= "posting_period"."ends_on"),
	CONSTRAINT "posting_period_status_chk" CHECK ("posting_period"."status" IN ('open','closed'))
);
--> statement-breakpoint
CREATE TABLE "purchase_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"currency" text NOT NULL,
	"scale" bigint DEFAULT 2 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "purchase_order_tenant_number_uq" UNIQUE("tenant_id","number"),
	CONSTRAINT "purchase_order_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "purchase_order_status_chk" CHECK ("purchase_order"."status" IN ('draft','approved','partially_received','received','cancelled')),
	CONSTRAINT "purchase_order_scale_nonnegative_chk" CHECK ("purchase_order"."scale" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_order_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku_id" uuid NOT NULL,
	"description" text,
	"qty_ordered" bigint NOT NULL,
	"qty_received" bigint DEFAULT 0 NOT NULL,
	"unit_cost_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"scale" bigint DEFAULT 2 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "purchase_order_line_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "purchase_order_line_qty_positive_chk" CHECK ("purchase_order_line"."qty_ordered" > 0),
	CONSTRAINT "purchase_order_line_qty_received_nonnegative_chk" CHECK ("purchase_order_line"."qty_received" >= 0),
	CONSTRAINT "purchase_order_line_unit_cost_nonnegative_chk" CHECK ("purchase_order_line"."unit_cost_minor" >= 0),
	CONSTRAINT "purchase_order_line_scale_nonnegative_chk" CHECK ("purchase_order_line"."scale" >= 0)
);
--> statement-breakpoint
CREATE TABLE "supplier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"tax_identification_number" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp,
	CONSTRAINT "supplier_tenant_code_uq" UNIQUE("tenant_id","code"),
	CONSTRAINT "supplier_tenant_id_uq" UNIQUE("tenant_id","id"),
	CONSTRAINT "supplier_status_chk" CHECK ("supplier"."status" IN ('active','archived'))
);
--> statement-breakpoint
ALTER TABLE "journal" ADD CONSTRAINT "journal_posting_period_id_posting_period_id_fk" FOREIGN KEY ("posting_period_id") REFERENCES "public"."posting_period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_tenant_id_uq" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "journal" ADD CONSTRAINT "journal_source_outbox_event_id_outbox_event_id_fk" FOREIGN KEY ("source_outbox_event_id") REFERENCES "public"."outbox_event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal" ADD CONSTRAINT "journal_period_composite_fk" FOREIGN KEY ("tenant_id","posting_period_id") REFERENCES "public"."posting_period"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal" ADD CONSTRAINT "journal_outbox_event_composite_fk" FOREIGN KEY ("tenant_id","source_outbox_event_id") REFERENCES "public"."outbox_event"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_journal_id_journal_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_account_id_ledger_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_journal_composite_fk" FOREIGN KEY ("tenant_id","journal_id") REFERENCES "public"."journal"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_account_composite_fk" FOREIGN KEY ("tenant_id","account_id") REFERENCES "public"."ledger_account"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_company_composite_fk" FOREIGN KEY ("tenant_id","company_id") REFERENCES "public"."company"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplier_composite_fk" FOREIGN KEY ("tenant_id","supplier_id") REFERENCES "public"."supplier"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_purchase_order_id_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_sku_id_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sku" ADD CONSTRAINT "sku_tenant_product_id_uq" UNIQUE("tenant_id","product_id","id");--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_po_composite_fk" FOREIGN KEY ("tenant_id","purchase_order_id") REFERENCES "public"."purchase_order"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_product_composite_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."product"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_sku_product_composite_fk" FOREIGN KEY ("tenant_id","product_id","sku_id") REFERENCES "public"."sku"("tenant_id","product_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journal_tenantId_idx" ON "journal" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "journal_period_idx" ON "journal" USING btree ("posting_period_id");--> statement-breakpoint
CREATE INDEX "journal_line_tenantId_idx" ON "journal_line" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "journal_line_journal_idx" ON "journal_line" USING btree ("journal_id");--> statement-breakpoint
CREATE INDEX "journal_line_account_idx" ON "journal_line" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "ledger_account_tenantId_idx" ON "ledger_account" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "posting_period_tenantId_idx" ON "posting_period" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "purchase_order_tenantId_idx" ON "purchase_order" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "purchase_order_supplier_idx" ON "purchase_order" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_order_line_tenantId_idx" ON "purchase_order_line" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "purchase_order_line_po_idx" ON "purchase_order_line" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "supplier_tenantId_idx" ON "supplier" USING btree ("tenant_id");--> statement-breakpoint
CREATE OR REPLACE FUNCTION retailos_validate_journal_posting()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  period_status text;
  unbalanced_count integer;
BEGIN
  IF NEW.status = 'posted' AND OLD.status IS DISTINCT FROM 'posted' THEN
    SELECT status INTO period_status
    FROM posting_period
    WHERE tenant_id = NEW.tenant_id AND id = NEW.posting_period_id;

    IF period_status = 'closed' THEN
      RAISE EXCEPTION 'Cannot post into a closed posting period'
        USING ERRCODE = '23514', CONSTRAINT = 'journal_closed_period_chk';
    END IF;

    SELECT count(*) INTO unbalanced_count
    FROM (
      SELECT currency, scale, sum(debit_minor) AS debit_total, sum(credit_minor) AS credit_total
      FROM journal_line
      WHERE tenant_id = NEW.tenant_id AND journal_id = NEW.id
      GROUP BY currency, scale
    ) balances
    WHERE debit_total <> credit_total;

    IF unbalanced_count > 0 OR NOT EXISTS (
      SELECT 1 FROM journal_line WHERE tenant_id = NEW.tenant_id AND journal_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Journal is not balanced by currency/scale'
        USING ERRCODE = '23514', CONSTRAINT = 'journal_balanced_chk';
    END IF;

    NEW.posted_at = COALESCE(NEW.posted_at, now());
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER journal_validate_posting_trg
BEFORE UPDATE OF status ON journal
FOR EACH ROW
EXECUTE FUNCTION retailos_validate_journal_posting();--> statement-breakpoint
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'ledger_account',
    'posting_period',
    'journal',
    'journal_line',
    'supplier',
    'purchase_order',
    'purchase_order_line'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
      t
    );
  END LOOP;
END $$;