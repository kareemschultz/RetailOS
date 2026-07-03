# RetailOS Production Readiness Completion Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Follow strict TDD for backend/service logic and thin verified UI wiring for React routes without a component harness.

**Goal:** Close the production-readiness gaps identified by `docs/architecture/production-readiness-gap-audit.md` without deploying to production until explicitly requested.

**Architecture:** Implement the smallest safe vertical slices on branch `feat/production-readiness-completion`. Backend/API changes are tenant-scoped, permission-gated, audited, and covered by focused tests. UI changes wire real oRPC endpoints and expose honest actions only when the backend supports them.

**Tech Stack:** Bun, Turbo, TypeScript, TanStack Start, Hono/oRPC, Drizzle/Postgres, Vitest, Ultracite.

---

## Safety Baseline

- Branch: `feat/production-readiness-completion`.
- Do not deploy or touch production services unless Kareem explicitly requests it.
- Existing commits on this branch:
  - `fix(api): guard number lease allocation FKs`
  - `feat: restore onboarding tax and catalog actions`
- Required reusable gate prefix in non-interactive shells: `PATH="$HOME/.bun/bin:$PATH"`.
- Required broad gates before final summary:
  - `PATH="$HOME/.bun/bin:$PATH" bun run check`
  - `PATH="$HOME/.bun/bin:$PATH" bun run check-types`
  - `PATH="$HOME/.bun/bin:$PATH" bun run test`
- DB/RLS-gated test suites must be reported honestly if they skip due to missing database env.

---

## Phase 1 — Catalog Import Commit + Product Import Wizard

### Task 1.1: Add backend `catalog.importCommit`

**Objective:** Convert validated import preview rows into persisted products, optional SKUs/lots/opening stock, with rollback-safe validation and idempotency.

**Files:**
- Modify: `packages/api/src/routers/vs1.ts`
- Test: `packages/api/src/routers/vs1.integration.test.ts`

**Backend contract:**
- Add `catalog.importCommit` under `catalogRouter`.
- Input:
  - `idempotencyKey: string`
  - `rows: ImportRow[]` matching/importing from `importPreview`
  - optional `locationId` for opening stock rows
  - optional `reference` / `notes`
- Behaviour:
  - `withTenant(db, ctx.tenantId, ...)`
  - permission `products.create`
  - re-run the same duplicate/UoM validation as `importPreview`
  - reject if any row has preview status `error`
  - atomic transaction: if any insert fails, no partial import remains
  - create `schema.product`
  - create `schema.sku` when `skuCode` is provided
  - resolve `baseUomCode` to visible UoM
  - create lot when `lotNumber` is provided
  - opening stock (`unitCostMinor` / quantity if added to row contract) must use existing inventory movement/service path, not raw ledger hacks
  - record audit for the batch and/or each persisted row
  - idempotent repeat with same key and request hash returns the original summary or a conflict if payload differs

**Tests first:**
- RED: import commit creates products/SKUs and returns counts.
- RED: duplicate product SKU rejects before inserts.
- RED: invalid UoM rejects before inserts.
- RED: same idempotency key + same payload is safe.
- RED: same idempotency key + different payload rejects.

**Focused gate:**
```bash
PATH="$HOME/.bun/bin:$PATH" bun -F @RetailOS/api test -- --run src/routers/vs1.integration.test.ts -t "catalog import"
```

### Task 1.2: Add `/products/import` wizard

**Objective:** Give operators a guided QuickBooks/CSV/XLSX product import flow with preview then commit.

**Files:**
- Create: `apps/web/src/routes/_app/products.import.tsx`
- Modify: `apps/web/src/routes/_app/products.index.tsx`
- Modify/generated: `apps/web/src/routeTree.gen.ts` via TanStack router generation
- Optional pure helpers/tests:
  - Create: `apps/web/src/lib/product-import.ts`
  - Test: `apps/web/src/lib/product-import.test.ts`

**UI contract:**
- Add `Import products` action on `/products`.
- Wizard steps:
  1. Paste/upload CSV data (XLSX support may parse via existing deps only; do not add heavyweight dependency without need).
  2. Map columns to import row fields.
  3. Call `orpc.catalog.importPreview` and render valid/error rows.
  4. Commit via `orpc.catalog.importCommit` only when there are no errors.
- Keep parsing/serialization helpers pure and unit-tested.

**Focused gates:**
```bash
PATH="$HOME/.bun/bin:$PATH" bun test apps/web/src/lib/product-import.test.ts
PATH="$HOME/.bun/bin:$PATH" bun run check-types
```

---

## Phase 2 — Existing Backend UI Action Surfaces

