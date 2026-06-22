# Phase 2 — Products & Inventory Ledger — COMPLETE (archive)

> **Status:** ✅ FULLY COMPLETE / 🔒 FROZEN — merged to master `72b2100` (PR #9), CI green (4/4 incl. real-Postgres RLS), 2026-06-22.
> This is the **archived commit-by-commit narrative** moved out of `PROGRESS.md` to keep the live status lean.
> Authoritative specs/contracts live in: `phase-2-implementation-plan.md`, `module-specs/inventory.md` (D1–D7), `event-map-phase2.md`, `phase-2-api-contracts.md`, `adr/0007-inventory-costing-strategy.md`, `adr/0008-settings-resolution-and-currency-seam.md`, `test-matrix.md`. "Frozen" = any further Phase-2 work is a **change request**.

## Merge lineage
- **PR #4 (`d39428d`)** — Phase-2 schema + seams + close-out → master.
- **PR #9 (`72b2100`)** — Phase-2 behavior pass (single resolver, M1 event normalization, reserved fields) → master.

## Locked product-policy decisions (D1–D7) — full text in `module-specs/inventory.md`
1. **D1 costing** — AVCO default; FIFO per tenant/category/product (pharmacy/expiry/lot/regulated); no LIFO; not hardcoded — per-tenant/category/product strategy (both `avg_cost` + `valuation_layer` exist). Item-level costing kept; integrity = **set-once-after-first-movement** (not a category-depth cap; ADR-0008 reconciled toward D1). + Costing Strategy Examples section.
2. **D2 multi-UoM** — canonical base units; integer-ratio conversion factors where possible; purchase/stock/sale/reporting units; conversions tenant/category/product configurable.
3. **D3 serial/batch/lot** — model all three; ship lot/batch+expiry first; serial stubbed but schema must not block it.
4. **D4 expiry/FEFO** — NOT a global hard-block; tenant/category/product configurable; general-retail default warn-and-override (audited `inventory.override_expiry`); pharmacy/regulated hard-block selectable.
5. **D5 oversell** — allow-oversell-with-flagging default (negative ledger + `inventory.stock_discrepancy`); hard-block configurable per tenant/category/product. Ledger policy-neutral. **D5 divergence (as-built):** oversold units recorded zero/unvalued (NOT last-known-cost).
6. **D6 barcode** — data-driven parser config; GS1/EAN/UPC/Code128 + variable-measure/weight-embedded; conservative Phase-2 build (table + config seam; live scale/parser deferred to Phase 4).
7. **D7 reorder** — fixed min/max; suggestions only; no auto-PO; manager approval required.
- **D-money rounding mode** — left OPEN (Phase 5; pending GRA/VAT verification). Not a Phase-2 blocker (AVCO carries exact-integer remainders; FIFO is division-free).

## Commit-by-commit narrative (schema phase — PR #4)
- **Commit 0** — mechanical RLS coverage gate (`tenant-isolation-coverage.test.ts`): enumerates Drizzle tables, requires every tenant-owned table to have ENABLE+FORCE+`tenant_isolation` policy (or explicit exclusion); red→green demonstrated. Docs-only planning artifacts (`event-map-phase2.md`, `inventory-screen-map.md`); no-native-`pgEnum` convention.
- **Commit 1** — catalog schema: `category`, `brand`, `variant`, `sku`, `barcode`, `unit_of_measure`, `uom_conversion` + nullable `product` extensions. Migration `0005`. `uom_conversion` scoped uniqueness uses `UNIQUE NULLS NOT DISTINCT`.
- **Commit 2** — tracking schema: `lot`, `serial` + nullable `stock_ledger.lot_id`/`serial_id`/unit-cost money triplet. Widened `stock_ledger.qty_delta`/`balance_after` int4→int8. Migration `0006`.
- **Commit 3** — costing storage: `avg_cost` (AVCO source-of-truth with `total_value_minor`+`qty_on_hand`), `valuation_layer` (FIFO layers), config columns. Migration `0007` + DB invariant `qty_on_hand <> 0 OR total_value_minor = 0`.
- **Commit 4** — reorder rules, stock counts, bundle/BOM schema + RLS.
- **Commit 5** — raw rich Phase-2 seed foundation (multi-tenant AVCO/FIFO/mixed catalog, UoM, varied lots, serial stub, reorder/count/BOM config).
- **Commit 6** — SKU ledger seam + costing resolver/`applyValuation` (product→category→tenant; AVCO remainder carry/zeroing; FIFO `FOR UPDATE` layer consumption) with DB-gated tests.
- **Commit 7** — valuation-bearing seed movements through the resolver.
- **Commit 8** — UoM exact conversion, FEFO allocation, oversell decision, reorder suggestion services + DB-gated tests.
- **Commit 9** — stock-count posting as valued adjustment movements.
- **Commit 10** — Phase-2 inventory routers/reports with audit/outbox events.
- **Commit 11** — API contract doc.
- **Commit 12** — catalog create routers.
- **Commit 13** — catalog FK-guard regression + Phase-2 backend gap analysis.
- **Commit 14** — product Phase-2 create fields + mixed AVCO/FIFO router e2e.
- **Commit 15** — catalog/product list routes.
- **Commit 16** — catalog CRUD, product update/archive, variant lifecycle, lot lifecycle, reorder-rule CRUD.
- **Commit 17** — discrepancy review, revaluation, import preview. + `phase-2-closeout-audit.md`.

### PR #4 review + hotfix
- **H1** — cross-tenant FK-bypass guards on `countStart`/`countLineUpsert`/`adjust`(location+lot)/`reorderEvaluate` (+ restored `countLineUpsert` audit) via ONE parameterized cross-tenant regression harness. (Postgres FK checks bypass RLS → router-level RLS-scoped existence reads are mandatory.)
- **H2** — wired the D5 `inventory.stock_discrepancy` event into `pos.createSale` on oversell (ledger stays policy-neutral).
- Tickets opened: **#5** (Phase-3 composite-FK `(tenant_id,id)` durable fix), **#6** (Phase-5 valuation BigInt precision).

### Schema-and-seams pass (expand-only, migrations 0010/0011)
- lot/serial-aware `valuation_layer` (lot=FK, serial=bare uuid); value-only `valuation_adjustment` (AVCO applies / FIFO rejects); returns + UoM-role + `qty_scale` seams; `costing_method_applied` write-time stamp (historical integrity); `inventory.cost_reconciliation` event contract; settings-resolver (ADR 0008) + currency seam; oversell/expiry policy columns. Zero new tables.

### Close-out pass (PR #4 final)
- **Gap A** — value-only AVCO adjustment rejects `qty_on_hand <= 0` (preserves qty=0⟺value=0).
- **Gap B** — `costing_method_applied` was NULL on every row (column+passthrough but no writer) → now **WIRED by `applyValuation`** + DB-tested.
- **D1 × ADR-0008** — resolved toward D1: item-level costing kept; integrity = set-once-after-first-movement (`assertCostingMethodSetOnce`), confirmed single-door (only `product.update`/`skuUpdate` write it; both guarded).

## Behavior pass (PR #9)
- **Item 1** — collapsed the duplicate settings/costing resolution: `costing.ts` inline `product→category→tenant ?? "avco"` precedence **deleted**; `resolveCostingMethod` fetches per-level values and delegates to `resolveSetting` (single path, platform default in the resolver). Behavior-preserving (costing/resolver suites passed unchanged). costingMethod routed; removal/oversell/expiry/return deferred (no consumer yet); UoM not routed (row-scope lookup, different shape).
- **Item 2 — `inventory.cost_reconciliation` emit: DECIDED Phase-4-deferred** (gated on POS↔costing #8, owner-ratified 2026-06-22, + rounding #6). Contract locked, not wired.
- **Item 3** — M1 event-contract normalization: `emitEvent` injects server-set `occurredAt` on every payload (applied last → producer can't override; §14). `received`/`adjusted`/`count_posted` aligned to `event-map-phase2.md`; `revalued` + `stock_discrepancy_reviewed` added to the catalog; `lot_expiring`/`lot_expired` DEFERRED + `uom_converted` FOLDED (locked contracts, not in `DomainEventType`); `valuation_updated`/`stock_discrepancy` maps aligned to as-built.
- **Reserved fields** — `inventory.adjusted.approvedBy` and `inventory.valuation_updated.totalValueMinor`/`qtyOnHandBase` reserved as **present-but-null** (not absent), so binding them in Phase 5 is additive; integration test asserts the keys are PRESENT.

## Recognized defect class (carried into every later phase)
**"Correct component, but a write path routes around it"** (Gap B, H1, POS↔costing #8). Standing per-phase gate: for every invariant/guarantee, **grep that the primary write path actually invokes the enforcing component** — a green service suite is not evidence the production path uses the service. See `lessons-learned.md`.

## Parked → later phases
- **#8** POS↔costing wiring + `cost_reconciliation` emit → **Phase 4**.
- **#6** precision/`mulDivRound` + `valuation_updated` totalValue/qtyOnHand enrichment → **Phase 5**.
- **#7** set-once DB-trigger backstop + **#5** composite-FK `(tenant_id,id)` → **Phase 3**.

## Final verification (at merge)
- Gates: `check:mojibake` clean · `check` 157/0 · `check-types` 6/6 · default `test` 7/7.
- DB-gated (bootstrap roles → migrate 0000–0011 as `retailos_migrator` → run as `retailos_app`): **db 45/45 · api 11/11**.
- master `72b2100` CI: 4/4 jobs green (Quality gates, E2E, Docker build, RLS real-Postgres).
