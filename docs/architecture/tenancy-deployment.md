# RetailOS Tenancy, Isolation & Deployment Architecture

> Planning/design document. No implementation code. Illustrative tables, policy sketches, and pseudocode only.
> Source of truth: `docs/architecture/retailos-master-charter.md`. Primary sections: **§8** (Platform/Tenant/Org), **§9** (Deployment modes, sovereignty, residency), with cross-refs to §6 (Better Auth org = tenant), §7 (entitlements/scope), §15 (Edge Hub), §25 (audit/secrets), §26/§35 (RLS-bypass tests), §28 (migrations/CI), §29 (security).

---

## 1. The hierarchy (§8)

```
Platform (Platform Owner / MSP — NOT a tenant)
└── Tenant                         ≡ Better Auth organization (§6)
    ├── Companies                  legal/accounting entities (per-company books, numbering, COA)
    │   └── Locations              store | warehouse | bonded warehouse | DC | service | fulfillment
    ├── Users / Employees          BA users ↔ employee records linked, not the same (§21)
    ├── Subscription / License     (§10/§37)
    ├── Feature Flags              (§10)
    ├── Branding / Integrations / Settings / Data
```

- **Platform Owner is not a tenant** (§8). Platform data and tenant data are **logically separated**; platform tables are never tenant-scoped and never carry `tenant_id`.
- **Tenant ≡ Better Auth organization** (§6). RetailOS adds **Company** and **Location** sub-scopes *below* the org; it does not shadow Better Auth's org/member/team model.
- A tenant may operate companies/stores in **multiple countries** (§12); timestamps stored UTC, rendered per tenant/company/location/user TZ.

### 1.1 Platform-vs-tenant table separation

| Class | Examples | `tenant_id`? | RLS? |
|---|---|---|---|
| **Platform tables** | `tenants`, `subscriptions`, `plans`, `feature_flag_defaults`, `deployment_registry`, `residency_attestations`, platform audit, MSP health | **No** | No (platform-admin guarded only) |
| **Tenant-owned tables** | `companies`, `locations`, `products`, `stock_ledger`, `sales`, `journals`, `customers`, … | **Yes** | **Yes** (shared-schema SaaS) |
| **Better Auth tables** | `user`, `session`, `organization`, `member`, `invitation`, `apikey`, `twoFactor`, device auth | org-scoped (BA-owned) | BA-managed; tenant guard reads `activeOrganizationId` |

### 1.2 Required columns on every tenant-owned table (§8)

| Column | Required | Notes |
|---|---|---|
| `tenant_id` | **always** | The isolation key; FK to `tenants`; indexed; first column in composite indexes. |
| `created_at` | always | UTC. |
| `updated_at` | always | UTC. |
| `deleted_at` | where appropriate | **Soft delete** — no hard deletes for operational records except legal erasure via crypto-shredding (§8/§25/§33). |
| `created_by` | where appropriate | Actor user (audit linkage §25). |
| `updated_by` | where appropriate | Actor user. |

Many tables additionally carry `company_id` and/or `location_id` to support §7 layers 3–4 scoping. **Every query must be tenant-scoped** (§33).

---

## 2. Tenant isolation per deployment mode (§8/§9)

RetailOS keeps **identical business logic** across modes (§9); only the **isolation substrate** changes. The data-access layer resolves the right strategy from `deployment_mode` (env-driven, §36).

| Deployment mode (§9) | Isolation strategy (§8) | DB topology | Tenant guard | RLS |
|---|---|---|---|---|
| **Multi-tenant SaaS** | **Shared schema + `tenant_id` + PostgreSQL RLS** | One shared cluster (app/PG/Redis/object storage) | App-level guard sets `app.tenant_id` GUC per request | **Required** — primary isolation |
| **Dedicated single-tenant cloud** | **Database-per-tenant** | One dedicated DB per tenant (own Redis, object storage, domain, SMTP, backups) | App guard still applies | Optional/defense-in-depth (single tenant per DB) |
| **Managed private instance** | **Database-per-tenant** (RetailOS-hosted) | Customer-owned license/subscription; RetailOS ops the infra | App guard | Optional/defense-in-depth |
| **Self-hosted enterprise** | **Customer-managed database** | Customer Docker / Compose / K8s; their DB | App guard | Optional (typically single-tenant) |
| **Edge Hub** (any mode) | Local PG/SQLite mirror, tenant-pinned | Per-site appliance (§15) | Hub is bound to one tenant/site; cloud is source of truth | n/a locally |