### Task 2.1: Wire SKU, variant, barcode, and UoM conversion actions

**Files:**
- `apps/web/src/routes/_app/skus.tsx`
- `apps/web/src/routes/_app/variants.tsx`
- `apps/web/src/routes/_app/barcodes.tsx`
- `apps/web/src/routes/_app/uom-conversions.tsx`

**Backend endpoints already present:**
- `catalog.skuCreate/update/archive`
- `catalog.variantCreate/update/archive`
- `catalog.barcodeCreate/update/archive`
- `catalog.uomConversionCreate/update/archive`

**UI contract:**
- Add create/edit/archive dialogs or row action panels.
- Use real product/SKU/UoM pickers from existing catalog list endpoints.
- Invalidate/refetch relevant queries after mutation.
- Display honest disabled states only when required data is unavailable.

**Focused gate:**
```bash
PATH="$HOME/.bun/bin:$PATH" bun run check-types
```

### Task 2.2: Wire inventory receive/adjust/count and lots actions

**Files:**
- `apps/web/src/routes/_app/inventory.tsx`
- `apps/web/src/routes/_app/lots.tsx`

**Backend endpoints already present:**
- `inventory.receive`
- `inventory.adjust`
- `inventory.countStart`
- `inventory.countLineUpsert`
- `inventory.countPost`
- `inventory.lotCreate/update/archive`

**UI contract:**
- Add receive stock form.
- Add adjust stock form.
- Add stock count start/line/post flow for current backend capabilities.
- Add lot create/edit/archive actions.

**Focused gate:**
```bash
PATH="$HOME/.bun/bin:$PATH" bun run check-types
```

### Task 2.3: Wire transfer, bond, and shift actions

**Files:**
- `apps/web/src/routes/_app/transfers.tsx`
- `apps/web/src/routes/_app/bonds.tsx`
- `apps/web/src/routes/_app/shifts.tsx`

**Backend endpoints already present:**
- `transfer.create/ship/receive/cancel`
- `bond.receive/release`
- `pos.openShift/cashMovement/closeShift`

**UI contract:**
- Transfers: create, ship, receive, cancel actions by state.
- Bonds: receive bonded stock and release bonded stock actions.
- Shifts: open shift, cash movement, close shift dialogs.

**Focused gate:**
```bash
PATH="$HOME/.bun/bin:$PATH" bun run check-types
```

---

## Phase 3 — Missing Backend APIs + Admin UIs

### Task 3.1: Company and location management

**Files:**
- Modify: `packages/api/src/routers/vs1.ts`
- Modify: `packages/api/src/routers/vs1.integration.test.ts`
- Modify: `apps/web/src/routes/_app/locations.tsx`
- Create or modify: company/settings route under `apps/web/src/routes/_app/`

**Backend contract:**
- `company.list/update/archive`
- `location.update/archive`
- tenant FK validation via `assertCompanyVisible` / `assertLocationVisible`
- audit all mutations

### Task 3.2: Tax admin

**Files:**
- Modify: `packages/api/src/routers/vs1.ts`
- Modify: `packages/api/src/routers/index.ts`
- Modify: `packages/api/src/routers/vs1.integration.test.ts`
- Create: `apps/web/src/routes/_app/settings.tax.tsx` or equivalent route
- Modify nav config if applicable

**Backend contract:**
- `tax.list/create/update/archive`
- use `schema.taxRate`
- audit mutations
- effective-date fields and active status exposed safely

### Task 3.3: Membership/staff admin

**Files:**
- Modify: `packages/api/src/routers/vs1.ts` or create dedicated router
- Modify: `packages/api/src/routers/index.ts`
- Modify: `packages/db/src/services/entitlements.ts`
- Modify/add tests: `packages/api/src/routers/vs1.integration.test.ts`
- Create: `apps/web/src/routes/_app/staff.tsx`

**Backend contract:**
- `membership.list`
- `membership.invite`
- `membership.updateRole`
- `membership.deactivate`
- coordinate Better Auth org `member` / `invitation` with RetailOS `membership`
- admin-only permissions

### Task 3.4: Audit log viewer

**Files:**
- Modify/create API router
- Modify: `packages/api/src/routers/index.ts`
- Modify: `packages/db/src/services/entitlements.ts`
- Create: `apps/web/src/routes/_app/audit-log.tsx` or reports route

**Backend contract:**
- `audit.list` with filters and pagination
- `audit.detail`
- `audit.view` permission
- safe DTO projection for `before`/`after`

### Task 3.5: Stock count read/cancel

