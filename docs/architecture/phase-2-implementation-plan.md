# Phase 2 — Products & Inventory Ledger — Implementation Plan

- **Status:** PLAN ONLY (awaiting owner approval) — no schema/migration/costing/inventory code written.
- **Branch:** `phase-2-implementation` (off master `b404c63`).
- **Specs:** `module-specs/inventory.md` (§42, D1–D7 locked), `competitive/inventory.md` (§41), `adr/0007-inventory-costing-strategy.md`.
- **Inherits:** the VS#1 spine — fail-closed RLS (ADR 0006), 3-role model, `withTenant`, `StockLedger` sole-mutator, money=bigint minor units, idempotency, audit, outbox. Phase 2 **extends**; it does not rebuild.

## Locked decisions (one line each — the contract this plan implements)

- **D1 costing:** AVCO default; FIFO per tenant/category/product; **no LIFO**; **both storage paths mandatory** (`avg_cost` for AVCO, `valuation_layer` for FIFO); **mixed catalogs supported**; resolver **product → category → tenant default**. (ADR-0007.)
- **D2 multi-UoM:** canonical base units; **integer-ratio** conversion factors; **purchase / stock / sale / reporting** unit roles; conversions tenant/category/product configurable.
- **D3 serial/batch/lot:** model **serial + batch/lot + expiry**; ship **lot/batch first**; **serial stub-safe** (table + FK + enum present, capture deferred — no later migration to enable).
- **D4 expiry/FEFO:** **no universal hard-block**; configurable per tenant/category/product; general-retail **warn-and-override** (audited `inventory.override_expiry`); pharmacy/regulated **hard-block selectable**.
- **D6 barcode:** **data-driven** parser config (GS1/EAN-13/UPC-A/EAN-8/Code-128 + variable-measure/weight-embedded); **conservative build** (table + config seam now; live scale/parser → Phase 4).
- **D7 reorder:** **fixed min/max**; **suggest-only**; **no auto-PO**; manager approval before any procurement.
- **OPEN — D-money rounding:** pending GRA/VAT verification; **first needed Phase 5** (tax/FX division). **NOT a Phase-2 blocker** — Phase-2 cost math is integer add / multiply-by-quantity and exact-integer UoM conversion; the only place a non-exact result can arise (a weighed-UoM conversion that isn't an integer in base units) is **rejected** in Phase 2 rather than rounded, so no rounding mode is required.

## Costing-strategy resolver (the load-bearing design — first diff to be read closely)

**Storage (both always present; ADR-0007):**
- `avg_cost (tenant_id, sku_id, location_id, avg_cost_minor bigint, currency, scale, qty_on_hand, updated_at)` — one row per SKU×location; the AVCO running average.
- `valuation_layer (id, tenant_id, sku_id, location_id, received_at, qty_remaining, unit_cost_minor bigint, currency, scale, source_movement_id)` — FIFO cost layers; consumed oldest-first.
- `costing_method` nullable enum (`avco | fifo`) on **`tenant`** (default `avco` if null), **`category`**, **`product`** (and optionally `sku`).

**Resolution (pure function, unit-tested in isolation):**
```
resolveCostingMethod(ctx, { product, category }):
  return product.costing_method            // most specific
      ?? category?.costing_method
      ?? tenantDefault(ctx)                 // 'avco' if tenant unset
```

**Application at each movement (inside the tenant tx, beside the policy-neutral ledger):**
- `StockLedger.append` still records the movement faithfully (unchanged from VS#1).
- A `valuation` step resolves the method for that SKU and updates the matching projection:
  - **AVCO receipt:** `avg_cost = (old_qty*old_avg + recv_qty*recv_cost) / new_qty` — **integer minor-unit math; division is the one rounding-sensitive spot, so it is deferred behind the D-money seam and NOT exercised until a cost actually needs averaging with a remainder** (Phase-2 seed/flows use exact divisors; a remainder path is gated until rounding mode lands). AVCO issue: COGS = `qty * avg_cost` (exact).
  - **FIFO receipt:** insert a `valuation_layer` row. **FIFO issue:** consume layers oldest-first (`qty_remaining` decrement), COGS = Σ(consumed_qty × layer_unit_cost) — all exact integer multiplication, **no division, no rounding**.
- **Method is locked once movements exist** for a SKU; change only via an explicit audited `inventory.revalue` event (never a silent edit).

**Why this is the diff to read:** green tests prove the arithmetic; only a human read confirms a *mixed* catalog routes each movement to the correct projection (AVCO SKU → `avg_cost`, FIFO SKU → `valuation_layer`) via product→category→tenant, and that the FIFO path never divides.

## Schema tables (all new tenant-owned tables get RLS — see the gate)

New (tenant-owned, RLS-required): `category`, `brand`, `variant`, `sku`, `barcode`, `unit_of_measure`, `uom_conversion`, `lot`, `serial` (stub), `avg_cost`, `valuation_layer`, `reorder_rule`, `stock_count`, `stock_count_line`, `bundle`, `bom`, `bom_line`.
Extended (existing): `product` (+ `costing_method`, `base_uom_id`, `tracking_mode`, `category_id`, `brand_id`), `stock_ledger`/`stock_movement` (+ nullable `lot_id`, `serial_id`, `unit_cost_minor`, `movement_type` extensions).
Config columns: `costing_method` on `tenant`/`category`/`product`(/`sku`); barcode parser config on `tenant`.

Every new table imports the shared `tenantId` column (the coverage check's definition of tenant-owned) **or** is documented as excluded-with-a-reason. Expected Phase-2 exclusions: none (all are tenant-owned).

## Migrations (expand/contract, §8)

- `00NN_phase2_catalog.sql` — catalog tables (category/brand/variant/sku/barcode/uom).
- `00NN_phase2_tracking.sql` — lot/serial + stock_movement FK additions (nullable).
- `00NN_phase2_costing.sql` — avg_cost, valuation_layer, costing_method config columns.
- `00NN_phase2_reorder_counts.sql` — reorder_rule, stock_count(_line).
- `00NN_phase2_rls.sql` — **ENABLE+FORCE+`tenant_isolation` policy for every new tenant-owned table** (extends the 0001 pattern). New columns nullable/defaulted; no destructive drops; no in-place renames.

## Services

- `costing/resolver.ts` — `resolveCostingMethod` (pure) + `applyValuation(tx, ctx, movement)` (AVCO/FIFO).
- `uom/convert.ts` — integer-ratio conversion base↔alt; rejects non-exact base results for discrete SKUs.
- `inventory/allocate.ts` — FEFO lot selection per D4 policy resolver (advisory/warn-override/hard-block).
- `inventory/oversell.ts` — the D5 policy resolver (already decided) applied above the neutral ledger.
- `inventory/reorder.ts` — min/max evaluation → `inventory.low_stock` suggestion (no PO).
- `inventory/count.ts` — stock-count posting as `adjustment` movements (audited).
- Extend `StockLedger.append` to carry `unit_cost_minor` + optional `lot_id`/`serial_id` (stays policy-neutral).

## Routers (oRPC, tenant-scoped, RLS-scoped FK checks like VS#1)

`category.*`, `brand.*`, `product.*` (extended), `variant.*`, `sku.*`, `barcode.*`, `uom.*`, `inventory.receive` (extended: lot/expiry/cost), `inventory.adjust`, `inventory.count.*`, `inventory.reorderRules.*`, `reports.valuation`, `reports.lowStock`. Every referenced FK validated with an RLS-scoped read before insert (the VS#1 FK-bypass guard pattern).

## Tests

- **Per new tenant-owned table:** RLS fail-closed (unset GUC ⇒ 0 rows) + cross-tenant denial (extends `tenant.rls.test.ts`).
- **Costing resolver:** product→category→tenant resolution; **mixed catalog routes AVCO→`avg_cost`, FIFO→`valuation_layer`**; FIFO COGS exactness; FIFO path performs no division; method-locked-after-movements.
- **UoM:** carton↔each integer exactness; weighed kg↔g; discrete non-exact conversion rejected.
- **FEFO/D4:** advisory vs warn-override vs hard-block per resolver; audited override.
- **Oversell/D5:** allow-with-flag emits `inventory.stock_discrepancy`; hard-block rejects.
- **Reorder:** min/max breach emits suggestion; never creates a PO.
- **Idempotency/audit/outbox** on every new mutation (extends existing patterns).
- All DB-gated (real Postgres, `retailos_app`), executed in CI's `db-rls` job.

## Seed updates

Extend the dev seed with a **mixed-costing** sample tenant: a supermarket company (AVCO) + a pharmacy company (FIFO + lot/expiry) under one tenant, plus UoM conversions (carton/each), one weight-embedded barcode config, and reorder rules — so the resolver's mixed-catalog routing is exercised by seed data and the §32-style flow.

## Risk points

1. **AVCO division/rounding** — the only rounding-sensitive arithmetic. Mitigation: defer the remainder path behind the D-money seam; Phase-2 flows/seed use exact divisors; assert no rounding is invoked.
2. **FIFO layer consumption under offline replay** — layer state must reconcile (Phase 4 concern); Phase-2 keeps layer mutations inside the tenant tx + idempotent receive/issue.
3. **stock_movement FK additions** — must be nullable + expand/contract so existing VS#1 rows remain valid.
4. **New-table RLS omission** — the exact failure the coverage gate exists to catch (see below).
5. **UoM rounding on weighed goods** — tied to D-money; discrete SKUs reject non-exact, weighed deferred.

## Commit breakdown (coverage gate runs BEFORE each new table's commit lands)

The tenant-isolation coverage check (enumerate every schema table → prove has-`tenant_id` ↔ has-RLS-policy, no straggler) is wired as a **test/script that runs in the gate**, so **no Phase-2 table merges without proving it is RLS-covered or excluded-with-a-reason**:

0. **Coverage check as code** — turn the manual enumeration into an automated test (`tenant-isolation-coverage.test.ts`): fail if any table imports `tenantId` but lacks a policy, or vice-versa. Lands first so every later commit is gated by it.
1. **Catalog schema + RLS + coverage green** — category/brand/variant/sku/barcode/uom; add to RLS migration; coverage test must pass before commit.
2. **Tracking schema + RLS + coverage green** — lot/serial + stock_movement FKs.
3. **Costing storage + RLS + coverage green** — avg_cost/valuation_layer + config columns.
4. **Costing resolver service + tests** — the diff for close review; mixed-catalog routing proven.
5. **UoM conversion service + tests.**
6. **Receive/adjust/count routers + FK guards + tests.**
7. **FEFO (D4) + oversell (D5) policy resolvers + tests.**
8. **Reorder rules + suggestion event + tests.**
9. **Reports (valuation, low-stock) + seed update + §32-style mixed-catalog e2e.**

Each commit: implement scope → gates (`check`/`check-types`/`test` + coverage test + real-Postgres RLS) → one codex adversarial review (CRITICAL/HIGH only) → fix → commit → PR. Same loop as VS#1.

## Stop condition

This is a PLAN. **No Phase-2 schema, migration, costing, inventory, or POS code is written until the owner approves this plan.** The costing resolver + storage design (above) is the first diff to be read closely and will not be implemented before approval.
