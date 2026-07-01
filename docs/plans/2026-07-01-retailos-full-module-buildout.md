# RetailOS Full Module Buildout Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Do not expose template/demo UI as production until backed by real RetailOS APIs.

**Goal:** Make RetailOS intuitive and complete across POS, financials/accounting, procurement/POs, storefront/commerce, and reporting, with every exposed page discoverable through navigation and backed by explicit endpoint contracts.

**Architecture:** Ship in vertical slices. Each slice starts with schema/API contracts, RLS and tests, then UI composed from owned AdminCN/Studio/shadcn patterns. Navigation must expose only honest product surfaces: built workflows are actionable; incomplete modules get clear landing pages and build status until their backend is real.

**Tech Stack:** TanStack Start, React, oRPC, Hono, Drizzle, PostgreSQL RLS, shadcn/AdminCN/Studio-owned components, Bun/Turborepo.

---

## Current Verified Baseline

### Built / exposed

- POS sale flow: `/pos`
- Sales lookup, receipt, void workflow: `/sales`
- Shifts: `/shifts`
- Catalog: `/products`, `/variants`, `/skus`, `/barcodes`, `/categories`, `/brands`, `/units`, `/uom-conversions`
- Inventory/warehouse: `/inventory`, `/lots`, `/stock-ledger`, `/transfers`, `/bonds`, `/locations`
- Number lease report: `/reports/number-leases`
- Storefront gateway proof: `commerce.storefront`

### Missing or incomplete

- Financials/accounting: no COA, journals, posting periods, AR/AP, bank reconciliation, VAT/GRA reports, P&L, balance sheet, trial balance.
- Procurement/POs: no suppliers, POs, GRNs, supplier bills, landed costs, three-way match, vendor payments.
- Storefront/commerce: no public catalog, PDP, cart, checkout, online orders, public payments, customer identity, fulfilment.
- POS/offline: no general offline sync ingestion, no Tauri SQLite queue, no integrated payment provider lifecycle, no fiscal writer, no commission/stored-value ledger.
- Reports IA: no `/reports` landing page; Financials route exists but is not discoverable and intentionally unavailable.

---

## Phase A — Navigation & Discoverability Foundation

**Objective:** Clients should never need hidden slash paths. Every major module appears in sidebar and command palette, with clear status and next action.

**Files:**
- Create: `apps/web/src/components/module-status-page.tsx`
- Create: `apps/web/src/routes/_app/reports.tsx`
- Create: `apps/web/src/routes/_app/financials.tsx`
- Create: `apps/web/src/routes/_app/procurement.tsx`
- Create: `apps/web/src/routes/_app/commerce.tsx`
- Modify: `apps/web/src/configs/nav-config.ts`

**Acceptance criteria:**
- Navigation includes Sales, Catalog, Inventory & Warehouse, Procurement, Commerce, Financials, Reports.
- `/reports` summarizes available reports and planned financial reports.
- `/financials`, `/procurement`, `/commerce` are honest module landing pages with status, available links, and build plan cards.
- Do not promote demo template feature folders directly.
- Typecheck and web build pass.

---

## Phase B — POS Completion & Offline Readiness

**Objective:** Turn the current POS into a deployable terminal workflow with offline-safe contracts.

**Tasks:**
1. Bind number leases into `pos.createSale` so document numbers are globally disjoint across terminals.
2. Add offline sync ingestion tables: batch, mutation, terminal/device identity, monotonic counter uniqueness, payload hash, replay/upcast status.
3. Add Tauri/SQLite client queue contract and tests.
4. Add payment lifecycle model for provider/webhook settlement where relevant.
5. Add stored-value/gift-card ledger if required before exchange settlement.
6. Add fiscal writer interface using existing `fiscal_document` seam.
7. Add commission tables/services if sales-rep payout is in first-client scope.
8. Build POS operations landing/dashboard that links sell, sales, shifts, number leases, offline status.

**Gates:**
- Real-Postgres RLS coverage for new tenant tables.
- Replay/idempotency tests for offline mutation ingestion.
- Double-sale and double-number concurrency tests.
- No frontend money math beyond formatting/parsing.

