# RetailOS — Folder Structure & Engineering Conventions

> **Status:** Phase 0 planning (design only — no implementation code).
> **Source of truth:** `docs/architecture/retailos-master-charter.md`. This document operationalises charter **§30 (Initial Deliverables: folder/monorepo structure)**, **§33 (Engineering Rules)**, **§34 (Repo Governance)**, **§35 (Definition of Done)**, **§36 (Environment & Config Matrix)**, and **§42 (Requirements discipline)**. Where this doc and the charter disagree, the charter wins; fix the contradiction and record it in `lessons-learned.md` (§40).
> **Audit date:** 2026-06-21.

---

## 1. Current Monorepo Layout (verified against repo)

Better-T-Stack monorepo, Bun + Turborepo. The layout below is what physically exists today (`apps/*`, `packages/*`).

```
RetailOS/
├── apps/
│   ├── server/        # Hono + oRPC API host (Better Auth mount, route composition)
│   ├── web/           # TanStack Start — SSR admin/back-office/storefront; Tauri SPA build target
│   ├── native/        # Expo / React Native (native-uniwind) — mobile POS, warehouse, dashboards
│   └── fumadocs/       # Documentation site
├── packages/
│   ├── api/           # oRPC routers + context (apps/server composes these)
│   ├── auth/          # Better Auth config + plugin wiring (§6)
│   ├── db/            # Drizzle schema, drizzle.config.ts, migrations, client (§18, §33)
│   ├── env/           # @RetailOS/env — typed env validation (server/web/native) (§36)
│   ├── ui/            # shadcn/Base UI owned components + custom RetailOS UI (§5)
│   └── config/        # shared tsconfig base + tooling config
├── docs/architecture/ # charter, adr/, module-specs/, competitive/, ui-inventory/, this doc
├── components.json     # root — shadcn MCP reads this (registries mirrored, §5)
├── docker-compose.yml  # dev infra (currently: web + postgres only — see §6 gaps)
├── turbo.json / package.json / biome.jsonc / bunfig.toml
```

**Boundary rule (§33 "keep the system modular"):** `apps/*` are thin composition hosts. Business logic lives in `packages/*` so it can be reused by the SSR web app, the Tauri desktop POS, the Expo native client, and background workers without duplication. `apps/server` wires `@RetailOS/api` + `@RetailOS/auth` + `@RetailOS/db`; it owns no domain logic of its own.

---

## 2. Where NEW Domain Code Lives — Module Folder Convention (§30 #9–10, §33)

RetailOS is **ERP-first** (§3): accounting, inventory, POS, CRM, procurement, etc. share **one** domain model. New code is organised as **bounded domain modules**, never as feature folders bolted onto a POS.

### 2.1 Package taxonomy

| Layer | Package(s) | Holds | Depends on |
|---|---|---|---|
| **Domain modules** | `packages/modules/<module>` (new) | Pure domain logic: services, entities, business rules, Zod schemas, domain events, repository interfaces. One folder per bounded context. | `db`, `events`, `env`, `core` |
| **Shared kernel** | `packages/core` (new) | Cross-cutting primitives used by every module: `Money` (minor units, §19), tenant-context type, audit helper, idempotency-key util, error codes, result types. | `env` only |
| **Data** | `packages/db` (exists) | Drizzle schema (split per module), migrations, tenant-scoped query helpers, RLS policy definitions. | `core` |
| **Events** | `packages/events` (new) | Outbox table contract, event registry + versioned payload schemas, publisher/subscriber interfaces (§24). | `core`, `db` |
| **Services / providers** | `packages/services/<provider>` (new) | Pluggable provider interfaces + adapters: fiscalization (§17), payments (§10/§23), tax, object-store, SMTP, OCR (§18), webhook dispatcher (§23), search (§27). Interface-first; managed adapters must have a self-hostable sibling (§9). | `core`, `env` |
| **API** | `packages/api` (exists) | oRPC routers that call module services. No business logic — orchestration + authz + validation only. | `modules/*`, `auth`, `events` |
| **Auth** | `packages/auth` (exists) | Better Auth + Entitlements Service boundary (§6/§7). | `core`, `db` |
| **UI** | `packages/ui` (exists) | Owned shadcn/Base UI components + the ~13 custom RetailOS builds (§5, `ui-inventory/gaps-and-custom.md`). | — |
| **Workers** | `packages/jobs` (new) | Idempotent background jobs: sync ingestion, webhooks, reports, imports, fiscal submission (§28). Runs on isolated worker nodes (§8 noisy-neighbour). | `modules/*`, `events` |

