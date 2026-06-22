# RetailOS — Test Matrix (CLAIMED vs VERIFIED)

> **A ✅ means a suite ACTUALLY RUNS and PASSED** — never "a doc says it works."
> Legend: **✅ verified** (suite exists + ran + passed) · **◻ not-yet** (no suite) ·
> **n/a** (out of scope for that layer). DB-gated suites are run against a real
> ephemeral Postgres (bootstrap → migrate as `retailos_migrator` → run as
> `retailos_app`); they are skipped in the default gate but executed in CI's
> `db-rls` job and in pre-merge verification. Last verified: 2026-06-22, master `d39428d` (CI 4/4 green).

| Area | Unit | Integration | E2E | RLS | DB | Notes (what's verified) |
|---|:--:|:--:|:--:|:--:|:--:|---|
| Tenant isolation / RLS | ✅ | ✅ | ◻ | ✅ | ✅ | `tenant.rls.test` (fail-closed, cross-tenant denial) + `tenant-isolation-coverage` gate (every tenant table ENABLE+FORCE+policy) |
| Mojibake guard (tooling) | ✅ | n/a | n/a | n/a | n/a | `packages/config` (staged-blob, checkbox, i18n no-false-positive) |
| Settings resolver | ✅ | ◻ | n/a | n/a | n/a | `settings-resolver.test` (order, depth, set-once semantics) — **not yet wired into services** |
| Products / Catalog (CRUD, variant, SKU, barcode, UoM) | ◻ | ✅ | ◻ | ✅ | ✅ | router e2e + cross-tenant FK harness; RLS via coverage gate |
| Inventory ledger (movements, receive, adjust, count) | ◻ | ✅ | ◻ | ✅ | ✅ | `services.rls`, `stock-ledger`, vs1 integration (incl. countLineUpsert audit) |
| Costing — AVCO/FIFO/value-only | ◻ | ✅ | ◻ | ✅ | ✅ | `costing.rls`: resolver, AVCO zero-value invariant, FIFO layer locking, value-only (Gap A reject), stamp (Gap B), FIFO value-only reject |
| Costing set-once (D1) | ◻ | ✅ | ◻ | n/a | ✅ | router test: fresh OK / change-after-movement rejected / no-op OK |
| Idempotency / outbox / audit | ✅ | ✅ | ◻ | ✅ | ✅ | hash unit + concurrency + same-tx atomicity + §32 e2e |
| Money (minor units) | ✅ | ✅ | ◻ | n/a | ✅ | `money.test` + bigint columns; **precision >2^53 = issue #6 (not yet)** |
| Oversell flagging (D5) | ◻ | ✅ | ◻ | n/a | ✅ | vs1 integration: oversell emits `inventory.stock_discrepancy`, sale-correlated |
| Reorder suggestions (D7) | ◻ | ✅ | ◻ | ✅ | ✅ | inventory service + router (suggest-only) |
| POS sale (basic, online) | ◻ | ✅ | ◻ | ✅ | ✅ | `pos.createSale` §32 flow + idempotency; **offline/Tauri = not-yet (Phase 4)** |
| Reporting (valuation, low-stock, sales) | ◻ | ✅ | ◻ | ✅ | ✅ | basic report routers; read-model/star-schema = Phase 12 |
| cost_reconciliation emit | ◻ | ◻ | ◻ | ◻ | ◻ | **contract only; emit deferred (behavior pass, depends on #6)** |
| Accounting / GL | ◻ | ◻ | ◻ | ◻ | ◻ | Phase 5 |
| Procurement / landed cost | ◻ | ◻ | ◻ | ◻ | ◻ | Phase 6 |
| CRM | ◻ | ◻ | ◻ | ◻ | ◻ | Phase 7 |
| Ecommerce storefront | ◻ | ◻ | ◻ | ◻ | ◻ | Phase 8 |
| Hardware bridge | ◻ | ◻ | ◻ | ◻ | ◻ | Phase 9 |
| Edge Hub | ◻ | ◻ | ◻ | ◻ | ◻ | Phase 10 |
| UI (any surface) | ◻ | ◻ | ◻ | n/a | n/a | none — Playwright job is a placeholder; real product UI not started |

## How to refresh this matrix
Run the gates + DB-gated suites (the same sequence CI's `db-rls` job uses) and update a cell to ✅ **only** when the suite ran and passed. A doc claiming completion is **not** a ✅. Counts last verified: default gate `test` 7/7; DB-gated **db 44/44, api 11/11**; coverage gate green.
