# RetailOS Quality, Security & Operations Strategy

> **Scope.** This is the **single canonical home for all QA / quality content** in RetailOS — error handling, structured logging, observability, analytics read-models, secrets, disaster recovery, the testing strategy, CI/CD, and the automated quality gates with their performance/SLO budgets. There is **no separate `qa-checklist.md`**; the required-tests list and the gate list below are the QA checklist.
>
> **Companion doc.** The concrete, actionable security baseline (headers, CORS, rate limits, cookies, edge mTLS, etc.) lives in [`security-baseline.md`](./security-baseline.md). This document carries the *strategy and prose*; that one carries the *wired knobs*. They cross-reference, never duplicate.
>
> **Source of truth.** Everything here is derived from and traceable to `retailos-master-charter.md`. Section citations (§) point back to it; if this doc and the charter disagree, the charter wins and this doc is corrected in the same change (§40).

---

## 1. Error Handling (§25)

RetailOS treats errors as a first-class product surface: a cashier, warehouse worker, or accountant must always get a friendly, recoverable message, while engineers get full technical detail server-side.

### Principles

- **Never expose raw stack traces** to any client (web, Tauri, native). Raw traces, SQL, internal hostnames, and provider error bodies stay server-side.
- **Friendly, actionable messages.** Every user-facing error states what happened in plain language, why (where safe to say), and what to do next (retry, contact manager, escalate).
- **Structured error codes.** Every error carries a stable machine code (`RETAILOS_<DOMAIN>_<REASON>`), an HTTP status, a user-message key (i18n-translatable, English/Spanish/Dutch/French/Portuguese — §12), and a `category`.
- **Always attach correlation context.** `request_id` and `correlation_id` ride on every error, plus `tenant_id`, `user_id`/`employee_id`, `company_id`/`location_id`, `device_id`/`terminal_id`, `idempotency_key`, and `sync_batch_id` where available (mirrors the audit-log shape in §25).
- **Retry / escalation actions.** The error envelope declares whether the action is safely retryable, whether it auto-retries, and the escalation path (e.g. "requires manager override", "queued for sync", "report to support").

### Error category taxonomy (§25)

Errors are separated into distinct categories so the UI, logs, alerting, and retry policy can branch correctly:

| Category | Examples | Default client treatment |
|---|---|---|
| `validation` | bad input, schema/Zod failure, business-rule violation | inline field error, focus first error, no retry |
| `permission` | RBAC/entitlement denied, feature flag off, license/limit exceeded | friendly "you don't have access" + who to ask |
| `network` | timeout, offline, DNS, upstream unreachable | retry affordance; on POS → fall to offline queue (§13) |
| `sync` | reconnection/replay failure, batch rejected, payload-version mismatch | guided sync recovery; keep failed entries visible (§14) |
| `accounting` | unbalanced journal, closed period, missing account mapping | block posting, manager escalation, never silent |
| `inventory_conflict` | oversell, negative stock, ledger invariant breach | surface conflict, alert manager, compensating entry (§14) |
| `hardware` | printer offline, drawer not responding, scanner/scale fault | "test print / retry" tool, fall back to manual (§16) |
| `fiscal` | fiscal submission rejected, signing failure, numbering gap | track status, retry queue, fiscal-status checker (§17/§26) |
| `integration` | webhook/provider failure, OAuth expiry, OCR/parse error | DLQ + manual replay, mark degraded, do not block core (§23) |

### Error envelope (illustrative)

```jsonc
// returned to clients — NO stack, NO internal detail
{
  "error": {
    "code": "RETAILOS_INVENTORY_CONFLICT_OVERSELL",
    "category": "inventory_conflict",
    "messageKey": "errors.inventory.oversell",          // i18n
    "message": "This item went out of stock while you were offline.",
    "retryable": false,
    "escalation": "manager_override",
    "requestId": "req_01J…",
    "correlationId": "cor_01J…"
  }
}
```

Server logs the same `code` + `requestId` plus the full technical payload (stack, query, provider response) under the structured-logging contract below.

---

## 2. Structured Logging (§25) + Observability (§26)

### Log categories (§25)

All logs are structured (JSON), tenant-scoped, and carry `request_id`/`correlation_id`. Eleven first-class categories:

