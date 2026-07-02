# RetailOS Production-Readiness Gap Audit (2026-07-01)

> **STATUS UPDATE (2026-07-02, branch `feat/production-readiness-completion`):** the core build list
> below has been implemented. Shipped: §1 QuickBooks/CSV import (backend `catalog.importCommit` with
> opening stock through the real receive/valuation path + the `/products/import` 4-step wizard);
> §2 CRUD wiring on skus/variants/barcodes/uom-conversions/inventory/lots/transfers/bonds/shifts +
> location edit/archive; §3 backend gaps (company/location lifecycle, tax admin, membership/staff
> admin, audit viewer, count reads/cancel, bond release read-backs, number-block admin — all
> tenant-scoped, permission-gated, audited, integration-tested); §4 onboarding success→import
> hand-off; the `/staff` RBAC page, `/audit-log`, and the `/settings` area (tax/numbering/
> companies); nav Administration group. The number-lease HIGH fix (§9) landed as `c8b4487` and the
> reverted work was re-landed on this branch (`5bfb9e2`). **Still open:** §6/§4-phase module ports
> (offline sync, procurement/financials foundations, storefront commerce from the module branches),
> §7 orphaned `features/*` deletion, and MEDIUM nav role-filtering. Gates at time of update:
> api 70/70 + db 99/99 on disposable PG18 as `retailos_app`, repo check-types 7/7, ultracite clean.

> Commissioned because a real customer is going live soon and will hand over a QuickBooks item-list
> export to import. Produced by 8 parallel read-only audit passes (frontend CRUD/mock-data,
> backend CRUD matrix, onboarding/wizards/import, mock-data+dead-UI sweep, roadmap-vs-reality,
> unmerged-worktree survey, security/RBAC/money-math) plus direct verification of prod operational
> state. **This is a build list for Codex, not prose for a human** — every item below names the exact
> file, procedure, or route that needs to change.

## 0. Read this first — the codebase moved during this audit

Mid-audit, a concurrent session (Codex) pruned the AdminCN template's mock-data pages out of
`apps/web/src/configs/nav-config.ts` and the live route set (see git log `991c56f`, `7946905`,
`f75bf96`, `378c9a8`, `2923cb0`). **The "lots of mock data" impression from before that prune is now
mostly stale.** Verified after the prune:

- **Every route file still reachable from `nav-config.ts` is genuinely clean** — real oRPC queries,
  real mutations, no fake business data. Confirmed by two independent full-file audits of all 15
  catalog/inventory/warehouse routes plus the frontend CRUD audit covering all 25 live routes.
- **The actual problem is not mock data — it's missing Create/Edit/Delete UI on top of fully-built,
  already-working backends.** Read Section 2 first; it's the highest-leverage finding in this report.
- **~27 of the ~35 `apps/web/src/features/*` directories are now fully orphaned** (dead AdminCN
  template code — chat, mail, contacts, campaigns, payments, productivity, sales-overview,
  data-tables, users, roles, permissions, settings, calendar, kanban, orders, logistics, finance,
  analytics, commerce-dashboard, form-wizard, form-layouts, form-validation, faq, pricing,
  empty-states, onboarding, profile). Zero backend wiring, zero live importers (only
  `features/misc-pages/` — the error-page views — is still imported). See Section 7.

---

## 1. HIGHEST PRIORITY — QuickBooks / Excel product-catalog import

The client will hand over a QuickBooks-exported item list. Today **nothing can import it.**

**What exists:** `catalogRouter.importPreview` (`packages/api/src/routers/vs1.ts:989-1067`) —
a real, tenant-scoped, permission-gated (`products.create`) procedure that validates up to 1000 rows
(`rowNumber, productSku, productName, priceMinor, currency, scale, skuCode?, baseUomCode?,
costingMethod?, trackingMode, lotNumber?, expiryDate?, unitCostMinor?`), checks for duplicate/missing
SKU, barcode, and UoM references, and returns per-row `status: "valid"|"error"`. **It never inserts
anything — there is no commit mutation, and no frontend page calls it at all** (zero references to
`importPreview` anywhere in `apps/web/src`).

**Build list:**