**Key consequence:** the app-level tenant guard is **mandatory in all modes** (every query tenant-scoped, §33). RLS is the **second wall** that makes the shared-schema SaaS mode safe even if a guard is missed. In DB-per-tenant modes there is no shared-schema cross-tenant surface, so RLS is defense-in-depth, not the primary barrier.

---

## 3. PostgreSQL RLS strategy (§8/§9) — shared-schema SaaS

### 3.1 Session GUC as the tenant key

Each request opens a DB session/transaction and sets a **session GUC** holding the active tenant, derived from the Better Auth **active organization** (§6) and the hostname-resolved tenant (§11):

```sql
-- per request/transaction, set by the connection middleware (illustrative)
SET LOCAL app.tenant_id = '<active_org_tenant_uuid>';
-- platform-admin / migration contexts use a distinct, audited role (see §3.4)
```

- Use `SET LOCAL` inside a transaction so the value never leaks across pooled connections (PgBouncer transaction pooling safe).
- The GUC is set **only** by trusted server middleware after Better Auth resolves the session+org; clients can never set it.
- `current_setting('app.tenant_id', true)` is read by every policy.

### 3.2 Policies (illustrative)

Every tenant-owned table enables RLS and applies a `USING` + `WITH CHECK` policy keyed on the GUC:

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;   -- applies even to table owner

CREATE POLICY tenant_isolation ON products
  USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

- `FORCE ROW LEVEL SECURITY` ensures the policy applies even when the app connects as the table owner.
- `WITH CHECK` blocks **writing** a row with a foreign `tenant_id` (prevents tenant-id spoofing on INSERT/UPDATE), not just reading.
- The app role used by the runtime is a **non-superuser, non-`BYPASSRLS`** role.

### 3.3 App-level tenant guard (defense in depth)

RLS is the backstop, **not** the only control (§29). The app-level guard:

- sets the GUC from the verified session/org (never from a client header);
- adds `WHERE tenant_id = :activeTenant` in the data layer regardless of RLS, so a query is correct even against a non-RLS DB (DB-per-tenant modes);
- rejects any mutation whose payload `tenant_id` ≠ active tenant before it reaches PG;
- emits an **`RLS violation` security alert** (§25/§26) if the DB ever rejects a row that the guard thought was in-scope (signals a guard bug).

This dual control means a single missed `WHERE` clause cannot become a cross-tenant leak in SaaS mode.

### 3.4 Privileged / system contexts

- **Migrations & fan-out** run as a dedicated migration role that operates per-tenant or with a controlled bypass, never as the request runtime role (see §6 below).
- **Platform-admin / MSP** reads tenant *health* via platform tables; cross-tenant *data* access only through **audited impersonation** (§6 Admin plugin, §10), which itself sets the impersonated tenant's GUC and records `impersonator_user_id` (§25).
- **Read-replica / analytics** read models must also honor tenant scope and RLS at the read layer (§27).

### 3.5 RLS-bypass test approach (§26/§35)

Per §35 a module is *Done* only when tenant scoping is verified including an **RLS-bypass check where applicable**, and §26 lists an **"RLS policy test tool"** and **"RLS bypass attempt"** as required resilience tests. The strategy:

1. **Negative cross-tenant test** — seed tenants A and B; set GUC to A; assert every tenant-owned table returns **zero** rows belonging to B for SELECT/UPDATE/DELETE.
2. **Write-spoof test** — with GUC=A, attempt INSERT/UPDATE setting `tenant_id=B`; assert `WITH CHECK` rejects it.
3. **No-GUC test** — open a session **without** setting `app.tenant_id`; assert queries return zero rows (policy with a null GUC must not match) rather than all rows.
4. **Role test** — assert the runtime role lacks `BYPASSRLS` and is not superuser; assert `FORCE ROW LEVEL SECURITY` is set on every tenant table (lint/migration check).
5. **Coverage lint** — a CI check enumerates tenant-owned tables and fails if any lacks RLS enabled + a tenant policy (prevents a new table shipping unprotected).
6. **Guard-vs-RLS parity** — fuzz a query path with the app guard disabled in a test harness and confirm RLS alone still isolates (proves defense-in-depth).
7. **`RLS violation` alert path** — simulate a guard/RLS disagreement and assert the §25 security alert fires.