`app` · `api` · `audit` · `sync` · `edge_hub` · `hardware_bridge` · `payment` · `accounting` · `background_jobs` · `integration` · `security` · `fiscal`.

- **No decrypted secrets ever logged**; secret values are redacted at the serializer boundary (see §4 Secrets).
- **Audit log is immutable** and distinct from operational logs — it is the legal record (§25), with old/new JSONB, actor, impersonator, IP, device, geo.
- Logs are shippable to an environment-configurable endpoint (no hardcoded vendor/region — §9/§36).

### Observability — metrics, traces, health (§26)

- **Metrics:** API p95 latency, DB latency, Redis depth, failed jobs, sync depth, offline-terminal count, Edge Hub status, failed webhooks/postings, slow reports, error rates, storage usage, backup status, **POS checkout latency, sync lag, fiscal latency, report-generation time**.
- **Traces:** distributed tracing keyed on `correlation_id` end-to-end (web/Tauri/native → API → jobs → integrations), so one POS sale or one sync batch can be followed across services.
- **Health checks:** per-service liveness/readiness; sync, queue, job, Edge Hub, hardware, payment, and integration monitoring as named health surfaces.
- **Tenant health score (§10/§26):** a per-tenant rollup (sync health, offline terminals, queue depth, failed postings, backup status, usage-vs-limit) surfaced in the Platform/MSP console.

### Critical alerts (§25)

Alert (page/notify) on: failed webhooks, failed postings, failed sync, Edge Hub queue stuck, printer unavailable, migration failure, suspicious refund/void, repeated login failures, tenant nearing limits, backup failure, unbalanced journal, unauthorized access, fiscal failure, numbering gap, **RLS violation**.

### In-app "Report Issue" diagnostic capture (§26)

A **"Report Issue"** control in every client auto-bundles current app state, offline queue depth, local SQLite/Dexie status, and the active `correlation_id`/`request_id` into a telemetry report for support — front-end observability via **Sentry** (or equivalent, behind an interface). **A cashier must never need to find a request ID manually.**

---

## 3. Analytics, Reporting & Read-Models (§27)

**Hard rule: never run heavy analytics directly on OLTP checkout tables.** Analytics latency must never bleed into the POS path.

- **Read isolation.** Reporting reads from **read replicas, materialized views, CQRS read models, summary/star-schema tables, and domain-event-fed analytics projections** (fed by the Outbox, §24) — generated by background jobs (§28), never by ad-hoc joins on live sale tables.
- **Tenant-scoped + RLS at the read layer.** Every report, projection, and materialized view honors tenant scope and applies PostgreSQL RLS at read time — the read path is not a tenant-isolation bypass.
- **Correlated insights (§27).** Beyond raw reports, the engine surfaces cross-domain insights (sales spike → low stock; high revenue / poor margin; frequent buyer / overdue balance; rep revenue / high refund rate; warehouse delay → ecommerce miss; cashier void anomaly; supplier delay → stockout; online-vs-store mismatch; high sales / poor cash reconciliation; bonded backlog → branch shortage).
- **Search behind an interface (§27).** Start with **PostgreSQL FTS** for small catalogs; graduate to **Typesense / Meilisearch / OpenSearch** once catalog/query thresholds require it. Search is always tenant-scoped and **behind an interface** so the engine can change without touching callers.

---

## 4. Secrets (§25)

- **Envelope encryption** for all secrets: SMTP credentials, integration API keys, OAuth tokens, fiscal signing keys, webhook secrets, payment secrets, SSO secrets, **and registry tokens** (shadcn studio / Magic UI Pro — §5/§36).
- **Master key source is pluggable and environment-driven:** cloud **KMS**, self-hosted **Vault**, **sealed secrets**, or **customer-managed key** — chosen per deployment tier (§9) so self-hosted/data-sovereign tiers never depend on a managed-only KMS.
- **Redact, never log.** Decrypted secrets are never logged; serializers redact at the boundary.
- **No plaintext secrets in git.** Tokens live in gitignored env (Infisical-sourced) or the secret store; never inline in `components.json`, the charter, or shipped artifacts.

---

## 5. Disaster Recovery (§28, §15)