**Files:**
- Modify: `packages/api/src/routers/vs1.ts`
- Modify: `packages/api/src/routers/vs1.integration.test.ts`
- Modify/create stock count UI in `apps/web/src/routes/_app/inventory.tsx` or a new route

**Backend contract:**
- `inventory.countList`
- `inventory.countDetail`
- `inventory.countCancel`
- reject line edits/post on cancelled/posted counts as appropriate

### Task 3.6: Bond release read-back

**Files:**
- Modify: `packages/api/src/routers/vs1.ts`
- Modify: `packages/api/src/routers/vs1.integration.test.ts`
- Modify: `apps/web/src/routes/_app/bonds.tsx`

**Backend contract:**
- `bond.releaseList`
- `bond.releaseDetail`
- show release history/details in UI

### Task 3.7: Number block admin

**Files:**
- Modify/create API router for numbering/admin
- Modify: `packages/api/src/routers/index.ts`
- Modify: `packages/api/src/routers/vs1.integration.test.ts`
- Create: numbering admin UI route

**Backend contract:**
- `numberBlock.list/create/update/archive` or `numbering.numberBlock*`
- validate company/location visibility
- audit all mutations
- preserve immutability for fields already used by leases/fiscal documents

---

## Phase 4 — Integration Branch Reuse — ✅ COMPLETE (Sonnet tranche-1, 2026-07-02)

No `retailos-integration` branch exists. Available module branches:
- `feature/procurement-financials`
- `feature/pos-offline-readiness`
- `feature/storefront-commerce`
- `feature/full-module-buildout`

**Safe candidate — PORTED:**
- Cherry-pick or manually port `1404ff9 feat(commerce): expose public storefront catalog`
  - `packages/api/src/routers/commerce.ts`
  - `packages/api/src/routers/commerce.integration.test.ts`
  - Commit `50283cb`. Fixed one genuine defect found in the ported source (redundant
    `primaryImage` duplicating `images[]` on the PDP read).

**Manual ports only, no wholesale merges — ALL PORTED:**
- Offline sync: `56fe9cf feat(pos): add offline sync ingestion foundation` — commit `4a079c9`,
  migration 0026.
- Procurement/accounting foundations: `b9cecc9 feat(procurement): add accounting foundations` —
  commit `b89ded9`, migration 0027.
- Later procurement extensions, applied strictly after foundations, in commit order:
  - `aaa6765`/`1dc4196`/`b815ef6`/`f4b0a5d` (GRN + supplier bills + landed cost + import batch,
    checked out at `f4b0a5d`'s final cumulative state) — commit `6b35f1f`, migration 0028.
  - `315680d` (reorder-suggestion → PO conversion) — commit `f32604f`, no new migration.
  - `6aa4a21` backend-only (vendor payment / AP posting seam; the source commit's self-serve
    onboarding gate touching `apps/web/**` was intentionally excluded — cleanly separable, zero
    dropped hunks needed) — commit `55663fa`, migration 0029.

**Do not accept wholesale — HONORED throughout:**
- `packages/api/src/routers/vs1.ts` — every hunk applied by hand per commit, never merged wholesale.
- migration metadata/snapshots — every migration regenerated via `drizzle-kit generate` against
  this branch's own numbering (0026→0029), never copied from the source branches; one
  FK-before-target-UNIQUE reordering fix applied by hand (migration 0027).
- generated route tree — `routeTree.gen.ts` drift reverted after every `check-types`/build run,
  never committed as part of a port.
- current tax/onboarding/POS refund files — untouched; zero `apps/web/**` files modified by any
  procurement/offline-sync/commerce port.

**Final gate (fresh disposable PG18, full chain 0000→0029):** check-types 7/7, ultracite clean,
mojibake clean, **db 125/125 + api 77/77 (zero skips)**, frozen `costing.ts`/`costing.rls.test.ts`
byte-identical after every single commit, `bun -F web build` green, shared infra
(`postgres-central`) confirmed untouched after every gate-db cycle.

---

## Phase 5 — Documentation + Final Gates

**Files:**
- Update: `docs/architecture/PROGRESS.md`
- Update: `docs/architecture/production-readiness-gap-audit.md` if status changed
- Optional: roadmap docs

**Doc rules:**
- Distinguish backend exists from UI usable.
- Mark DB/RLS tests honestly if skipped.
- Include branch, commits, gates, blockers, rollback notes.

**Final gates:**
```bash
PATH="$HOME/.bun/bin:$PATH" bun run check
PATH="$HOME/.bun/bin:$PATH" bun run check-types
PATH="$HOME/.bun/bin:$PATH" bun run test
git status --short --branch
git log --oneline --decorate -12
```
