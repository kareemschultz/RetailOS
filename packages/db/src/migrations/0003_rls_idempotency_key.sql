-- Fail-closed RLS for the idempotency_key table (ADR 0006) — same policy as the
-- other tenant-owned tables: unset app.tenant_id => zero rows / insert rejected.
ALTER TABLE idempotency_key ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE idempotency_key FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON idempotency_key;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON idempotency_key
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
