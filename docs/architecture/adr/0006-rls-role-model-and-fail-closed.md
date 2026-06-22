# ADR 0006 — RLS role model & fail-closed tenant isolation

- **Status:** Proposed (to be Accepted when VS#1 Commit 2 lands)
- **Date:** 2026-06-21
- **Context:** charter §8 (tenant isolation), §9 (deployment/RLS), §29 (security); Vertical Slice #1 Commit 2.
- **Supersedes/relates:** ADR 0004 (central-infra); `tenancy-deployment.md`; `vertical-slice-1.md` (approved sequence).

> Design note only — **no migration/code in this ADR**. Reviewed before Commit 2 is implemented.

## Decision — three Postgres roles

| Role | Purpose | Owns tables? | BYPASSRLS? | Superuser? | Subject to RLS? |
|---|---|---|---|---|---|
| **`retailos_owner`** | Table owner; the role under which `ENABLE`/`FORCE ROW LEVEL SECURITY` + `CREATE POLICY` run (these require ownership). Not a login/runtime role. | **yes** | **no** | **no** | **yes** (via `FORCE`) |
| **`retailos_migrator`** | The role `drizzle-kit migrate` connects as. Granted membership in `retailos_owner` so it can run DDL incl. policy creation. Runs DDL + any tenant-aware backfills. | acts as owner | **no** | **no** | yes |
| **`retailos_app`** | Runtime connection — the `DATABASE_URL` that `createDb()` uses. `GRANT`ed `SELECT/INSERT/UPDATE/DELETE` on tenant tables only. | **no** | **no** | **no** | **yes** (via `ENABLE`) |

*(Future, not in VS#1:* `retailos_maintenance` with `BYPASSRLS` for deliberate, audited cross-tenant ops. Never the app.)*

## RLS on every tenant-owned table

The **11 tenant-owned tables** — `company, location, membership, product, stock_ledger, sale, sale_line, invoice, audit_log, outbox_event, number_block` — each get (illustrative shape, not the committed migration):

```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;   -- non-owner roles (app) subject to policy
ALTER TABLE <t> FORCE  ROW LEVEL SECURITY;   -- owner ALSO subject to policy
CREATE POLICY tenant_isolation ON <t>
  USING      (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
```

Better Auth identity tables (`user/session/account/verification/organization/member/invitation`) are **out of tenant-GUC RLS scope** — managed by Better Auth and access-controlled at the session/active-organization layer, not by `app.tenant_id`. Boundary noted; revisit if direct app access to them is added.

## The four confirmations you asked for

- **(a) App role is NOT `BYPASSRLS`** (and not superuser): `retailos_app`. ⚠️ The local docker Postgres currently runs the app as the `postgres` **superuser**, which bypasses RLS unconditionally — Commit 2 must point runtime + tests at `retailos_app`, or the RLS tests are vacuous.
- **(b) `ENABLE` + `FORCE`** on every tenant-owned table → even `retailos_owner` is subject to the policy.
- **(c) Migrations still run under their own role** (`retailos_migrator`): RLS filters **DML only**, not DDL — so `CREATE/ALTER/ENABLE/FORCE/CREATE POLICY` run normally; ownership (granted) authorizes policy creation. **No standing `BYPASSRLS` needed.** Future data-backfill migrations touching tenant rows must be **tenant-aware** (loop tenants, set `app.tenant_id`) or use the audited maintenance role.
- **(d) Fail-closed when `app.tenant_id` is unset**: `current_setting('app.tenant_id', true)` returns **NULL** → `tenant_id = NULL` is never true → **zero rows** on `SELECT` and **rejection** on `INSERT` (via `WITH CHECK`). No `::uuid` cast — `tenant_id` is `text` (Better Auth nanoid; Commit-1 lesson).

## `withTenant` hardening (Commit 2)

- Uses **transaction-local** `set_config('app.tenant_id', $id, true)` — the GUC is cleared at transaction end, so no leakage across pooled connections.
- **Requires a non-empty tenant id** — non-optional TS param **plus** a runtime guard that throws on empty/missing; cannot be called without one.
- **Is the only path to a tenant-scoped handle:** the raw exported `db` connects as `retailos_app` with no GUC set, so any tenant query issued outside `withTenant` is fail-closed (zero rows). Enforced by RLS, not convention — and proven by test.

## Commit 2 tests (real CI Postgres, all required to pass)

1. **Unset `app.tenant_id` ⇒ zero rows** on every one of the 11 tenant-owned tables (fail-closed read).
2. **Cross-tenant denial:** Tenant A's connection cannot read Tenant B's rows when both exist (and vice-versa).
3. **`withTenant` is the only path:** raw `db` (no `withTenant`) returns zero tenant rows; `withTenant` throws/rejects when called without a tenant id; no other exported handle yields a tenant-scoped session without setting the GUC.
4. **App role is non-`BYPASSRLS`:** assert `rolbypassrls = false` and `rolsuper = false` for `retailos_app` via `pg_roles`.

## Consequences

- **Role provisioning (decided):** a **versioned bootstrap SQL** — `packages/db/src/bootstrap/roles.sql` — run as superuser creates the three roles + grants. It is **separate from the schema migrations** (cluster-level roles don't belong in expand/contract schema DDL). Local docker-compose runs it on first init (e.g. `/docker-entrypoint-initdb.d/`), CI runs it before `db:migrate`. The runtime `DATABASE_URL` switches to **`retailos_app`** (NOBYPASSRLS, NOSUPERUSER); `drizzle-kit migrate` connects as `retailos_migrator`. The central VPS least-privilege `retailos` role (ADR 0004) maps to `retailos_app`.
- CI gains a **real Postgres service**; the schema migration (run as `retailos_migrator`) enables/forces RLS and creates the policies.
- Backfills touching tenant data are tenant-aware or use the future audited maintenance role — never a standing `BYPASSRLS` for the app.
