# Phase 2 — Products & Inventory Ledger — Implementation Plan

- **Status:** PLAN ONLY (awaiting owner approval) — no schema/migration/costing/inventory code written.
- **Branch:** `phase-2-implementation` (off master `b404c63`).
- **Specs:** `module-specs/inventory.md` (§42, D1–D7 locked), `competitive/inventory.md` (§41), `adr/0007-inventory-costing-strategy.md`.
- **Inherits:** the VS#1 spine — fail-closed RLS (ADR 0006), 3-role model, `withTenant`, `StockLedger` sole-mutator, money=bigint minor units, idempotency, audit, outbox. Phase 2 **extends**; it does not rebuild.

## Per-phase build order (STANDING DIRECTIVE — Phase 2 and onward)

Within every phase, build strictly in this order:

**schema → migrations → RLS → ROBUST seed data → core domain services → oRPC/Hono routers → validation schemas → RBAC checks → audit/outbox events → tests → API contract docs.**

Two constraints on that order:
- **Seed must be RICH, not minimal** — multiple tenants, a mixed AVCO+FIFO catalog, lots with varied expiry, and an oversell scenario: enough realistic state that a future UI built against this backend has meaningful data to render and validate against. (Detailed in *Seed updates* below.)
- **No polished production UI in Phase 2.** Frontend work is limited to minimal smoke pages, API test harnesses, or screen-planning docs until API contracts + domain behavior are stable and approved. When UI begins (later phases), it pulls **strictly from the verified `ui-inventory/` files and the configured MCP registries** (shadcn Studio / Magic UI) against approved backend APIs — **never hand-rolled generic React**.

> Note on order vs. the RLS-coverage gate: the tenant-isolation coverage check (Commit 0) is an automated test that runs in the gate on **every** commit that adds a table — so although "tests" sits late in the per-commit order, a new tenant-owned table still cannot land RLS-uncovered.

## Locked decisions (one line each — the contract this plan implements)

- **D1 costing:** AVCO default; FIFO per tenant/category/product; **no LIFO**; **both storage paths mandatory** (`avg_cost` for AVCO, `valuation_layer` for FIFO); **mixed catalogs supported**; resolver **product → category → tenant default**. (ADR-0007.)
- **D2 multi-UoM:** canonical base units; **integer-ratio** conversion factors; **purchase / stock / sale / reporting** unit roles; conversions tenant/category/product configurable.
- **D3 serial/batch/lot:** model **serial + batch/lot + expiry**; ship **lot/batch first**; **serial stub-safe** (table + FK + enum present, capture deferred — no later migration to enable).
- **D4 expiry/FEFO:** **no universal hard-block**; configurable per tenant/category/product; general-retail **warn-and-override** (audited `inventory.override_expiry`); pharmacy/regulated **hard-block selectable**.
- **D6 barcode:** **data-driven** parser config (GS1/EAN-13/UPC-A/EAN-8/Code-128 + variable-measure/weight-embedded); **conservative build** (table + config seam now; live scale/parser → Phase 4).
- **D7 reorder:** **fixed min/max**; **suggest-only**; **no auto-PO**; manager approval before any procurement.
- **OPEN — D-money rounding:** pending GRA/VAT verification; **first needed Phase 5** (tax/FX division). **NOT a Phase-2 blocker.** AVCO division remainders are **carried as exact integers in `total_value_minor`** (value→0 when qty→0), not floored inside the ledger — the rounding *mode* only affects a *displayed* average or a *posted GL* COGS line, which Phase 2 doesn't post. FIFO is division-free. Discrete-UoM conversions that aren't exact integers are **rejected**, not rounded. So the remainder *mechanism* is built now; only the display/GL rounding *parameter* is deferred. (See *Value-integrity invariants*.)

## Costing-strategy resolver (the load-bearing design — first diff to be read closely)

**Storage (both always present; ADR-0007):**
- `avg_cost (tenant_id, sku_id, location_id, total_value_minor bigint, qty_on_hand bigint, currency, scale, updated_at)` — one row per SKU×location. **`total_value_minor` (not a stored average) is the source of truth**; the average is *derived* (`total_value_minor / qty_on_hand`) only when displayed/posted. Carrying total value — not a pre-divided average — is what prevents the leaking-pennies bug (see *Value-integrity invariants*).
- `valuation_layer (id, tenant_id, sku_id, location_id, received_at, seq, qty_remaining bigint, unit_cost_minor bigint, currency, scale, source_movement_id)` — FIFO cost layers; consumed oldest-first (`(received_at, seq)`).
- `costing_method` nullable enum (`avco | fifo`) on **`tenant`** (default `avco` if null), **`category`**, **`product`** (and optionally `sku`).