### 2.2 Canonical module folder shape

Every domain module under `packages/modules/<module>/src/` follows the same skeleton so modules are predictable and reviewable (§33, §48):

```
packages/modules/inventory/
├── package.json            # @RetailOS/module-inventory
├── README.md               # → links to docs/architecture/module-specs/inventory.md (§42)
└── src/
    ├── schema.ts           # Drizzle tables for this module (re-exported into packages/db)
    ├── events.ts           # domain events this module emits/consumes (versioned, §24)
    ├── errors.ts           # structured error codes for this module (§25)
    ├── permissions.ts      # permission keys this module defines (§7)
    ├── <entity>.service.ts # business logic; tenant-scoped; emits events; writes audit + ledger
    ├── <entity>.repo.ts    # tenant-scoped data access (no cross-tenant query path)
    ├── <entity>.dto.ts     # Zod input/output schemas (§33 validation)
    └── *.test.ts           # Vitest unit/integration (§35, §43)
```

**First modules (map to phase-roadmap):** `tenant`, `iam` (auth/RBAC/entitlements), `audit`, `catalog` (products/variants/SKU), `inventory` (ledger), `locations` (companies/warehouses/bonds), `pos`, `accounting`, `procurement`, `crm`, `ecommerce`, `billing` (SaaS/licensing), `edge-sync`, `hardware`, `fiscal`, `reporting`. Build **one module at a time** (§33), entry-gated by its module spec (§42) and exit-gated by the Definition of Done (§35).

---

## 3. Engineering Rules Digest (§33 — authoritative is the charter)

These are the non-negotiable rules every module and PR is checked against. Full text in charter §33; AI-agent restatement in §39.

- **ORM:** Drizzle ORM only — never Prisma. Strict TypeScript everywhere.
- **Validation:** Zod (or equivalent) on every external/input boundary.
- **Tenant scoping:** *Every* query is tenant-scoped. Shared-SaaS tenant-owned tables plan for PostgreSQL **RLS** (§8/§9). No code path may read across tenants.
- **Audit:** *Every* mutation writes an immutable audit log (§25). Every financial transaction is traceable.
- **Inventory ledger:** *Every* inventory movement creates a **ledger entry** — never a bare counter increment (§18). Stock-on-hand is derived from the ledger.
- **POS idempotency:** *Every* POS sale is idempotent end-to-end (§19/§23). Every offline-sync mutation is replay-safe; never silently discard an offline transaction (§13/§14).
- **One inventory model:** Do not create separate inventory systems for POS and ecommerce (§21).
- **Money:** Store/compute as **integer minor units** only — never floats. Store amount + currency code + minor-unit scale together. Do not assume 2 decimals. One rounding policy, applied consistently (§19).
- **Time:** Device clocks are untrusted; server time is authoritative for accounting periods and fiscal posting (§14). Store timestamps in UTC, render per tenant/location timezone (§12).
- **Deletes:** No hard deletes for operational data unless a legal erasure workflow governs it (crypto-shredding, §25). Use `deleted_at` soft-delete.
- **Migrations:** **Expand/contract** only — add, backfill, switch, verify, drop later. Never ship a destructive migration in the same release that begins using the new shape (§8).
- **Analytics:** Do not run heavy analytics on OLTP checkout tables — use read replicas / read models (§27).
- **Secrets:** Envelope encryption; no plaintext secrets in git; never log decrypted secrets (§25).
- **PII:** Separate erasable PII into a per-subject-key vault, kept apart from immutable operational/audit records (§25).
- **Don'ts:** Don't skip accounting/CRM/Better-Auth architecture; don't implement everything at once; prefer guided workflows over raw CRUD.

