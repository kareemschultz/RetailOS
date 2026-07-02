-- Normalize tax_rate to the standard tenant_isolation policy name.
-- Migration 0024 created fail-closed RLS with a table-specific policy name;
-- the static coverage gate requires the standard name so future drift is visible.
DROP POLICY IF EXISTS "tenant_isolation_tax_rate" ON "tax_rate";
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "tax_rate";
--> statement-breakpoint
CREATE POLICY tenant_isolation ON tax_rate
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
