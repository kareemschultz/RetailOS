# Phase 3 — Gap Analysis (Locations / Warehouses / Bonds / Transfers / Bins)

- Status: **Planning — no code.** Verified against the schema/services on master `eabf98e` (Phase 2 complete).
- Method: read the actual schema (`packages/db/src/schema/*`), services (`costing.ts`, `stock-ledger.ts`, `inventory.ts`), migrations (0000–0011), RLS (`tenant.ts`, `tenant-isolation-coverage.test.ts`), and routers (`vs1.ts` `assert*Visible`). Findings are what's **on disk today**, not assumptions.

## A. What already exists (the spine Phase 3 builds on)
- **`company` + `location`** tables exist (`company.id`/`location.id` = uuid PK; `tenant_id` = text). `location.companyId` FK → `company.id`.
- **`location.type`** column exists, defaulting `"store"`, comment lists `store | warehouse | bonded | distribution_center | fulfillment_center`.
- **`stock_ledger`** is the append-only sole-mutator: `location_id` (NOT NULL FK), `product_id` (NOT NULL FK), `sku_id`/`lot_id`/`serial_id` (nullable FK), `movement_type` text, `qty_delta`/`balance_after` bigint, cost columns, `source_movement_id`, `ref_type`/`ref_id`, `idempotency_key`. `appendStockMovement` advisory-locks `(tenant:location:cell)` and sets `balance_after = SUM(qty_delta)` for the `(location, sku|product)` cell.
- **Costing** is **SKU×location**: `avg_cost` unique `(tenant, sku, location)` with invariant `qty_on_hand<>0 OR total_value_minor=0`; `valuation_layer` per `(tenant, sku, location, received_at, seq)`. `applyValuation(tx, ctx, movement)` resolves method, **stamps `costing_method_applied`**, and returns `{cogsMinor, currency, method, scale, unvaluedQty}`.
- **Costing method resolves product → category → tenant (NOT location).** ⇒ a SKU is AVCO-everywhere or FIFO-everywhere; **transfers are never mixed-method**. (Big simplification.)
- **RLS** fail-closed via `withTenant` + ENABLE/FORCE/`tenant_isolation` DO-block; `tenant-isolation-coverage.test.ts` mechanically blocks any uncovered tenant table.
- **Cross-tenant FK guard** = router `assert*Visible` RLS-scoped existence reads (`assertLocationVisible`, etc.).
- **Outbox** `emitEvent` injects `occurredAt`; `DomainEventType` constants. Next migration index = **0012**.

## B. GAPS (what Phase 3 must add) — findings first

### G1 — `location.type` is an UNCONSTRAINED text column
`type: text("type").default("store")` has **no enum/CHECK** — the valid set lives only in a comment. Any string is insertable today. **Gap:** tighten to `text({ enum: LOCATION_TYPES })` + CHECK (charter's extensible-enum rule), so `bonded`/`warehouse`/`distribution_center`/`fulfillment_center` are first-class and bond logic can trust the type. (Expand-only: add CHECK; existing rows are all `store`.)

### G2 — NO composite `(tenant_id, id)` FKs anywhere; NO `unique(tenant_id, id)` on any table
Every FK is single-column (`x_id → x.id`); cross-tenant safety is **router-only** (`assert*Visible`). This is the **H1 class at the DB layer**. **Gap (ticket #5, in scope per owner):** Phase-3 tables must be born with composite FKs; referenced tables (`company`, `location`, `product`, `sku`, `lot`) need `UNIQUE(tenant_id, id)` added (expand-only) so they can be composite-FK targets. See plan §A.

### G3 — NO transfer movement types; NO transfer/in-transit model
`movement_type` enum = `adjustment | receipt | sale | valuation_adjustment | return`. There is **no `transfer_out`/`transfer_in`**, no transfer header/line, no in-transit holding. **Gap:** add transfer movement types + a transfer aggregate (header/line) + an in-transit modelling decision. Transfers reuse `appendStockMovement` (two legs) so the ledger stays the single mutator.

### G4 — NO way to move VALUE on a transfer without precision loss
`applyValuation`'s **receipt path computes value as `unitCostMinor × qty`**. To conserve value exactly, a transfer-in must inject the **exact released integer value** `V` (from the source issue's `cogsMinor`), because `floor(V/qty) × qty ≤ V` loses pennies. **Gap:** an **additive** extension to the costing service (accept an explicit total-value cost basis on a transfer-receive), so value moves exactly. **This touches FROZEN Phase-2 `costing.ts`** → owner decision (plan §B / risks). By carrying the exact integer total, value-conservation does **not** depend on #6 rounding.

### G5 — NO bonded-vs-released separation
There is no concept of bonded stock today. **Gap:** model bonded stock as a `bonded` **location type** (recommended) so bonded↔released separation IS location separation, and bond release IS an (approved) bond-to-store transfer. Avoids touching the frozen ledger/costing grain. (Alternative: a stock-state flag on balances — heavier, touches every query; not recommended.)

### G6 — NO bond receiving / release / approval / customs-reference seams
**Gap:** bond-receipt path (import batch → bonded location), bond-release path (bonded → released via the transfer machinery) with an **approval seam** (RBAC-gated immediate vs request→approve workflow — owner decision), and **customs/landed-cost reference** columns/tables (references only; **no allocation behaviour**).

### G7 — NO warehouse internal structure (zone/aisle/rack/shelf/bin)
**Gap:** a bin hierarchy under a warehouse `location`. **Scope decision (owner):** ship the bin **structure** tables now, but keep the ledger/costing at **location grain** (bin-level stock balances are a later refinement) — because making the ledger bin-aware would change the FROZEN SKU×location costing grain. Recommend structure-only in Phase 3.

### G8 — Entitlements don't cover warehouse/bond actions
**Gap:** add `warehouse.manage_structure`, `inventory.transfer`, `inventory.transfer_receive`, `bond.receive`, `bond.release`, `bond.approve_release` to the RBAC model; enforce in-tx.

## C. Cross-cutting risks (carried from Phase 2)
- **#8-class risk on transfers:** the transfer write path could append ledger movements **without** calling `applyValuation` (exactly the POS↔costing bug). INV-2 + a value-conservation test + a write-path-invokes-service grep are mandatory **from the start**, not post-hoc.
- **Frozen-file touch:** G4's value path touches `costing.ts` (frozen). Must be **additive** (new optional input; existing receipt/issue/adjust behaviour unchanged) and value-conservation-tested, OR escalated as a Phase-2 change-request (owner call).
- **#6 precision:** not on the value-conservation path (we move exact integers), but a FIFO transfer that re-derives a per-unit cost for a B-layer could reintroduce rounding — handled by carrying the exact total (aggregate layer) and flagging layer-preserving as a future refinement.

## D. What must be BLOCKED until owner approval
1. In-transit modelling choice (virtual-location vs transfer-document-state vs single-step-only).
2. Bond-release mechanics (bonded = location type + approved transfer; approval seam shape).
3. Bins = structure-only (Phase 3) vs bin-level balances (later).
4. FIFO transfer cost basis: aggregate single layer at destination vs layer-preserving.
5. Approving the **additive** transfer-value extension to frozen `costing.ts` as a Phase-3 additive vs a Phase-2 change-request.
6. Transfer oversell: hard-block at source regardless of D5 sale-oversell policy (recommended) vs honour D5.

**No Phase-3 schema or code until these are answered.**