1. **Backend — `catalogRouter.importCommit`** (new). Re-validate the same row shape inside a
   `withTenant` transaction; for each valid row: insert `product` (+ `sku` if `skuCode` present, +
   UoM link if `baseUomCode` present), stamp `costing_method_applied` via the existing set-once
   resolver rules, write an `inventory.receive` ledger entry when `unitCostMinor`/opening qty is
   supplied, `services.recordAudit` per batch. Must be idempotent and rollback-safe on partial failure
   (charter §28: "preview, validation, errors, duplicate detection, rollback, audit logging").
2. **Backend — background job path** for imports over ~1000 rows (charter §28 requires background
   jobs for large imports; today's synchronous 1000-row cap is fine for one QuickBooks CSV but not a
   general solution).
3. **Frontend — a real import wizard** (net-new route, e.g. `/products/import`). No existing screen
   does any of this. Reuse the CSV-parsing pattern already sitting unused in the orphaned
   `apps/web/src/features/users/import-users-dialog.tsx` (`Papa.parse`, already-installed
   `papaparse`/`xlsx` libs in `apps/web/package.json`) as a structural template:
   - File picker (CSV/XLSX)
   - **Column-mapping step** — QuickBooks exports use `Item Name`, `Sales Price`, `Purchase Cost`,
     `SKU`, `Type`, `Quantity On Hand`, none of which match RetailOS's field names 1:1
   - Preview/validation table calling `catalog.importPreview`, rendering per-row status/errors
   - Submit step calling the new `importCommit`
4. **Category/brand/UoM resolution during import**: `ProductDialog` (in `products.index.tsx`) has
   **no category/brand/UoM fields at all** today. Decide: auto-create-by-name-if-missing, or a mapping
   step against existing `categories.tsx`/`brands.tsx`/`units.tsx` records. Not decided anywhere yet.
5. **Currency/scale default**: `importPreview` requires `currency`+`scale` per row; QuickBooks exports
   won't carry these. Needs a tenant-level default currency (not currently modeled as a first-class
   setting — `products.index.tsx`'s `ProductDialog` just hardcodes `GYD` as a form default today).
6. **Opening stock should ride along in the same wizard** — see Section 2's `inventory.receive` gap;
   a QuickBooks item export commonly includes on-hand quantity, and `importPreview`'s row shape
   already anticipates `unitCostMinor`.

**Customer import is a strictly bigger gap** — there is no `customer` table in the schema at all
(CRM/Phase 7 not started). Don't scope this into the QuickBooks-item-list push; it needs schema work
first.

---

## 2. CRITICAL — Backends that work but have zero Create/Edit UI

This is the biggest, most fixable bucket. Every row below has a **fully implemented, tested backend
mutation** with **zero frontend caller anywhere in `apps/web/src`** (verified by repo-wide grep, not
assumption). The pattern to copy for all of these: `apps/web/src/routes/_app/products.index.tsx`
(create/edit/archive dialog wired to `product.create/update/archive`) and
`apps/web/src/routes/_app/categories.tsx` (same pattern) are the two best-built reference
implementations in the codebase — clone their dialog/form/mutation/toast/refetch structure.