**Resolution (pure function, unit-tested in isolation):**
```
resolveCostingMethod(ctx, { product, category }):
  return product.costing_method            // most specific
      ?? category?.costing_method
      ?? tenantDefault(ctx)                 // 'avco' if tenant unset
```

**Application at each movement (inside the tenant tx, beside the policy-neutral ledger):**
- `StockLedger.append` still records the movement faithfully (unchanged from VS#1) and **already takes a `pg_advisory_xact_lock` on `(tenant_id, location_id, sku_id)`** before computing `balance_after` (VS#1). The valuation step runs **inside that same locked section**, so all costing mutations for a SKU×location are serialized (see *Concurrency*).
- A `valuation` step resolves the method for that SKU and updates the matching projection:
  - **AVCO receipt:** `total_value_minor += recv_qty × recv_cost_minor`; `qty_on_hand += recv_qty`. **Both exact integer** — no division on receipt.
  - **AVCO issue (qty `q` of on-hand `Q`, value `V`):** `cogs = (V × q) / Q` (integer division). `total_value_minor -= cogs`; `qty_on_hand -= q`. **The remainder stays in `total_value_minor`** (it is carried, never floored away). **Invariant:** when `qty_on_hand` reaches 0, the issue consumes the *entire remaining* `total_value_minor` (`cogs := V` on the zeroing issue), so **value reaches 0 exactly when quantity does** — no orphaned cents. The D-money rounding mode parameterizes only how a *displayed* average or a *posted GL* COGS line is rounded — **the ledger carries exact integers; nothing is silently floored inside it**.
  - **FIFO receipt:** insert a `valuation_layer` row. **FIFO issue:** consume layers oldest-first (`qty_remaining` decrement), `cogs = Σ(consumed_qty × layer_unit_cost)` — **exact integer multiplication, no division, no remainder**; value→0 naturally when the last layer empties.
- **Method is locked once movements exist** for a SKU; change only via an explicit audited `inventory.revalue` event (never a silent edit).

### Value-integrity invariants (answers design-question A — "leaking pennies")

The **mechanism is designed now**; only the rounding-mode *parameter* (D-money) is pending — remainder discipline itself is fully specified:
1. **Value follows quantity.** AVCO carries `total_value_minor` (integer) as truth, not a pre-divided average; the average is derived for display only. So a division remainder is **carried in `total_value_minor`**, not discarded.
2. **Zero-quantity ⇒ zero-value.** The issue that drives `qty_on_hand` to 0 takes all remaining `total_value_minor` as its COGS. **Asserted invariant (and tested):** `qty_on_hand == 0 ⟺ total_value_minor == 0` for every AVCO SKU×location. FIFO satisfies this by construction (no division). **No orphaned cents attached to zero stock — ever.**
3. **Rounding is APPLIED, not carried-loss.** The only place a value is rounded is the **posted COGS / displayed unit-cost line**, parameterized by the still-open D-money mode. The ledger/`total_value_minor`/`valuation_layer` store exact integers. If D-money is unset, Phase-2 still runs: AVCO carries the exact remainder and zeroes correctly; only a *display/GL-posting* rounding choice is deferred (and Phase 5 is when COGS is actually posted to a GL).

### Concurrency — FIFO layer consumption & AVCO updates (answers design-question B)

The Phase-1 idempotency advisory lock is keyed **per request**, so it does **not** serialize two *different* sales of the same SKU. Two defenses, both designed in:
1. **Per-inventory-cell advisory lock (already in VS#1).** `appendStockMovement` takes `pg_advisory_xact_lock(hash(tenant, location, sku))` before touching balance; the valuation step runs inside it, so concurrent movements for the same SKU×location **serialize** — the second waits for the first to commit.
2. **Row-level lock on the consumed layers (belt-and-suspenders).** FIFO consumption does `SELECT … FROM valuation_layer … ORDER BY received_at, seq … FOR UPDATE` on the rows it will decrement, inside the same tx — so even without the advisory lock, two consumers cannot both read the same oldest layer and double-spend it. AVCO issue does `SELECT … FROM avg_cost … FOR UPDATE` on the SKU×location row.
3. **Planned concurrency test (deliberately-widened window, mirroring the idempotency one):** two simultaneous sales of the same FIFO SKU, with an injected delay between layer-read and layer-decrement; assert layers are consumed exactly once (no double-spend, `qty_remaining` correct, COGS sums correct). A parallel AVCO test asserts two concurrent issues leave `total_value_minor`/`qty_on_hand` consistent and the zero-value invariant intact.

**Why this is the diff to read:** green tests prove the arithmetic; only a human read confirms a *mixed* catalog routes each movement to the correct projection (AVCO SKU → `avg_cost`, FIFO SKU → `valuation_layer`) via product→category→tenant, that the FIFO path never divides, that the zero-qty⇒zero-value invariant holds, and that concurrent same-SKU consumers serialize.

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
- **Value-integrity invariant (A):** for every AVCO SKU×location, `qty_on_hand == 0 ⟺ total_value_minor == 0` after an arbitrary receipt/issue sequence that produces division remainders — proves no orphaned cents. FIFO: value→0 when the last layer empties.
- **Concurrency (B):** two simultaneous sales of the same FIFO SKU with a widened read→decrement window — assert layers consumed exactly once (no double-spend); a parallel AVCO concurrent-issue test asserts `total_value_minor`/`qty_on_hand` stay consistent and the zero-value invariant holds.
- **UoM:** carton↔each integer exactness; weighed kg↔g; discrete non-exact conversion rejected.
- **FEFO/D4:** advisory vs warn-override vs hard-block per resolver; audited override.
- **Oversell/D5:** allow-with-flag emits `inventory.stock_discrepancy`; hard-block rejects.
- **Reorder:** min/max breach emits suggestion; never creates a PO.
- **Idempotency/audit/outbox** on every new mutation (extends existing patterns).
- All DB-gated (real Postgres, `retailos_app`), executed in CI's `db-rls` job.

## Seed updates — RICH, not minimal (standing directive)

The seed must produce realistic, multi-faceted state so a future UI has something meaningful to render/validate and so every decided behavior is exercised by data — not just by tests. Built via the tenant-scoped `withTenant` path (no RLS bypass), idempotent/re-runnable.

- **Multiple tenants (≥2):** e.g. `tenant_supermarket` (AVCO default) and `tenant_pharmacy` (FIFO default) — proves cross-tenant isolation has real data on both sides and that the tenant-level costing default differs.
- **Mixed AVCO+FIFO catalog within a tenant:** a third `tenant_mixed` with a `grocery` category (AVCO) and a `pharmacy` category (FIFO), plus a **product-level override** (one AVCO-category SKU forced to FIFO) — so product→category→tenant resolution is visibly exercised at all three levels.
- **Full catalog depth:** categories, brands, products with **variants → SKUs → barcodes**, multi-UoM (carton=24×each; a weighed kg/g SKU), and one **weight-embedded barcode config** row.
- **Lots with varied expiry:** several `lot` rows per lot-tracked SKU — already-expired, near-expiry (inside the warning horizon), and far-future — so FEFO ordering and the D4 warn/hard-block paths have data; plus a **serial stub** row to prove the seam.
- **Stock state via the ledger (not counters):** opening-balance + receipt movements feeding both `avg_cost` (AVCO SKUs) and `valuation_layer` (FIFO SKUs); a couple of issues so FIFO layers are partially consumed.
- **An oversell scenario:** a sale that drives one SKU **negative on-hand** (allow-with-flagging tenant) with the resulting `inventory.stock_discrepancy` event present, **and** a hard-block-configured category/product where the oversell is rejected — both states seeded so a manager dashboard has real discrepancies to show.
- **Reorder rules:** min/max on a few SKUs with at least one **below reorder point** so a low-stock suggestion exists.
- **Multi-currency cost** on at least one imported SKU (bigint minor units + currency + scale).

Valuation projections (`avg_cost`/`valuation_layer` rows) are produced by running seed movements **through the costing resolver service** once it exists (Commit 4+), so seed values are never hand-faked and the resolver is validated by seed data. Raw catalog/lot/config state seeds right after RLS (per the build order); valuation-bearing movements seed once the resolver lands.

## Risk points

1. **AVCO division remainders ("leaking pennies").** Mitigation **(mechanism built now, not deferred):** carry `total_value_minor` as integer truth (not a pre-divided average); the remainder stays in `total_value_minor`; the zeroing issue takes all remaining value so `qty=0 ⟺ value=0`. Only the *display/GL* rounding mode is pending (D-money). Invariant is asserted by test.
2. **Concurrent FIFO layer double-consumption.** Two same-SKU sales could read the same oldest layer. Mitigation **(designed now):** the existing per-`(tenant,location,sku)` advisory lock serializes movements + `SELECT … FOR UPDATE` on the consumed `valuation_layer` rows (and the `avg_cost` row for AVCO); proven by a widened-window concurrency test. (Offline-replay reconciliation of layer state is a Phase-4 concern; Phase-2 keeps mutations in-tx + idempotent.)
3. **stock_movement FK additions** — must be nullable + expand/contract so existing VS#1 rows remain valid.
4. **New-table RLS omission** — the exact failure the coverage gate exists to catch (see below).
5. **UoM rounding on weighed goods** — tied to D-money; discrete SKUs reject non-exact, weighed deferred.

## Commit breakdown (coverage gate runs BEFORE each new table's commit lands)

Follows the standing per-phase build order (**schema → migrations → RLS → seed → services → routers → validation → RBAC → audit/outbox → tests → API contract docs**). The tenant-isolation coverage check is wired as an automated test (Commit 0) that runs in the gate on every table-adding commit, so **no Phase-2 table merges without proving it is RLS-covered or excluded-with-a-reason** — and the schema→migrations→RLS→coverage steps for a given table-group always land before anything builds on it.

**0. Coverage check as code** — `tenant-isolation-coverage.test.ts`: enumerate every schema table, fail if any imports `tenantId` but lacks a policy (or vice-versa). Lands first; gates every later commit.

**Schema → migrations → RLS (each table-group: define schema, write migration, add ENABLE+FORCE+policy, coverage test green before commit):**
1. Catalog — category/brand/variant/sku/barcode/unit_of_measure/uom_conversion (+ `product` extensions).
2. Tracking — lot/serial + `stock_movement` nullable lot/serial/cost FKs.
3. Costing storage — `avg_cost` + `valuation_layer` + `costing_method` config columns + barcode parser config.
4. Reorder/counts — reorder_rule, stock_count(_line); bundle/bom/bom_line (catalog-only).

**ROBUST seed (right after RLS, before services):**
5. Rich seed — raw catalog/lot/config/reorder state per the *Seed updates* section (valuation-bearing movements deferred to Commit 7, once the resolver exists).

**Core domain services:**
6. **Costing-strategy resolver + storage application** — `resolveCostingMethod` (pure) + `applyValuation` (AVCO/FIFO). **THE diff for close review;** mixed-catalog routing + division-free FIFO proven by tests.
7. UoM conversion · FEFO allocation (D4) · oversell resolver (D5) · reorder evaluation (D7) · stock-count posting; **seed valuation movements run through the resolver here** (so seed values are computed, never faked).

**Routers → validation → RBAC → events:**
8. oRPC routers (catalog CRUD, `inventory.receive`/adjust/count, reorder rules, reports) — each with Zod validation schemas, RLS-scoped FK guards (VS#1 pattern), per-route RBAC (`assertPermission`), and audit + outbox emission in the same tenant tx.

**Tests → API contract docs (per the build order, plus continuous gating):**
9. Full DB-gated test sweep (RLS per new table, resolver mixed-routing, UoM exactness, FEFO/oversell/reorder, idempotency/audit/outbox) + §32-style mixed-catalog e2e + **API contract docs** for the new routers.

Each commit: implement scope → gates (`check`/`check-types`/`test` + coverage test + real-Postgres RLS) → one codex adversarial review (CRITICAL/HIGH only) → fix → commit → PR. Same loop as VS#1. **No production UI in any of these commits** (per the frontend constraint above).

## Stop condition

This is a PLAN. **No Phase-2 schema, migration, costing, inventory, or POS code is written until the owner approves this plan.** The costing resolver + storage design (above) is the first diff to be read closely and will not be implemented before approval.