---

## 4. Naming & Code-Organisation Conventions

### 4.1 Database (Drizzle / Postgres)

- **Tables:** `snake_case`, plural (`stock_ledger_entries`, `offline_sales_queue`). Junction tables `a_b` (`role_permissions`).
- **Columns:** `snake_case`. Money columns always carry the trio: `<x>_amount_minor` (bigint), `<x>_currency` (char(3)), `<x>_minor_unit_scale` (smallint) (§19).
- **Tenancy column:** `tenant_id` on every tenant-owned table (§8). Hierarchy FKs as needed: `company_id`, `location_id`.
- **Audit columns (every tenant-owned table):** `created_at`, `updated_at`, `deleted_at` (nullable, soft-delete), `created_by`, `updated_by` (§8/§33). Append-only ledger/event/audit tables omit `updated_at`/`deleted_at` (immutable).
- **Offline/idempotency columns** on syncable mutations: `idempotency_key`, `device_id`, `terminal_id`, `monotonic_counter`, `payload_version`, `sync_batch_id` (§14/§25).
- **Enums:** Postgres enums in `snake_case`; map to TS `as const` union types.
- **Indexes:** lead with `tenant_id` on tenant-scoped indexes so RLS-filtered queries stay sargable.

### 4.2 TypeScript / files

- **Files:** `kebab-case.ts`; role suffix from §2.2 (`.service.ts`, `.repo.ts`, `.dto.ts`, `.test.ts`).
- **Types/Zod schemas:** `PascalCase` (`StockLedgerEntry`, `CreateSaleInput`).
- **Functions/vars:** `camelCase`; no magic numbers — extract named `as const` constants (CLAUDE.md / Ultracite).
- **Packages:** `@RetailOS/<name>` (matches existing `@RetailOS/env`, `@RetailOS/db`). Modules: `@RetailOS/module-<name>`.
- **Permission keys:** `domain.action` (`inventory.adjust`, `pos.refund`) — see charter §7.
- **Event names:** `domain.past_tense` (`sale.created`, `bond.released`) — charter §24.
- **No barrel files** that re-export everything (CLAUDE.md performance rule); import from specific paths.

---

## 5. Module Spec + Definition-of-Done (pointers)

- **Module spec template (entry criteria, §42):** lives at `docs/architecture/module-specs/` (`README.md` is the index; each module gets `<module>.md`). Every spec documents: vision, personas, user stories, acceptance criteria, business rules, edge cases, permissions, reporting, offline behaviour, integration needs, and migration/import (including migrating in from §41 competitors). **No module implementation begins until its spec exists.**
- **Competitive analysis (§41):** required before Inventory, POS, Accounting, CRM, Ecommerce, Procurement, Warehousing, Assets, HR — recorded in `docs/architecture/competitive/<module>.md` with a P0–P3 parity matrix.
- **Definition of Done (exit criteria, §35):** a module is Done only when types pass, tests pass, tenant scoping is verified (incl. RLS-bypass check where applicable), audit logging works, errors are friendly + structured, logs are structured, permissions/entitlements enforced, money uses minor units, and docs (module spec + ADRs) are updated.
- **ADRs (§34):** every architectural decision is an ADR in `docs/architecture/adr/` (template `0000-template.md`); no silent architectural change.

---

## 6. Environment & Configuration Matrix (§36)

**Principle (§9/§36):** *no environment-specific behaviour is hardcoded.* Every endpoint, secret, flag, deployment mode, and residency mode is environment-driven and validated through `@RetailOS/env`. No hardcoded AWS/Vercel/US/region assumptions. Object storage must support self-hosted MinIO. All tokens below are **placeholders only** — real values come from Infisical and are never committed (§25).

