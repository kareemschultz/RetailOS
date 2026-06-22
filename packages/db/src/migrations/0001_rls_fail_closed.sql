-- Fail-closed tenant isolation (ADR 0006). Applies to every tenant-owned table:
--   ENABLE  RLS  → non-owner roles (retailos_app) are subject to policy.
--   FORCE   RLS  → the owner (retailos_owner) is ALSO subject to policy.
--   POLICY tenant_isolation → rows are visible/writable only when their tenant_id
--     equals the request's app.tenant_id GUC. When the GUC is UNSET,
--     current_setting('app.tenant_id', true) returns NULL, so `tenant_id = NULL`
--     is never true → ZERO rows on SELECT and rejection on INSERT (fail-closed).
--
-- Runs as retailos_owner (retailos_migrator SET role TO retailos_owner), which
-- owns the tables — required to ENABLE/FORCE RLS and CREATE POLICY.
-- Better Auth identity tables (user/session/account/verification/organization/
-- member/invitation) are intentionally OUT of scope (managed by Better Auth,
-- scoped at the session/active-org layer).
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'company', 'location', 'membership', 'product', 'stock_ledger',
    'sale', 'sale_line', 'invoice', 'audit_log', 'outbox_event', 'number_block'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I'
      || ' USING (tenant_id = current_setting(''app.tenant_id'', true))'
      || ' WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
      t
    );
  END LOOP;
END
$$;
