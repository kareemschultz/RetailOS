-- RetailOS RLS role model — ADR 0006. IDEMPOTENT. Run as a SUPERUSER/admin,
-- ONCE, BEFORE migrations. This is NOT a Drizzle migration: cluster-level roles
-- never belong in ordinary schema migrations.
--
-- ⚠️  DEV/CI PASSWORDS ONLY. Production / managed-private / self-hosted
--     deployments create these roles with secrets from the secrets manager
--     (Infisical/KMS) and DO NOT use the passwords in this file. The passwords
--     here exist only so local docker + CI can connect; they are not secrets.
--
-- Roles:
--   retailos_owner     — owns tables + policies; NOLOGIN; never SUPERUSER/BYPASSRLS.
--   retailos_migrator  — login role for migrations; acts as owner; never SUPERUSER/BYPASSRLS.
--   retailos_app       — runtime role; DML only; never SUPERUSER/BYPASSRLS; subject to RLS.

-- ── roles (create if absent) ────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'retailos_owner') THEN
    CREATE ROLE retailos_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'retailos_migrator') THEN
    CREATE ROLE retailos_migrator LOGIN PASSWORD 'retailos_migrator'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'retailos_app') THEN
    CREATE ROLE retailos_app LOGIN PASSWORD 'retailos_app'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

-- ── re-assert the security-critical attributes every run (idempotent hardening) ─
-- Even if a role pre-existed with the wrong flags, force the safe posture:
-- never SUPERUSER, never BYPASSRLS, never CREATEDB/CREATEROLE.
ALTER ROLE retailos_owner    NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOLOGIN;
ALTER ROLE retailos_migrator NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE LOGIN;
ALTER ROLE retailos_app      NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE LOGIN;

-- retailos_app must NEVER be a member of retailos_owner: membership would let it
-- SET ROLE retailos_owner, then disable RLS / read+write across tenants.
DO $$
BEGIN
  IF pg_has_role('retailos_app', 'retailos_owner', 'MEMBER') THEN
    REVOKE retailos_owner FROM retailos_app;
  END IF;
END
$$;

-- ── migrator acts as owner ──────────────────────────────────────────────────
-- So every migration-created object is OWNED BY retailos_owner, and the owner is
-- the role that runs ENABLE/FORCE RLS + CREATE POLICY (which require ownership).
GRANT retailos_owner TO retailos_migrator;
ALTER ROLE retailos_migrator SET role TO retailos_owner;

-- Owner needs CREATE on the database so the migrator (acting as owner) can create
-- the drizzle migrations schema. Done dynamically to support any database name.
DO $$
BEGIN
  EXECUTE format('GRANT CREATE ON DATABASE %I TO retailos_owner', current_database());
END
$$;

-- ── schema privileges ───────────────────────────────────────────────────────
-- Strip the implicit PUBLIC CREATE on schema public (a default on PG<15 and on
-- some templates) so retailos_app cannot inherit DDL it was never granted.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO retailos_app, retailos_migrator;
GRANT CREATE ON SCHEMA public TO retailos_owner;

-- app: DML only (no DDL), on existing + future owner-created tables/sequences.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO retailos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO retailos_app;
ALTER DEFAULT PRIVILEGES FOR ROLE retailos_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO retailos_app;
ALTER DEFAULT PRIVILEGES FOR ROLE retailos_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO retailos_app;