These run in Vitest (DB integration) + a dedicated **RLS policy test tool** (§26), and are wired into the §43 quality gates so a regression blocks merge (§40 test-driven corrections).

---

## 4. Deployment modes (§9)

| # | Mode | Who hosts | DB / infra | Domain / SMTP | Notes |
|---|---|---|---|---|---|
| 1 | **Multi-Tenant SaaS** | RetailOS | Shared PG + Redis + object storage; strict isolation + **RLS** | Platform + tenant custom domains (§11) | Default commercial tier. |
| 2 | **Dedicated single-tenant cloud** | RetailOS | Dedicated DB, Redis, object storage, **backups**, domain, SMTP | Per-tenant | DB-per-tenant. |
| 3 | **Managed private instance** | RetailOS (ops) / customer (owns) | DB-per-tenant on managed infra | Per-tenant | Customer owns license or private subscription. |
| 4 | **Self-hosted enterprise** | Customer | Customer DB on Docker / Compose / **K8s** | Customer | Source-escrow option (§37); RetailOS support boundary defined (§37). |

**Business logic must remain identical across all four** (§9). Differences are confined to config (§36), the isolation substrate (§2), and ops responsibility (§37 backup responsibility matrix).

---

## 5. Data sovereignty & residency (§9)

### 5.1 Everything endpoint-configurable (no hardcoded region)

Per §9 these **must** be environment-configurable (§36) and pinnable in-country/in-region — **no hardcoded AWS/Vercel/US assumptions**:

| Endpoint | Env-driven | Residency-pinnable |
|---|---|---|
| Database endpoint | ✅ | ✅ |
| Redis endpoint | ✅ | ✅ |
| Object storage (S3 / R2 / Spaces / B2 / **self-hosted MinIO**) | ✅ | ✅ |
| Backup target | ✅ | ✅ (in-country) |
| Replica / DR target | ✅ | ✅ (in-country/region) |
| Email egress (SMTP) | ✅ | ✅ |
| Webhook egress | ✅ | ✅ |
| Observability / logging endpoints | ✅ | ✅ |

Business logic **must not assume managed services with no in-region equivalent** (§9). Object storage **must** support self-hosted MinIO (§9).

### 5.2 Per-tenant residency attestation (§9)

Provide a **per-tenant data-residency attestation** that states, as data (not prose): where the **DB / files / backups / logs** live, **where email is sent from**, **what data leaves the region**, and **which integrations transmit externally**. Surfaced in the MSP console residency/attestation panel (§5/§10) and exportable.

Illustrative attestation shape:

```jsonc
{
  "tenant_id": "…",
  "deployment_mode": "dedicated_cloud",
  "region": "us-east-coast | eu-central | sa-north …",   // env-driven, not hardcoded
  "db_location": "…", "object_storage_location": "…",
  "backup_location": "…", "replica_location": "…",
  "log_location": "…",  "email_egress_origin": "…",
  "data_leaving_region": ["payment_provider:Stripe(US)", "…"],
  "external_integrations": ["QuickBooks(US)", "Twilio(US)", "…"],
  "attested_at": "…", "attested_by": "…"
}
```