---

## Phase C — Storefront / Shopix Commerce

**Objective:** Build customer-facing commerce without weakening staff/RBAC boundaries.

**Tasks:**
1. Public catalog read model: allow-listed product/category DTOs, no cost/margin/internal IDs.
2. Public PDP by slug/handle with product images.
3. Coarse availability read model with anti-scrape/rate limits.
4. Cart model and quote endpoint using real tax/pricing logic.
5. Checkout intent and reservation seam: stock commits only in payment-confirmation transaction.
6. Online order schema and fulfilment states: pickup/delivery.
7. Guest/customer identity and PII vault.
8. Payment seam/mock provider first, real provider later.
9. Storefront UI composed from CommerceO/AdminCN/Studio-owned blocks and RetailOS tokens.

**Gates:**
- Public endpoint leak tests.
- Hostname→tenant tests.
- Checkout idempotency tests.
- Stock reservation/deadlock tests with canonical lock ordering.

---

## Phase D — Procurement / POs

**Objective:** Build supplier purchasing and receiving into the same inventory truth as POS.

**Tasks:**
1. Suppliers and contacts with RLS/composite FKs.
2. Purchase orders and PO lines with approval workflow.
3. GRN/goods receipt against PO using valued receipt primitive.
4. Partial receiving and over-receipt disposition.
5. Supplier bills and three-way match entities.
6. Landed cost pools/allocation with per-pool largest-remainder math.
7. Import batch/customs tracking using Phase-3 bond seams.
8. Reorder suggestion → PO conversion.
9. Procurement UI: suppliers, purchase orders, receiving, bills, landed costs.

**Open decisions to lock before implementation:**
- FIFO landed-cost allocation policy.
- Landed-cost basis per cost pool.
- Multi-currency landed cost model.
- Over-receipt disposition.
- Three-way-match tolerance.

**Gates:**
- Every tenant table has fail-closed RLS in same commit.
- GRN router write-path proves ledger + valuation + event + audit.
- H1 tuple-validation regressions for supplier/PO/GRN/bill graph.

---

## Phase E — Financials / Accounting

**Objective:** Build a real accounting foundation rather than dashboards over imaginary books.

**Tasks:**
1. COA, ledger accounts, posting periods, journal/journal lines.
2. Structural balanced-journal enforcement.
3. Closed-period posting rejection.
4. Functional currency model and FX rates.
5. Accounting event consumer checkpointing and out-of-order parking.
6. Auto-posting projections for sales, payments, inventory, bonds, procurement.
7. AR/AP subledgers and control-account tie-out.
8. Bank/cash reconciliation and POS cash clearing.
9. Reports: trial balance, P&L, balance sheet, cash flow, VAT/GRA Form G0002 model.
10. Financials UI with role-aware navigation and drilldowns.

**Open decisions to lock before implementation:**
- Sync vs async GL posting/read-your-post guarantee.
- Accrual vs cash basis.
- Functional-currency model depth.
- Default Caribbean/GRA COA template.

**Gates:**
- Journal balance structural test.
- Period close immutability test.
- Event replay idempotency test.
- Inventory valuation ↔ GL reconciliation test.

---

## Phase F — Reporting & Operations IA

**Objective:** Make reports discoverable and useful without implying unsupported financial facts.

**Tasks:**
1. `/reports` landing page.
2. Safe operational reports: number leases, stock ledger, low stock, shifts, transfers, bonds.
3. Financial reports only after Phase E.
4. Export surfaces with permission checks.
5. Dashboard cards use backend DTOs only.

---

## Operating Rules

- Work in small vertical slices; update this plan as each slice lands.
- Do not expose template/demo pages unless normalized, re-themed, and wired to RetailOS oRPC.
- Every new tenant-owned table ships with RLS and coverage tests in the same commit.
- Every mutation emits audit/outbox where required.
- Every UI action must reflect backend `availableActions` or equivalent server decision; UI visibility is never security.
- Run `bun run check`, `bun run check-types`, `bun run check:mojibake`, `bun -F web build`, and relevant real-Postgres tests before claiming completion.