### 6.1 Environment × required configuration

Legend: ● required · ○ optional/feature-gated · — N/A · *plc* = placeholder var name.

| Config key (placeholder) | local | docker-dev | SaaS staging | SaaS prod | dedicated cloud | managed-private | self-hosted | Edge Hub | Tauri desktop | native mobile |
|---|---|---|---|---|---|---|---|---|---|---|
| `DATABASE_URL` | ● | ● | ● | ● | ● (per-tenant DB) | ● (per-tenant DB) | ● (customer DB) | ● (local PG/SQLite) | — (local SQLite) | — (local SQLite) |
| `REDIS_URL` | ○ | ● | ● | ● | ● | ● | ● | ○ | — | — |
| `OBJECT_STORE_ENDPOINT` | ○ (MinIO) | ● (MinIO) | ● | ● | ● | ● | ● (MinIO ok) | ○ | — | — |
| `OBJECT_STORE_BUCKET` | ○ | ● | ● | ● | ● | ● | ● | ○ | — | — |
| `OBJECT_STORE_REGION` | ○ | ○ | ● | ● | ● | ● | ● | — | — | — |
| `SMTP_URL` / `SMTP_FROM` | ○ | ○ | ● | ● | ● | ● | ● | — | — | — |
| `BETTER_AUTH_SECRET` | ● | ● | ● | ● | ● | ● | ● | ●* (device-scoped) | — | — |
| `BETTER_AUTH_URL` | ● | ● | ● | ● | ● | ● | ● | ● (LAN) | — | — |
| `CORS_ORIGIN` | ● | ● | ● | ● | ● | ● | ● | ● | — | — |
| `BILLING_PROVIDER` + `BILLING_SECRET` (Stripe/Paddle/…) | ○ | ○ | ● | ● | ○ | ○ | — (license, not SaaS) | — | — | — |
| `LICENSE_SERVER_URL` / `LICENSE_KEY` (product license, §10/§37) | ○ | ○ | ○ | ○ | ● | ● | ● | ● (offline grace) | ● | ○ |
| Registry tokens `MAGICUI_PRO_REGISTRY_TOKEN`, `EMAIL`, `LICENSE_KEY` (studio) | ◐ dev-only | ◐ dev-only | ◐ CI | ◐ CI | — | — | — | — | — | — |
| `DEPLOYMENT_MODE` (`saas` / `dedicated` / `managed-private` / `self-hosted` / `edge-hub`) | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `DATA_RESIDENCY_MODE` / region pin (§9) | ○ | ○ | ● | ● | ● | ● | ● | ● | — | — |
| `EDGE_HUB_UPSTREAM_URL` + mTLS certs (§15/§29) | — | ○ | — | — | ○ | ○ | ○ | ● | — | — |
| `KMS_PROVIDER` / master-key source (§25) | ○ | ○ | ● | ● | ● | ● | ● (Vault/sealed) | ● | — | — |
| `SENTRY_DSN` / observability endpoint (§26) | ○ | ○ | ● | ● | ● | ● | ○ | ○ | ○ | ○ |
| `SEARCH_PROVIDER` (`pg-fts` / `typesense` / `meili`) (§27) | ○ pg-fts | ○ pg-fts | ● | ● | ● | ● | ● | — | — | — |
| Feature flags (`*_enabled`, §10) | env-default | env-default | DB-driven | DB-driven | DB-driven | DB-driven | DB-driven | snapshot | snapshot | snapshot |

Notes:
- **Feature flags** are runtime/DB-driven per tenant (§10), env only sets safe defaults; offline clients (Edge Hub, Tauri, native) carry a cached **entitlement/flag snapshot** (§13).
- **Billing** is SaaS-tier only; dedicated/self-hosted use the **product license** path (§10/§37), so `BILLING_*` is N/A there.
- **Registry tokens** (◐) are local-developer / CI-only secrets for the shadcn / Magic UI Pro CLI — never shipped in any runtime artifact (§5/§25).
- **Tauri/native** carry no DB/Redis/object-store creds: they talk to the API and use a local offline store (SQLite, §4); secrets stay server-side.