> **Honesty constraint:** an attestation must reflect the *actual* configured endpoints. Asserting residency for endpoints the deployment cannot verify (e.g. a managed provider's downstream region) is a known gap — see Known limitations.

---

## 6. Migration fan-out + expand/contract (§8/§28)

### 6.1 Fan-out targets (§8)

A single migration release must apply across **all** topologies:

- the **shared SaaS** database (one DB, all tenants);
- **many dedicated** DBs (mode 2);
- **managed private** deployments (mode 3);
- **self-hosted** deployments (mode 4 — customer-initiated/updater-driven, §28);
- **Edge Hub** DBs (PG/SQLite, §15).

Fan-out runs under a dedicated migration role, per-target, with **review, rollback plan, pre-migration backup, staging validation, and production monitoring** (§28). Self-hosted/Edge targets pull migrations via the auto-update path (§28); clients too far behind schema are **force-locked until updated** (§28).

### 6.2 Expand / contract (§8/§28/§33)

**Never ship a destructive migration in the same release that begins using the new shape** (§8). Always:

```
1. EXPAND   — add new column/table/index (nullable / backfilled), backward-compatible.
2. BACKFILL — populate via background job (idempotent, tenant-scoped, §28).
3. SWITCH   — code reads/writes the new shape; old shape still present.
4. VERIFY   — data-quality + invariant checks pass across all fan-out targets.
5. CONTRACT — drop old column/table in a LATER release (add → backfill → switch → verify → drop later, §8).
```

This keeps SaaS, dedicated, managed, self-hosted, and Edge targets — which update on **different schedules** — mutually compatible during rollout.

---

## 7. Noisy-neighbor mitigation (§8)

Two mechanisms keep one tenant from degrading others on shared infrastructure (SaaS mode especially):

1. **Tenant-keyed token-bucket rate limiting** (§8). The backend enforces rate limits with a **token bucket keyed by `tenant_id`** (Redis-backed, §4). One tenant exhausting its bucket cannot consume another tenant's allowance or platform-wide capacity. Buckets are sized per subscription tier (§10 usage limits) so entitlement and throttling agree.
2. **Isolated heavy-job workers** (§8). Heavy tenant tasks — large CSV imports, report generation, analytics projections, sync ingestion (§28) — run on **isolated background worker nodes**, never inline on request handlers or shared with the checkout path. So one tenant's bulk import cannot exhaust shared resources or raise POS/checkout latency for others (POS p95 budget §44).

Both are observable (§26): per-tenant rate-limit hits, queue depth, and tenant **health score** feed the MSP console (§10) and alerting (§25).

---

## 8. Request lifecycle (tenant resolution) — illustrative

```text
1. Hono / TanStack Start router resolves tenant_id from HOSTNAME (§11).
2. Better Auth resolves session + ACTIVE ORGANIZATION (§6).
3. Assert hostname-tenant == active-org-tenant  → else 403 (anti-confused-deputy).
4. Open DB tx; SET LOCAL app.tenant_id = <tenant>  (RLS GUC, §3).
5. App tenant guard arms WHERE tenant_id = <tenant> (defense in depth, §3.3).
6. Entitlements pipeline (auth-authz.md §4): company/location scope, flags, license, device, approval.
7. Handler runs; every mutation audited (§25); RLS enforces row scope as backstop.
8. On any RLS/guard disagreement → emit `RLS violation` security alert (§25/§26).
```

---

## Known limitations / intentionally deferred

- **RLS ↔ Better Auth org interplay** — the GUC is derived from BA's `activeOrganizationId`; if a session has a stale/empty active org, policies must **fail closed** (zero rows), not open. The exact GUC-set timing under PgBouncer **transaction** pooling (`SET LOCAL` per tx) is designed here but must be load-validated before SaaS GA.
- **Residency attestation completeness** — attestations cover *RetailOS-controlled* endpoints; downstream regions of managed/3rd-party services (payment, SMS, IdP) are **declared, not enforced**. True end-to-end residency proof for external integrations is a gap pending provider-level guarantees/DPAs (§37).
- **DB-per-tenant RLS** — in dedicated/managed/self-hosted modes RLS is defense-in-depth only; the app guard remains the primary control. A uniform "RLS everywhere" posture across all modes is deferred.
- **Cross-mode migration drift** — expand/contract bounds risk, but self-hosted/Edge targets updating on their own schedule can lag; the **force-lock-when-behind** policy (§28) is designed but the version-skew tolerance window is not yet quantified.
- **Edge Hub multi-tenancy** — Edge Hubs are assumed single-tenant/single-site appliances; multi-tenant Edge Hubs are out of scope for now (§15).
- **Per-tenant encryption keys / regional KMS** — PII vault uses per-subject keys (§25); fully regional, per-tenant KMS key custody for residency-strict tenants is deferred to the security-hardening phase (Phase 13).
- **Tenant data export / portability** under residency constraints (§37 tenant export rights) is designed as a seam; the export tooling lands with the licensing/MSP phase (Phase 11).
- **Noisy-neighbor fairness tuning** — token-bucket sizes and heavy-worker pool capacity are initial targets; they must be tuned against real multi-tenant load (resilience tests §26, performance budgets §44).
