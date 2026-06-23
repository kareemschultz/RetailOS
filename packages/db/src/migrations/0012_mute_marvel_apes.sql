-- Phase 3 commit 0 — parked debt (#5 composite-FK + #7 set-once trigger). Expand-only.
-- NOTE: composite-FK targets (UNIQUE(tenant_id, id) / (tenant_id, company_id, id))
-- are created BEFORE the composite FK that references them (Drizzle generated the
-- FK first, which would fail — reordered by hand).

-- #5 — composite-FK targets (redundant-but-harmless; id is already a unique PK)
ALTER TABLE "company" ADD CONSTRAINT "company_tenant_id_uq" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_tenant_id_uq" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_tenant_company_id_uq" UNIQUE("tenant_id","company_id","id");--> statement-breakpoint
ALTER TABLE "lot" ADD CONSTRAINT "lot_tenant_id_uq" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_tenant_id_uq" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "sku" ADD CONSTRAINT "sku_tenant_id_uq" UNIQUE("tenant_id","id");--> statement-breakpoint

-- #5 (additive bonus / Codex F3 demonstrable kill): a location may not reference
-- another tenant's company at the DB layer. ADDITIVE — the existing plain
-- company_id FK is kept; this composite FK adds the tenant pin.
ALTER TABLE "location" ADD CONSTRAINT "location_company_composite_fk" FOREIGN KEY ("tenant_id","company_id") REFERENCES "public"."company"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- #7 — set-once costing-method DB-trigger backstop. The app guard
-- (assertCostingMethodSetOnce) is bypassable by a raw service UPDATE; this closes
-- the class at the DB layer regardless of write path.
-- Codex F4: stock_ledger.sku_id is NULLABLE — a SKU's method must also be locked
-- once PRODUCT-LEVEL movements (sku_id IS NULL) exist for its product, because
-- those movements were valued under the product's method.
CREATE OR REPLACE FUNCTION "enforce_costing_method_set_once"()
RETURNS trigger AS $$
BEGIN
  -- only act when the method actually changes
  IF NEW."costing_method" IS DISTINCT FROM OLD."costing_method" THEN
    IF TG_TABLE_NAME = 'product' THEN
      IF EXISTS (SELECT 1 FROM "stock_ledger" WHERE "product_id" = NEW."id") THEN
        RAISE EXCEPTION 'costing_method is set-once: product % already has stock_ledger movements', NEW."id"
          USING ERRCODE = 'check_violation';
      END IF;
    ELSIF TG_TABLE_NAME = 'sku' THEN
      IF EXISTS (
        SELECT 1 FROM "stock_ledger"
        WHERE "sku_id" = NEW."id"
           OR ("product_id" = NEW."product_id" AND "sku_id" IS NULL)
      ) THEN
        RAISE EXCEPTION 'costing_method is set-once: sku % (or product-level movements of its product) already exist', NEW."id"
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER "product_costing_method_set_once"
  BEFORE UPDATE OF "costing_method" ON "product"
  FOR EACH ROW EXECUTE FUNCTION "enforce_costing_method_set_once"();--> statement-breakpoint

CREATE TRIGGER "sku_costing_method_set_once"
  BEFORE UPDATE OF "costing_method" ON "sku"
  FOR EACH ROW EXECUTE FUNCTION "enforce_costing_method_set_once"();
