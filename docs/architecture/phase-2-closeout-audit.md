# Phase 2 Closeout Audit — Products & Inventory Ledger

- **Date:** 2026-06-22
- **Branch:** `phase-2-implementation`
- **Scope audited:** backend schema, migrations, RLS, seed, services, routers, events, tests, contracts, and research/gap status.
- **Out of scope by charter:** production UI, POS/Tauri/offline, warehouse/bond transfers, accounting GL/tax rounding, procurement/landed cost, Edge Hub sync, ecommerce consumers, analytics dashboards.

## Executive conclusion

No P0 backend gaps remain for the approved Phase-2 Products & Inventory Ledger scope.

Phase 2 now has the backend spine needed for catalog/product inventory work: tenant-owned schema + fail-closed RLS, rich multi-tenant seed data, AVCO/FIFO valuation, exact integer UoM handling, FEFO/oversell/reorder/count services, inventory mutation/report routes, catalog lifecycle routes, lot/reorder lifecycle routes, import preview validation, audited revaluation, stock-discrepancy review seam, transactional outbox events, API contracts, and DB-gated tests.

## Backend completion matrix

| Area | Status | Audit result |
|---|---:|---|
| RLS coverage gate | Complete | Static gate enumerates Drizzle tables and requires tenant-owned tables to have ENABLE + FORCE + tenant policy coverage. |
| Schema and migrations | Complete | Phase-2 catalog, tracking, costing, reorder/count, bundle/BOM tables and product/stock-ledger seams exist. |
| RLS policies | Complete | New tenant-owned tables are covered by fail-closed tenant policies and the mechanical coverage gate. |
| Rich seed | Complete | Multi-tenant AVCO/FIFO/mixed catalog, varied lots, UoM, reorder/count/BOM config, and valuation-bearing movements exist. |
| Costing resolver | Complete | Product -> category -> tenant resolution; AVCO and FIFO storage paths; same-SKU concurrency guarded by transaction locks / row locks. |
| AVCO value integrity | Complete | `total_value_minor` is the source of truth; zero-quantity implies zero-value; remainders are carried, not silently floored. |
| FIFO layers | Complete | Receipt creates layers; issue consumes oldest layers with `FOR UPDATE`; revaluation can update a specific layer. |
| Inventory services | Complete | UoM, FEFO, oversell, reorder, and count posting services exist with DB-gated tests. |
| Inventory routers/reports | Complete | Receive, adjust, count start/line/post, reorder evaluate, valuation report, low-stock report, discrepancy review, and revaluation. |
| Catalog routers | Complete | Product/category/brand/UoM/SKU/barcode/UoM-conversion/variant lifecycle and lot/reorder-rule lifecycle routes exist. |
| Import seam | Complete for preview | `catalog.importPreview` validates rows and reports per-row errors without writing. Bulk apply/rollback is intentionally deferred. |
| Events/outbox | Complete for Phase 2 | Required Phase-2 inventory event seams are written transactionally where current producers exist. Downstream consumers are later phases. |
| API contracts | Complete | `phase-2-api-contracts.md` documents exposed route contracts and security/audit/outbox expectations. |
| Tests | Complete for approved scope | Static coverage gate, service tests, and router e2e cover the ledger-critical paths and newly added API seams. |

## Research status

Research is complete enough for Phase 2. The official-doc spot-check still supports the current design:

- Odoo documents Standard/AVCO/FIFO inventory valuation, category-level costing methods, valuation layers, lot/serial valuation, and manual valuation adjustments.
- ERPNext documents FIFO and Moving Average valuation methods at the item level.
- Oracle NetSuite documents average and FIFO inventory costing methods.
- Cin7 Core documents FIFO/FEFO costing/picking behavior and batch/serial validation modes.

These systems confirm that RetailOS Phase 2 is targeting the correct backend primitives: configurable costing, average/FIFO valuation, lot/expiry tracking, serial seams, FEFO/expiry policy, valuation reporting, and explicit revaluation seams.

## Remaining items

### No P0 Phase-2 backend gaps

There are no known P0 gaps blocking Phase 2 backend review.

### P1 hardening / quality-of-life backlog

1. Extract shared RLS-scoped catalog guard helpers to reduce route duplication.
2. Split broad temporary permissions into finer catalog/inventory permissions.
3. Add event payload conformance tests against `event-map-phase2.md`.
4. Unify policy resolver APIs across costing, FEFO, oversell, and UoM.
5. Add pagination/filter/sort to valuation and low-stock reports.
6. Define typed outbox dispatcher interfaces before downstream consumers are built.
7. Add data-quality report routes: missing barcode, missing base UoM, missing expiry, negative on-hand, orphaned conversion config.
8. Add audit-history read APIs by entity for future back-office screens.
9. Run EXPLAIN/index review with bulk seed data for valuation, low-stock, FEFO, and FIFO paths.

### Deferred by charter phase

| Item | Phase | Reason |
|---|---:|---|
| Warehouse/bin/bond transfer workflows | 3 | Requires the locations/warehouses/bonds module. |
| POS sale lot picking, offline queue, Tauri/SQLite | 4 | Cashier/offline architecture belongs to POS & Offline Queue. |
| GL inventory asset/COGS posting and tax rounding | 5 | Requires accounting foundation and the D-money rounding decision. |
| Supplier POs, GRNs, landed cost | 6 | Procurement module. |
| Ecommerce inventory consumers | 8 | Storefront/order consumer phase. |
| Hardware barcode/scale bridge | 9 | Device integration phase. |
| Edge Hub sync/reconciliation consumers | 10 | Offline LAN/cloud sync phase. |
| Analytics read models/dashboards | 12 | Reporting vertical. |

## Verification plan

Verified final gate set before marking Phase 2 backend review-ready:

```bash
bun run check:mojibake  # pass
bun run check           # pass, 153 files
bun run check-types     # pass, 6/6 package tasks
bun run test            # pass, 7/7 package tasks
```

Additional DB-backed router verification uses a throwaway Postgres container, applies bootstrap roles + all migrations as `retailos_migrator`, then runs the API router integration suite as `retailos_app`.

Result:

```text
@RetailOS/api src/routers/vs1.integration.test.ts: 5 passed
db-api-final-ok
```

## Stop point

Stop Phase-2 backend implementation here for owner review. The next implementation work should either be P1 hardening from the backlog above or Phase 3 backend planning/implementation after explicit approval.
