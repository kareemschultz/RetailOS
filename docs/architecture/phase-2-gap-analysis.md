# Phase 2 Backend Gap and Feature Analysis

- **Date:** 2026-06-22
- **Branch:** `phase-2-implementation`
- **Scope:** backend, schema, RLS, seed, services, routers, tests, contracts, and research status for Phase 2 Products & Inventory Ledger.
- **Out of scope:** production UI, POS/Tauri/offline decisions, procurement/landed cost, accounting GL posting, warehouse transfers/bins, Edge Hub consumers.

## Executive status

Phase 2 backend is **substantially implemented but not closed**. The ledger-critical backend paths exist: schema/RLS, rich seed, AVCO/FIFO valuation, UoM/FEFO/oversell/reorder/count services, inventory routers/reports, catalog create routes, API contracts, and DB-gated tests. Remaining work is mostly API breadth, import/revaluation seams, and phase-close audit hardening.

## Research status

Completed enough for Phase 2 implementation:

- Competitive inventory research exists in `competitive/inventory.md`, based on official docs for Cin7, Fishbowl, Zoho Inventory, inFlow, Finale, Odoo, NetSuite, and ERPNext.
- Phase 2 policy decisions D1-D7 are locked in `module-specs/inventory.md` and ADR-0007.
- Event-map and screen-planning docs exist so future phases do not discover missing payload/API fields late.
- Current spot-check on official docs still supports the main parity assumptions: FIFO/FEFO and batch/serial are table-stakes in stronger inventory systems; Odoo/NetSuite/ERPNext support multiple valuation modes/settings; Cin7 documents FIFO/FEFO/batch/serial costing and method-change caveats.

Still open:

- **D-money rounding mode** remains intentionally open until Phase 5 tax/FX verification. Phase 2 is safe because AVCO carries remainders in `total_value_minor`, FIFO is division-free, and discrete non-exact UoM conversion is rejected.
- Full country-specific tax/fiscal research is Phase 5, not Phase 2.
- POS/offline/Tauri research is Phase 4, not Phase 2.
- Procurement/landed-cost research is Phase 6, not Phase 2.

## Implemented backend coverage

| Area | Status | Notes |
|---|---:|---|
| Tenant/RLS coverage gate | Done | Mechanical `tenant-isolation-coverage.test.ts`; blocks tenant-owned tables without ENABLE + FORCE + policy coverage. |
| Catalog schema | Done | Category, brand, variant, SKU, barcode, UoM, UoM conversion, and product extension columns. |
| Tracking schema | Done | Lot, serial stub, stock-ledger lot/serial/unit-cost seams, SKU-aware ledger path. |
| Costing schema | Done | `avg_cost` total-value AVCO projection and FIFO `valuation_layer`; DB zero-qty/zero-value invariant. |
| Count/reorder/BOM schema | Done | Reorder rules, stock counts/lines, bundle/BOM catalog modelling. |
| Rich seed | Done | Multi-tenant AVCO/FIFO/mixed catalog, varied lots, UoM, reorder/count/BOM config, valuation movements through resolver. |
| Costing resolver | Done | product -> category -> tenant, AVCO and FIFO paths, row locks / `FOR UPDATE`, remainder-safe AVCO. |
| Inventory services | Done | UoM conversion, FEFO allocation, oversell decision, reorder evaluation, stock-count posting. |
| Inventory routers/reports | Done | Receive, adjust, count start/line/post, reorder evaluate, valuation report, low-stock report. |
| Catalog create/list routers | Partial | Create + list for category, brand, UoM, SKU, barcode, UoM conversion; product create/list; RLS-scoped FK guards. Update/archive still pending. |
| API contract snapshot | Done | `phase-2-api-contracts.md`. |
| Backend tests | Partial | Service tests are strong; router e2e now covers catalog FK guards and mixed AVCO+FIFO valued receipts through valuation reports. Broader list/update/import/revaluation tests still needed. |

## Remaining backend gaps

### P0 before Phase 2 backend can be called complete

1. **Catalog API breadth.** Add update/archive endpoints for category, brand, product extensions, SKU, barcode, UoM, and UoM conversion. Create + list exist for most catalog entities, but operational back-office workflows need update/archive.
2. **Product update/archive.** `product.create` now accepts Phase-2 category/brand/base UoM/costing/tracking fields with RLS-scoped guards and `product.list` exists, but update/archive are still missing.
3. **Variant router.** Schema and seed exist, but the API lacks variant create/list/update/archive.
4. **Lot/expiry management routes.** `inventory.receive` accepts `lotId`, but there are no lot create/update/quarantine/expiry-status endpoints yet.
5. **Reorder rule CRUD.** Evaluation exists; creating/updating min/max rules through the API is still missing.
6. **Stock discrepancy review route.** Oversell/discrepancy events exist, but manager review/resolve endpoints are not built.
7. **Import seam.** Competitive research marks CSV/Excel import as P0 parity. Add backend-only import staging/validation design or schema before calling Phase 2 feature analysis closed.
8. **Audited revaluation seam.** Method changes are conceptually locked behind explicit revaluation, but no `inventory.revalue` service/router exists yet.

### P1 hardening / quality-of-life backend work

1. **Shared catalog query helpers.** Extract repeated RLS-scoped FK guards to avoid missing future references.
2. **Dedicated permission names.** Split `products.create` into finer catalog permissions once route breadth increases (`catalog.manage`, `inventory.count`, `inventory.revalue`, etc.).
3. **Event payload conformance tests.** Assert each Phase-2 event matches `event-map-phase2.md` required IDs and money/quantity conventions.
4. **Policy resolver unification.** Costing uses product/category/tenant. UoM/FEFO/oversell should expose consistent resolver APIs and tests for product -> category -> tenant fallback.
5. **Report pagination/filtering.** Valuation and low-stock reports are functional but need pagination, sort, and tenant-safe date/location filters before high-volume tenants.
6. **Outbox dispatcher contract.** Phase 2 only writes outbox rows. A typed dispatcher/consumer interface can be designed now without implementing downstream phases.
7. **Data-quality reports.** Missing barcode, missing base UoM, missing lot expiry for lot-tracked SKU, negative on-hand, orphaned conversion config, duplicate non-primary barcodes.
8. **Admin audit queries.** Back-office screens will need audit/history read APIs by entity.
9. **Performance indexes review.** Run EXPLAIN on valuation report, low-stock report, FEFO allocation, and FIFO consumption with seeded bulk data.

### Deferred by charter phase, not Phase 2 defects

| Deferred item | Phase | Reason |
|---|---:|---|
| Transfers, bins, bonded warehouse | 3 | Requires location/warehouse/bond model. |
| POS sale lot picking, offline queue, Tauri/SQLite | 4 | Cashier/offline architecture belongs there. |
| GL COGS/inventory asset posting and tax rounding | 5 | Requires accounting foundation and D-money. |
| Suppliers, POs, GRNs, landed cost | 6 | Procurement module. |
| Ecommerce shared inventory consumers | 8 | Downstream consumer of inventory events. |
| Hardware barcode/scale bridge | 9 | Device integration. |
| Edge Hub sync/reconciliation | 10 | Offline LAN/cloud sync. |
| Analytics dashboards/read models | 12 | Reporting vertical and read-model consumers. |

## Immediate recommended order

1. Add catalog update/archive APIs and product update/archive.
2. Add variant API.
3. Add lot/expiry, reorder-rule CRUD, stock discrepancy review, and revaluation seam.
4. Add import staging/validation backend design or minimal schema.
5. Run full gates plus throwaway Postgres migration/service/router tests.
6. Update API contracts and close Phase 2 with a final audit report.