- **Automated backups** of all tenant data, on a schedule per deployment tier.
- **PITR** (point-in-time recovery) for the primary database.
- **In-country / cross-region** backup and replica targets, **pinnable to a region** for data residency (§9) — no hardcoded US/AWS assumption (§36).
- **Restore testing + backup verification** are scheduled and produce a **restore-test report** (§26 helper tool); a backup that has never been restored is not a backup.
- **Tenant export** (right to leave / portability — §37) and **self-hosted backup scripts**.
- **Edge Hub DR (§15):** the Edge Hub runs continuous local backups of its Postgres/SQLite state to a **separate physical medium** (USB / NAS / back-office PC) and can **export unsynced transactions**, so an extended outage followed by hardware loss does not destroy offline transactions that never reached the cloud.
- **RPO/RTO per deployment tier** (see §8 budgets table below) and written **DR runbooks** per tier.

---

## 6. Testing Strategy (§4, §28)

### Layers

- **Vitest** — unit + integration tests.
- **Playwright** — web E2E, POS simulation, terminal workflows, plus:
  - **Offline E2E** — Playwright against **MSW / disabled network** to simulate ISP failure mid-checkout and the reconnection/sync that follow (§4/§13).
  - **VRT (visual regression)** — snapshot key surfaces (POS checkout, dashboards, storefront) **per tenant theme**; tenant theme tokens (radius, colors, fonts) must not break layout or push controls off-screen (§5/§11).
- **Native E2E** — **Maestro or Detox** for the Expo/React Native app (Playwright is web-only — §4).
- **Property tests** — inventory ledger invariants and numbering integrity (§26 resilience tests).

### Required tests (§4/§26 — this is the QA checklist)

This list is mandatory; a module is not Done without the relevant tests (§35):

- [ ] **Offline POS** — sale/payment/refund queue locally, receipt generates offline, totals reconcile (§13).
- [ ] **Sync retry** — sequential replay with idempotency keys; failed entries stay visible; no silent discard (§13/§14).
- [ ] **Edge Hub** — LAN transaction coordination, local number blocks, upstream sync, conflict resolution (§15).
- [ ] **RLS isolation** — tenant A cannot read/write tenant B; RLS-bypass attempt fails (§8/§26).
- [ ] **RBAC** — cashier confined to POS; finance has no warehouse rights; warehouse has no financial rights (§7).
- [ ] **Accounting posting** — double-entry balances; unbalanced journal rejected; closed period blocked (§20).
- [ ] **Inventory ledger invariants** — property tests: no movement lost/duplicated; on-hand = sum of ledger (§18/§14).
- [ ] **Payment webhooks** — signature verify, idempotent, out-of-order/duplicate tolerated, DLQ + replay (§23).
- [ ] **Tauri build** — static/SPA target builds and runs without assuming the SSR server is reachable (§4).
- [ ] **Mobile payloads** — native sync payloads serialize/deserialize and upcast correctly (§4/§13).
- [ ] **Migration fan-out** — expand/contract migration applies across shared SaaS / dedicated / managed / self-hosted / Edge Hub DBs (§8).
- [ ] **Fiscal / document numbering** — sequential, tamper-evident, per company/location/year/type/series; gap/out-of-sequence detected; no two terminals mint the same number (§17).
- [ ] **Reconnection avalanche** — N terminals + M Edge Hubs reconnecting; backpressure/rate-limit holds; no lock storm or API timeout (§14).

Additional resilience tests (§26): app killed mid-sale, corrupt/duplicate queued mutation, offline session expiry, payload-version upcast, numbering-gap simulation.

### Test-driven corrections (§40)

Every `lessons-learned.md` entry for a bug or architectural failure gets a corresponding Vitest/Playwright regression test, so the mistake is mechanically prevented from recurring.

---

## 7. CI/CD (§28) + Automated Quality Gates (§43)

### Gate list (§43) — a failing gate blocks merge

| Gate | Tool | Status |
|---|---|---|
| Type check | `bun run check-types` (turbo `tsc`) | **Wired now** (root script exists) |
| Lint + format | Biome / Ultracite (`bun run check`) | **Wired now** (root script exists) |
| Unit + integration | Vitest (`bun run test`) | **TODO** — `test` script not yet wired (§28) |
| E2E + VRT | Playwright (incl. offline-E2E, per-theme VRT) | **TODO** — Playwright config not yet added |
| Accessibility | WCAG **2.2 AA** automated checks | **TODO** |
| SAST + secret scan | static analysis + secret detection | **TODO** |
| Dependency audit | `bun`/`npm audit` or equivalent | **TODO** |
| Container scan | **Trivy** (or equivalent) before registry push | **TODO** |
| Bundle-size + perf budgets | bundle analysis + §44 budgets | **TODO** |