### 6.2 Env-validation — required vars per app/package (driven by `@RetailOS/env`)

`@RetailOS/env` (`@t3-oss/env-core` + Zod) is the single validation gate; apps import the relevant entry and fail fast on boot if a required var is missing or malformed. **Current state vs. target** (the matrix above is the target the env package must grow into — flagged so it is not mistaken for "done"):

| Consumer | env entry | Currently validated (verified in repo) | Target additions (this matrix) |
|---|---|---|---|
| `apps/server` (+ `packages/api`, `auth`, `db`, `jobs`) | `@RetailOS/env/server` | `DATABASE_URL`, `BETTER_AUTH_SECRET` (≥32), `BETTER_AUTH_URL`, `CORS_ORIGIN`, `NODE_ENV` | `REDIS_URL`, `OBJECT_STORE_*`, `SMTP_*`, `BILLING_*`, `LICENSE_*`, `DEPLOYMENT_MODE`, `DATA_RESIDENCY_MODE`, `KMS_PROVIDER`, `SENTRY_DSN`, `SEARCH_PROVIDER`, Edge-Hub mTLS — each gated as required only when its feature is enabled |
| `apps/web` | `@RetailOS/env/web` | `VITE_SERVER_URL` | client-safe public flags only (no secrets ever reach the client bundle) |
| `apps/native` | `@RetailOS/env/native` | `EXPO_PUBLIC_SERVER_URL` | client-safe public config only |
| Edge Hub (`packages/jobs` / edge image) | `@RetailOS/env/edge` (new) | — | `DATABASE_URL` (local), `EDGE_HUB_UPSTREAM_URL` + mTLS, `DEPLOYMENT_MODE=edge-hub`, offline grace window |

**Rules:** required-ness is conditional on `DEPLOYMENT_MODE` and feature flags — e.g. `BILLING_SECRET` is required only when `DEPLOYMENT_MODE=saas`; `EDGE_HUB_UPSTREAM_URL` only when `edge-hub`. `SKIP_ENV_VALIDATION` exists for build-time/Docker steps only, never for runtime. Secrets are read from env (Infisical-injected), never inlined. `.env.example` lists every var with a comment pointing at its Infisical path (current example covers only registry tokens — must be extended to the full matrix).

> **Docker-compose gap (flag):** the current `docker-compose.yml` defines only `web` + `postgres`. Per §47 ("Foundation Before Features"), dev infra must also provide **Redis, object storage (MinIO), and a background worker** before feature modules begin. Tracked in `phase-0-checklist.md` and the roadmap.

---

## Known limitations / intentionally deferred

- **`packages/modules/*`, `packages/core`, `packages/events`, `packages/services/*`, `packages/jobs` do not exist yet** — this document defines the convention; scaffolding is Phase 0/1 work, one module at a time (§31).
- **`@RetailOS/env` currently validates only the scaffold defaults** (§6.2). The full §36 matrix is the target schema, not the current one — additions land per-feature so unused vars aren't forced.
- **`docker-compose.yml` lacks Redis / MinIO / worker** services required by §47; deferred to the foundation pass.
- **Edge Hub env entry (`@RetailOS/env/edge`) and DEPLOYMENT_MODE-conditional validation** are designed here but not implemented.
- **Migration fan-out tooling** (shared-SaaS + many dedicated DBs + Edge Hub DBs, §8) is a strategy here; the runner is deferred.
- **Per-module specs and competitive analyses** (§41/§42) are required before each module but not yet written — only the index `README.md` files exist.
- Exact provider adapters (fiscalization, payments, OCR, webhook dispatcher, search) are interface-first seams; concrete adapters are deferred to their phases (§17/§23/§27).