| Page | Missing action | Backend procedure (already built, tested) | File to edit |
|---|---|---|---|
| `/skus` | Create/Edit/Archive SKU | `catalog.skuCreate/skuUpdate/skuArchive` | `apps/web/src/routes/_app/skus.tsx` (currently read-only) |
| `/variants` | Create/Edit/Archive | `catalog.variantCreate/variantUpdate/variantArchive` | `apps/web/src/routes/_app/variants.tsx` |
| `/barcodes` | Create/Edit/Archive | `catalog.barcodeCreate/barcodeUpdate/barcodeArchive` | `apps/web/src/routes/_app/barcodes.tsx` |
| `/uom-conversions` | Create/Edit/Archive | `catalog.uomConversionCreate/uomConversionUpdate/uomConversionArchive` | `apps/web/src/routes/_app/uom-conversions.tsx` |
| `/inventory` | Receive stock / adjust stock | `inventory.receive`, `inventory.adjust` | `apps/web/src/routes/_app/inventory.tsx` (currently read-only — **this is the entire Phase-2 write path, unreachable today**) |
| `/inventory` (or new `/stock-count`) | Start / update / post a stock count | `inventory.countStart`, `.countLineUpsert`, `.countPost` | net-new or added to `inventory.tsx` |
| `/lots` | Create/Edit/Archive lot | `inventory.lotCreate/lotUpdate/lotArchive` | `apps/web/src/routes/_app/lots.tsx` |
| `/transfers` | Create / Ship / Receive / Cancel transfer | `transfer.create/ship/receive/cancel` | `apps/web/src/routes/_app/transfers.tsx` (currently list+detail only — **the headline Phase-3 two-step transfer workflow is 100% unreachable**) |
| `/bonds` | Receive / Release bonded stock | `bond.receive`, `bond.release` | `apps/web/src/routes/_app/bonds.tsx` (currently list+detail only — **the headline Phase-3 bond-release+duty workflow is 100% unreachable**) |
| `/locations` | Edit / Archive location | **backend gap too** — no `location.update`/`location.archive` procedure exists at all (see §3) | `apps/web/src/routes/_app/locations.tsx` |
| `/sales` | **Refund a sale** | `pos.refund` (fully built) | `apps/web/src/routes/_app/sales.tsx:509-513` — the "Refund" button already renders an `Available`/`Unavailable` badge sourced from `detail.availableActions.canRefund`, **but has no `onClick`, no dialog, and never calls `pos.refund`.** This is the single most misleading UI in the app: it tells the operator a refund is possible, then gives them no way to do it. Copy the adjacent "Void sale" pattern in the same file (confirmation dialog → `pos.void` mutation → idempotency key → refetch) — the wiring pattern already exists three lines away. |
| `/shifts` | Open shift / cash movement (pay-in/pay-out) / Close shift with blind count | `pos.openShift`, `pos.cashMovement`, `pos.closeShift` | `apps/web/src/routes/_app/shifts.tsx` (currently 100% read-only — X/Z reports view fine, but the entire cash-drawer lifecycle has no UI) |
| `/categories` | Parent-category picker | N/A — `catalog.categoryUpdate` already accepts `parentCategoryId`; the table even displays `parentNames`, the dialog just has no picker field | `apps/web/src/routes/_app/categories.tsx` |
| POS (`/pos`) | Customer / sales-rep picker | N/A — charter §19 commission engine requires a sales-rep selector at checkout; `sale.salesRepId`/`sale.customerId` fields exist but nothing in `pos.tsx` ever sends them | `apps/web/src/routes/_app/pos.tsx` + `components/pos/*` (needs a customer entity to exist first for the customer half — see §3) |

**First-run bug in `/locations`**: `LocationDialog`'s `companyId` is silently derived from
`rows.at(0)?.companyId` (`locations.tsx` ~L319); the "New location" button is `disabled={!companyId}`.
**A brand-new tenant with zero existing locations cannot create their first one from this screen** —
there's no company picker anywhere in the UI (see §3, `company.list` doesn't even exist yet).

---

## 3. Backend gaps — procedures that don't exist at all

These need new router procedures, not just frontend wiring.

- **Staff/team invite — the single biggest reason the app "feels read-only" beyond inventory.**
  `schema.membership` is inserted exactly once, implicitly, inside `onboarding.complete` (the founding
  user becomes `tenant_admin`). **There is no `membership.list`, no invite-user flow, no
  `membership.updateRole`, no way to add a cashier/manager/warehouse/bond_officer user, and no way to
  deactivate one — anywhere in the API.** Better Auth's own org/admin plugin REST endpoints exist
  underneath (`auth.api.setActiveOrganization` is called directly), but nothing exposes invite/role
  management as an oRPC procedure the frontend can call. **Build:** a `membershipRouter` (or extend
  `tenantRouter`) with `membership.list`, `membership.invite` (email invite via Better Auth's
  organization-invitation flow), `membership.updateRole`, `membership.deactivate`. Then a real
  `/users` (or `/staff`) route — note the orphaned `apps/web/src/features/users/` template dir has a
  CSV-import-dialog pattern worth reusing for bulk staff onboarding once this API exists.