> **Wired NOW:** `check-types`, `check`/`fix` (root `package.json`). **TODO (Phase 0/1, §28):** a `test` and `lint` root script, `.github/workflows/ci.yml`, Vitest config, Playwright config — none exist in the scaffold yet and must be added before Phase-0 lock-in (§46).

### Required root scripts (§28/§43)

Root `package.json` must expose `test`, `lint`, and `check-types` (and the gates above run on every PR). `check-types` and `check` exist; `test` and `lint` are the gap.

### Build & environment (§28)

- **Ephemeral per-PR preview environment** so UI/UX and API changes are verified in isolation before merge.
- **Docker multi-stage + distroless / Alpine-minimal** production images (Edge Hub, cloud backend, app images) to cut attack surface and size; CI enforces image + bundle-size limits and runs **container vulnerability scanning** before pushing.
- **Migrations** require review, rollback plan, pre-migration backup, staging validation, production monitoring, and the **expand/contract fan-out** strategy (§8).
- CI builds all targets: SaaS / dedicated / managed / self-hosted, Edge Hub Docker images, hardware daemon releases, **Tauri** builds, **native mobile** builds.

### Performance budgets + SLO/RPO/RTO (§44, §28)

**Performance budgets (§44)** — enforced through the §43 perf gate; tighten with real-device data:

| Surface | Budget |
|---|---|
| POS initial load | < 2s |
| POS product search | < 100ms |
| Barcode-scan response | < 50ms |
| Add item to cart | < 50ms |
| Admin first load | < 3s |
| Warehouse scan response | < 100ms |
| Offline operations | no visible lag |

Performance regressions are tracked and **blocked in CI**.

**SLOs (§28):** POS checkout p95, POS search latency, sync lag, API p95, report generation, payment-webhook processing, Edge Hub recovery.

**RPO/RTO per deployment tier (§28/§9)** — initial targets, refine per contract:

| Tier | RPO (target) | RTO (target) | Notes |
|---|---|---|---|
| Multi-tenant SaaS | ≤ 5 min (PITR) | ≤ 1h | cross-region/in-region replicas |
| Dedicated cloud | ≤ 15 min | ≤ 2h | per-tenant DB, region-pinned |
| Managed private | ≤ 15 min | ≤ 4h | per contract / SLA |
| Self-hosted | customer-defined | customer-defined | RetailOS supplies scripts + runbooks (§37) |
| Edge Hub | local-continuous | best-effort | local-medium backup; unsynced export (§15) |

**Compliance roadmap (§28):** SOC 2 / ISO 27001-style controls — access reviews, change management, audit logs, encryption, backup testing, incident response, vendor risk.

---

## Known limitations / intentionally deferred

- **`test` and `lint` root scripts, `.github/workflows/ci.yml`, Vitest config, and Playwright config do not yet exist** in the scaffold. Only `check-types`, `check`, and `fix` are wired. All other gates (unit/integration, E2E/VRT, a11y, SAST/secret-scan, dep-audit, container-scan, bundle/perf) are **TODO** for Phase 0/1 (§28/§46).
- **RPO/RTO and performance budgets are initial targets**, not yet validated against real-device or production load; they will tighten with measured data (§44).
- **Sentry (front-end observability) is the named direction** but is behind an interface and not yet integrated; the "Report Issue" capture is designed, not implemented (§26).
- **Search graduation** (FTS → Typesense/Meili/OpenSearch) is a deferred trigger; only PostgreSQL FTS is in scope initially (§27).
- **SOC 2 / ISO 27001 controls are a roadmap**, not a current certification; the doc enumerates the control areas to build toward (§28).
- **OCR/LLM document-parsing observability** (AI-extracted vs user-corrected audit) is a reserved seam, not wired (§18).
- This document is **planning/design only** — no implementation code; illustrative config/pseudocode is illustrative.