- **Tax rate — fully-built service, zero API wiring.** `packages/db/src/schema/tax.ts` and
  `packages/db/src/services/tax.ts` (with `tax.test.ts`) support the complete model
  (code/name/kind/rateBps/isActive/effectiveFrom/effectiveTo). It is inserted exactly once, implicitly,
  during `onboarding.complete` as a single default rate. **There is no `tax.list`, `tax.create`,
  `tax.update`, or `tax.archive` procedure anywhere** — a tenant can never add a second tax rate,
  change a rate, add an effective-dated rate change, or deactivate one. POS resolves tax via
  `services.resolveActiveSalesTaxRate(tx)`, implicitly assuming exactly one active rate always exists.
  **Build:** a `taxRouter` exposing full CRUD over the already-built service, plus a `/settings/tax`
  (or similar) admin page.
- **Company — create-only.** `companyRouter.create` exists (`vs1.ts:262-290`) but has **zero frontend
  callers**; there is no `company.list`, `company.update`, or `company.archive` at all. A tenant with
  more than one company (charter's multi-company feature) can never see/manage a second company
  through the product.
- **Location — no update/archive.** `location.create`/`location.list` exist and are wired; `.update`
  and `.archive` don't exist at the API level at all. Can't rename a store, change `isSellable`/
  `isBonded` flags, or archive a closed location.
- **Bond release — create-only, no read-back.** `bond.release` exists but there's no
  `bond.releaseList`/`bond.releaseDetail` — once created, a release can never be queried again (only
  the originating receipt is listable).
- **Stock count — no list/detail/cancel.** `countStart`/`countLineUpsert`/`countPost` exist; there's
  no way to see past or in-progress counts, and no way to cancel one once started.
- **Audit log — write-only.** `services.recordAudit` fires on every mutation (confirmed working per
  `lessons-learned.md` patterns), but **there is no `audit.list`/`audit.view` read procedure anywhere**
  — despite `audit.view` being a named permission in the charter's own example list (§7). No one, not
  even a platform admin, can inspect the audit trail through any UI today.
- **Number block admin API** — `schema.numberBlock` is never referenced in any router; blocks are only
  ever created via seed scripts. A tenant admin can't provision a new numbering series/fiscal-year
  block through the app (the `number_lease` layer built on top of it is well-covered by API, just not
  the underlying block provisioning).
- **Bundle/kit and BOM (assembly)** — `bundle`, `bom`, `bom_line` tables exist in schema with **zero
  router/service references anywhere.** Confirmed dead schema, not wired to anything. Low priority
  unless a customer needs kits/assemblies.
- **Serial tracking** — `serial` table and `SERIAL_STATUSES` enum exist, `trackingMode` includes
  `"serial"`, but **there is no serial-capture entity API anywhere.** Serial tracking is selectable in
  product setup but completely unusable end-to-end. Flag if any pilot customer sells serialized goods
  (electronics).

---

## 4. Onboarding & wizard status (charter §5 requirement vs. reality)

| Wizard | Status | Notes |
|---|---|---|
| Tenant setup | **BUILT** (single combined form, not multi-step) | `apps/web/src/routes/onboarding.tsx` → `onboardingRouter.complete` (`vs1.ts:146-260`). Creates org+company+first store+one tax rate. Idempotent. |
| Company setup (2nd+ company) | **STUB** — backend exists, zero UI | `companyRouter.create` never called from frontend |
| Store/location setup | **BUILT** | `locations.tsx` → `location.create`, reused for all location `type`s |
| Warehouse setup | **BUILT** (reuses location dialog) | No warehouse-specific config (zones/bins) exposed |
| Bonded warehouse setup | **PARTIAL** | Bonded location creation works via the same dialog; no bond-specific config UI |
| Product setup/import | **STUB (single-item only)** | Bulk import has no commit path — see §1 |
| Opening stock | **NOT BUILT (UI)** | `inventory.receive` has zero frontend callers |
| Chart of accounts | **NOT BUILT** | Phase 5, no schema exists yet |
| Tax setup | **STUB (one-shot only)** | See §3 |
| POS terminal setup | **NOT BUILT** | No device-authorization/terminal-pairing schema or UI |
| Hardware pairing | **NOT BUILT** | Phase 9, not started |
| Custom domain / SMTP setup | **NOT BUILT** | Phase 11, not started |
| Ecommerce storefront setup | **STUB (landing page only)** | `commerce.tsx` is an honest "Planned" status page |
| Receipt/invoice template setup | **NOT BUILT** | Fixed receipt rendering only |
| Staff/user onboarding | **NOT BUILT** — only orphaned template code | See §3 membership gap. `features/users/` is dead template, not a real feature |
| Supplier onboarding | **NOT BUILT** | No supplier schema exists anywhere (confirmed — see §6 re: `retailos-integration` branch, which HAS this built) |
| Customer import | **NOT BUILT (no schema)** | No `customer` table exists at all; `sale.customerId` is an unreferenced bare uuid seam |
| Stock count | **NOT BUILT (UI)** | Backend exists, zero frontend |
| Accounting opening balances | **NOT BUILT** | Depends on nonexistent COA module |
| Fiscal numbering setup | **PARTIAL** | Allocator fully built and automatic; no setup UI to configure series/format |
| Edge Hub / data residency / backup / integration setup | **NOT BUILT** | Later phases, not started |

**Dead template traps** (don't mistake these for real features — they look complete but call nothing):
`apps/web/src/features/form-wizard/` (a 4-step "New Store Setup" wizard, local `useState` only, zero
`orpc` calls, not routed), `apps/web/src/features/onboarding/onboarding-feed.tsx` (fake "Getting
started" checklist, not routed), `apps/web/src/features/users/` (CSV-import-shaped but fully mock,
not routed). Their UI shells (step layout, CSV-parsing pattern, dialog components) are reasonable to
repurpose once real backends exist — don't reuse their fake state logic as evidence anything works.

---

## 5. Roadmap-doc accuracy correction

`docs/architecture/phase-roadmap.md` marks Phases 0-4 done/frozen/merged/in-build. Across the ~20
capabilities audited in Phases 1-4: **10 are FULLY LIVE, 8 are BACKEND-ONLY (no frontend), 2 are
MISSING entirely** — roughly **50% is actually usable by a real customer through the UI today.**
`PROGRESS.md`'s own page-pass entries are honest at the operational level (e.g. explicitly noting
"read endpoint, no mutation change" for several pages) — the overclaim is at the `phase-roadmap.md`
framing layer, where "FULLY COMPLETE/FROZEN" and "MERGED" describe backend/architecture completeness
but read (to anyone trusting the table) as "the module is usable." Recommend: add an explicit
"Frontend coverage" column or caveat to `phase-roadmap.md` distinguishing backend-complete from
UI-complete, so this doesn't recur for Phase 5+.

Biggest specific doc-vs-reality gaps, ranked by business impact:
1. Refund UI lies by omission (§2) — tells the operator it's possible, gives no way to do it.
2. The entire Phase-2 inventory write path (receive/adjust/count) has no UI, despite "FULLY COMPLETE".
3. Phase 3's two headline features (transfers, bond release) are 100% read-only in the UI.
4. SKU/variant/barcode/UoM-conversion creation has no UI anywhere, despite full CRUD backends.
5. Shift open/cash-movement/close has no UI — correctly flagged as pending in the roadmap already, so
   not a doc-accuracy problem, just a reminder POS today runs shift-less.
6. No audit-log viewer exists despite Phase 1 RBAC/audit being marked "Done".

---

## 6. Don't rebuild what already exists unmerged — check `retailos-integration` first

Before assigning Codex to build Procurement or Accounting from scratch, review the branch
`feature/full-module-buildout` at `/home/karetech/projects/retailos-worktrees/retailos-integration`
(22 commits ahead of master, ~81,500 lines, `check-types` passes clean). It already contains:

- **Procurement (Phase 6)**: `supplier`, `purchase_order(+line)`, `goods_receipt(+line)`,
  `supplier_bill(+line)`, `vendor_payment`, `landed_cost_pool/allocation`, `import_batch(+line)`
  schema + services + a `procurementRouter` in `vs1.ts` (permission-gated `procurement.manage`).
- **Accounting (Phase 5, minimal skeleton)**: `ledger_account`, `posting_period`, `journal(+line)`
  schema + services (createLedgerAccount, createDraftJournal, postJournal, closePostingPeriod) + an
  `accountingRouter`. This is a bare manual-journal/COA slice, **not** the full AR/AP/tax/
  multi-currency design already approved in `phase-5-implementation-plan.md` — treat as a starting
  point, not a finished Phase 5.
- **POS offline sync** (Phase 4 extension): `offline_terminal`, `offline_sync_batch`,
  `offline_sync_mutation` schema, `pos.ingestOfflineBatch` wired. Note: `registerOfflineTerminal`
  service exists but is **not wired to any router** — an orphaned write path (the recurring
  "component built, no caller" class from this project's `lessons-learned.md`).
- **Storefront commerce** (Phase 8 slice): public `catalog`/`product`/`quote` procedures on
  `commerceRouter` — read-only, checkout/cart/payment/tax explicitly stubbed `status: "blocked"` in
  code. (A separate, smaller branch `retailos-commerce`/`feature/storefront-commerce`, 1 commit, adds
  the same 3 procedures cleanly and is a pure additive superset of master's current gateway-only
  `commerce.ts` — low-risk to merge on its own.)
- **Self-serve trial onboarding wizard** (`onboarding.tsx` route, separate from what's on master).

**Risk if merging:** 1 uncommitted file (`apps/web/src/routes/_app/uom-conversions.tsx`), and this
branch's `vs1.ts` diverges heavily (+667 lines) from a POS baseline that has since moved further on
master (Commit 3 returns/refunds/voids). Reconciling `vs1.ts`/schema/migration numbering will take
real care — don't blind-merge. Recommend a dedicated review/reconciliation pass before either merging
this branch or starting fresh Procurement/Accounting work, whichever the owner decides.

The five other leftover `.claude/worktrees/agent-*` branches (contacts/mail/chat port,
sales-overview/payments/productivity/campaigns port, data-tables/error-pages port) are all confirmed
pure mock-data AdminCN template ports already superseded by what's on master — safe to delete without
further review.

---

## 7. Cleanup — delete the orphaned `features/` tree

`apps/web/src/features/*` minus `misc-pages/` (~27 directories, ~250 files: analytics, calendar,
campaigns, chat, commerce-dashboard, contacts, data-tables, empty-states, faq, finance, form-layouts,
form-validation, form-wizard, kanban, logistics, mail, onboarding, orders, payments, permissions,
pricing, productivity, profile, roles, sales-overview, settings, users) has **zero backend wiring and
zero live importers** — confirmed by both grep-based sweeps. `features/chat/store.ts:16-18` even
self-documents: *"Sample-only store. When chat is wired to the backend, replace the local `db` import
with an oRPC query… instead of the fake-db."* Recommend deleting the whole block in one PR (or moving
to a `_template-reference/` dir outside the build if any layout is worth mining later) — it's dead
weight that confuses anyone reading the codebase into thinking these are real features.

---

## 8. How to build this — sourcing instruction for Codex

Per `docs/architecture/frontend-strategy.md` (the governing UI law): **every new Create/Edit
dialog/form should be assembled from shadcn Studio blocks / AdminCN patterns already installed in this
repo, not hand-rolled.** Concretely:

- The dialog+form+mutation+toast+refetch pattern in `products.index.tsx` / `categories.tsx` /
  `brands.tsx` / `units.tsx` is the **proven, working template** — copy its shape for every "Missing
  action" row in §2 rather than inventing a new pattern per page.
- Before writing any new form component from scratch, check the shadcn Studio MCP
  (`get-block-meta-content`) for an existing block in the already-configured registries
  (`@shadcn-studio`/`@ss-blocks`/`@ss-components`) — re-theme to RetailOS tokens per the Assembly Law,
  never ship a block with foreign hardcoded colors/radii/fonts.
- Multi-step flows (the import wizard in §1, opening-stock-in-import) should reuse the Multi-step Form
  studio block pattern already curated in `docs/architecture/ui-source-registry.md`.
- Every new mutation needs: tenant scoping (`withTenant`), permission check (`assertPermission`),
  cross-tenant FK validation on any client-supplied id (per this repo's own recurring "FK-bypass"
  lesson class in `lessons-learned.md`), and `services.recordAudit`. Follow the exact pattern already
  used in `transfer.ship`/`bond.release` for anything touching money/stock value.

---

## 9. Security / RBAC / money-math audit

**HIGH — `pos.numberLeaseAllocate` cross-tenant FK-bypass landmine (the codebase's known "H1" class).**
`packages/api/src/routers/vs1.ts:5829` (gated `pos.create_sale` — any cashier has this permission)
calls `services.allocateNumberLease` → `getOrCreateNumberBlock`
(`packages/db/src/services/number-lease.ts:134-183`), which inserts into `number_block` using the
client-supplied `companyId`/`locationId` with **no `assertCompanyVisible`/`assertLocationVisible`
check** — contrast `numberLeaseList` (`vs1.ts:5507-5512`), which correctly guards both. Root cause:
`number_block.companyId`/`locationId` (`packages/db/src/schema/numbering.ts:35-38`) are **plain
single-column FKs**, not the composite `(tenant_id, id)` FK pattern used by every sibling table
post-Phase-3 (contrast `number_lease`/`number_lease_usage` in the same file, which correctly use
composite tenant-scoped FKs). Postgres FK checks run as table owner and bypass RLS, so this insert
would succeed for a `companyId` belonging to ANOTHER tenant.
**Not currently exploitable for persistent corruption**: the same transaction always follows with an
insert into `number_lease`, which DOES have the composite tenant-scoped FK and rejects a cross-tenant
`companyId` — the whole `withTenant` transaction rolls back. But it's a landmine (any future code path
reusing `getOrCreateNumberBlock` without that same immediately-following guard would persist a
cross-tenant row) and today surfaces as an ugly unhandled Postgres FK-violation instead of a clean
rejection (a minor enumeration side-channel: which of the two inserts fails reveals whether a given
company UUID exists in *any* tenant). **Fix:** add `assertCompanyVisible`/`assertLocationVisible` in
`numberLeaseAllocate` before calling the service (cheapest fix, matches `numberLeaseList`'s existing
pattern), or give `number_block` the same composite-FK treatment as `number_lease`.

**MEDIUM — zero role-based nav filtering on the frontend.** `apps/web/src/configs/nav-config.ts` is a
static array with no permission/role metadata; `apps/web/src/components/app-sidebar.tsx:118` renders
`navGroups.map(...)` unfiltered — every logged-in tenant member sees every nav item (Financials,
Reports, Commerce, etc.) regardless of role. `apps/web/src/features/roles/*` is an orphaned
Zustand-mock AdminCN template, not wired to real RBAC or to nav-config. **Not a data leak** — every
backend procedure checked enforces `assertPermission` correctly, so an under-privileged user clicking
into a module gets a clean FORBIDDEN/empty result server-side — but it violates charter §7 ("cashiers
must only access POS-related features unless explicitly granted more") at the UX layer and reveals
module/structure existence to under-privileged staff. **Fix:** add a `requiredPermission` field to
`NavMenuItem`/`NavGroup` in `nav-config.ts` and filter in `app-sidebar.tsx` against the caller's
resolved permission set.

**Shopix/commerce public storefront — CLEAN, no issues.** `packages/api/src/storefront.ts:49-89`
resolves tenant strictly via `organization.storefrontDomain` (exact match, unique column) or a
validated single-label `{slug}.{STOREFRONT_BASE_DOMAIN}` subdomain pattern against `organization.slug`
(also unique) — no `a.b.shop.retailos.com` ambiguity. Fail-closed: unknown host → NOT_FOUND, never a
default tenant. Explicitly nulls `session`/`auth` in the downstream context so a stray staff cookie on
a storefront request can't leak staff identity — a structural (type-level) guarantee, not just a
runtime check. The one live endpoint, `commerce.storefront`, returns strictly `{name: string | null}`
— no ids, config, cost, or margin. Full catalog/PDP/checkout endpoints are explicitly not-yet-built
(own code comments), so there's no larger public field-leakage surface to audit yet.

**Client-side money math — no violations found.** Every audited page (`pos.tsx`, `sales.tsx`,
`shifts.tsx`, all catalog/inventory pages) renders backend-computed money fields through `formatMoney`
only; no page recomputes a total/tax/margin/commission client-side.

**Procedure-level scope of this pass**: fully checked — `product.imageCreate/imageSetPrimary/imageDelete`,
`reports.*`, `inventory.stockByLocation/stockLedgerList`, `pos.numberLease*`, `pos.itemSearch/locationList/quote/receipt`,
`tenant.setActive`, `company.create`, `commerce.storefront`. **Not re-checked this pass** (lower risk,
already Codex-reviewed in prior PRs per `lessons-learned.md`, no recent diffs): `pos.createSale/refund/void/exchange`
full bodies, `bond.*`, `transfer.*`, `catalog.*` CRUD routers. All were tenant-scoped + permission-checked +
audit-logged where checked, with the one HIGH exception above.

### ⚠️ Live repo state changed mid-audit — verify before acting on §1/§3/§4 of this report

While this audit ran, a concurrent session pushed **6 revert commits to master** (all at
`2026-07-01T19:40:43Z`, HEAD now `e8d5981`), fully reverting: `feat: add RetailOS onboarding flow`,
`fix: make onboarding validation clearer`, `fix: allow RetailOS client domain auth origins`,
`feat(web): add RetailOS catalog CRUD actions`, `chore(web): normalize generated route tree`, and
`fix(db): standardize tax rate tenant policy`. **Confirmed by direct filesystem check just now:**
`packages/db/src/schema/tax.ts`, `packages/db/src/services/tax.ts`, and
`apps/web/src/routes/onboarding.tsx` **no longer exist on disk.** This means:

- Section 1 (QuickBooks import) and Section 3's tax-rate-gap description above were written against a
  state that briefly existed and has since been reverted — the *gap* they describe (no tax CRUD API)
  is arguably now even bigger, since the schema+service are gone too, not just the router wiring.
- Section 4's "Tenant setup: BUILT" and "Tax setup: STUB (one-shot only)" rows are **stale** — as of
  current HEAD, `onboardingRouter`/`onboarding.tsx` do not exist, so there is currently **no working
  self-serve tenant onboarding flow at all** on master.
- **Production risk**: the currently-running `retailos-web`/`retailos-server` containers started at
  `19:33:18Z` — *before* the final tax-policy fix (`19:34:52Z`) and *before* all 6 reverts
  (`19:40:43Z`). Prod is therefore serving a build that likely **still has** onboarding/tax/catalog-CRUD
  baked in. **If master is deployed again in its current (post-revert) state without re-adding this
  work, that deploy will regress working functionality currently live in production.** This needs a
  decision from the owner before the next deploy — was the revert intentional (a bug was caught) or
  should this be re-landed first? Do not redeploy master blind.

---

## Suggested build order (for Codex, smallest-safe-slices first)

0. **Owner decision first, before anything else in this list**: resolve the 6-commit revert on
   master (§9) — decide whether the onboarding/tax/catalog-CRUD work gets re-landed (with the HIGH
   number-lease fix folded in) or was correctly rolled back for a real bug, and confirm prod's
   currently-running build (which predates the revert) isn't silently regressed by the next deploy.
1. **Fix the number-lease cross-tenant FK gap** (§9, HIGH) — small, well-scoped, closes a real class
   of defect this codebase has hit before.
2. **Fix the Refund dead-UI** (§2, `sales.tsx`) — smallest change, biggest visible fix, backend already exists.
2. **QuickBooks import commit mutation + wizard** (§1) — matches the stated near-term customer need.
3. **Inventory receive/adjust/count UI** (§2) — unblocks the entire Phase-2 write path for a live tenant.
4. **Transfer create/ship/receive/cancel UI** and **Bond receive/release UI** (§2) — Phase-3 headline features.
5. **SKU/variant/barcode/UoM-conversion Create/Edit dialogs** (§2) — needed before catalog import even matters for a growing catalog.
6. **Staff/membership invite router + UI** (§3) — unblocks onboarding a real team, not just the founder.
7. **Tax rate CRUD router + settings UI** (§3) — a tenant needs more than one tax rate almost immediately.
8. **Location update/archive, company list/update/archive** (§3) — fixes the first-run "can't create first location" bug too.
9. **Shift open/cash-movement/close UI** (§2) — completes POS day-to-day operations.
10. **Delete orphaned `features/` tree** (§7) — housekeeping, do whenever convenient, zero risk.
11. **Review `retailos-integration` for merge** (§6) — before starting fresh Procurement/Accounting work from a blank slate.
