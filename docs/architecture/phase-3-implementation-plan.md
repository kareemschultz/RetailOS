# Phase 3 — Implementation Plan (Locations / Warehouses / Bonds / Transfers / Bins)

- Status: **PLAN ONLY — STOP for owner approval before any schema or code.**
- Builds on FROZEN Phase 2 (master `eabf98e`). Charter refs §8/§9/§12/§18/§24/§25/§33/§35. Companions: `phase-3-gap-analysis.md`, `module-specs/locations-warehouses-bonds.md`, `event-map-phase3.md`, `competitive/locations-warehouses-bonds.md`.
- **Standing build order (charter):** schema → migrations → RLS → robust seed → services → routers → validation → RBAC → audit/outbox → tests → API contract docs. **No UI. No POS. No GL. No ecommerce. No offline-queue.**

---

## §A — Tables, RLS, and composite-FK (#5 IS in scope, at birth)

### New tenant-owned tables (all get `tenant_id` + ENABLE+FORCE+`tenant_isolation` RLS in the same migration)
| Table | Purpose | Key FKs (composite, at birth) |
|---|---|---|
| `warehouse_zone` | top of the bin hierarchy under a warehouse `location` | `(tenant_id, location_id) → location` |
| `warehouse_aisle` | under zone | `(tenant_id, zone_id) → warehouse_zone` |
| `warehouse_rack` | under aisle | `(tenant_id, aisle_id) → warehouse_aisle` |
| `warehouse_shelf` | under rack | `(tenant_id, rack_id) → warehouse_rack` |
| `bin` | addressable bin (leaf) | `(tenant_id, shelf_id) → warehouse_shelf` (+ denormalized `(tenant_id, location_id)`) |
| `stock_transfer` | transfer header (source, destination, status, in-transit) | `(tenant_id, source_location_id) → location`, `(tenant_id, dest_location_id) → location` |
| `stock_transfer_line` | per-SKU qty on a transfer | `(tenant_id, transfer_id) → stock_transfer`, `(tenant_id, sku_id) → sku`, `(tenant_id, product_id) → product` |
| `bond_receipt` | import batch received into a bonded location | `(tenant_id, location_id) → location` |
| `bond_receipt_line` | per-SKU bonded qty + cost + customs/landed refs | `(tenant_id, bond_receipt_id) → bond_receipt`, `(tenant_id, sku_id) → sku` |
| `bond_release` | release request/approval of bonded stock (approval seam) | `(tenant_id, bond_receipt_id) → bond_receipt`, `(tenant_id, transfer_id) → stock_transfer` (the release executes as a transfer) |
| `customs_reference` *(seam)* | customs doc/reference attached to a bond receipt (no OCR) | `(tenant_id, bond_receipt_id) → bond_receipt` |

> `bin`/structure tables ship the **model**; the **stock ledger stays at location grain** (bin-level balances are a later refinement — see §E). `customs_reference` + landed-cost reference columns are **reference seams only** — no allocation.

### Bonded as a location type (recommended)
Tighten `location.type` to `text({ enum: LOCATION_TYPES })` + CHECK where `LOCATION_TYPES = ['store','warehouse','bonded','distribution_center','fulfillment_center','in_transit']`. **Bonded stock = stock in a `bonded` location.** Releasing = a bond-to-store **transfer** (bonded → released location) gated by approval. `in_transit` is a system location type for two-step transfers (see §C).

### Composite-FK (#5) — kill the H1 class at the DB layer for the Phase-3 surface
- **Referenced existing tables get `UNIQUE(tenant_id, id)` added (expand-only migration):** `company`, `location`, `product`, `sku`, `lot`. (Required so they can be composite-FK targets.)
- **Every new Phase-3 FK is composite:** `FOREIGN KEY (tenant_id, x_id) REFERENCES x(tenant_id, id)`. A cross-tenant reference becomes a **DB-layer impossibility**, not a router-only guard.
- **Additive bonus (recommended):** upgrade `location.company_id` to a composite FK (the clearest existing H1 hole at the location layer Phase 3 builds on). Full retrofit of all Phase-2 FKs to composite is a **noted follow-up**, not required here.
- Keep the router `assert*Visible` reads as belt-and-braces (defense in depth). Extend the H1 parameterized harness to every new Phase-3 FK input.

## §B — TRANSFER VALUATION (the load-bearing design question)

**Setup (verified):** `avg_cost`/`valuation_layer` are **SKU×location**; costing method resolves **product→category→tenant (not location)**, so a SKU is AVCO-everywhere or FIFO-everywhere ⇒ **a transfer is AVCO→AVCO or FIFO→FIFO, never mixed**.

**How value moves on a transfer of qty `q` of sku `S` from A → B:**
1. **Issue at source A** — `appendStockMovement(transfer_out, qty=−q, location=A)`, then `applyValuation` computes the value leaving A at **A's own cost basis**:
   - AVCO: proportional COGS `V = round(total_value_A × q / qty_on_hand_A)` (the existing AVCO-issue arithmetic) — A's `avg_cost` decrements by exactly `V` and `q`.
   - FIFO: consume A's oldest layer(s); `V` = exact integer sum of consumed `unit_cost × qty` per layer.
   - In both cases `applyValuation` returns `cogsMinor = V` — the **exact integer value released**.
2. **Receive at destination B** — `appendStockMovement(transfer_in, qty=+q, location=B)`, then `applyValuation` as a **receipt at B using the carried value `V` as the cost basis**:
   - AVCO: B's `avg_cost.total_value_minor += V`, `qty_on_hand += q`.
   - FIFO: create a **single B-layer** with `qty_remaining = q`, total value `V` (aggregate cost basis — see open decision 4).

**Cost basis & exactness:** B receives the **exact integer `V`** released by A — **not** `unitCost × q`. This is the crux: injecting a rounded unit cost (`floor(V/q) × q`) would lose pennies and break conservation. By moving the **integer total**, no division/rounding happens on the value-conservation path, so **#6 (mulDivRound) is NOT a blocker for transfer value-conservation.**

**Proof of conservation (no value created/destroyed in transit):**
- Quantity: `Δqty_A = −q`, `Δqty_B = +q` ⇒ `Σ qty` over {A, in-transit, B} unchanged.
- Value: `Δvalue_A = −V`, `Δvalue_B = +V` ⇒ `Σ value` over locations unchanged. For two-step transfers, in-transit holds `(+q, +V)` between the two legs, so the invariant holds **during** the gap too.
- **DB-gated test (required):** receive at A to set a known cost; transfer `q` to B; assert `value_A(before) − value_A(after) == value_B(after) − value_B(before) == V`, and total qty/value across A+in-transit+B conserved at each step; assert one deduction on idempotent replay.

**Change to the FROZEN Phase-2 costing service — flagged:**
- The transfer-receive needs to inject an **exact total value** (not `unitCost × qty`). The current receipt path can't express that. This is an **ADDITIVE** extension to `applyValuation`/`appendStockMovement` — a new optional `transferValueMinor` (or a `transfer_in` movement-type branch) cost-basis input — that **does not change** existing receipt/issue/adjust/value-only behaviour.
- **Owner decision (risk §, decision #5):** accept this as a **Phase-3 additive** to a frozen file (recommended — it's purely additive + value-conservation-tested + earns a line-by-line human read), OR treat it as a **Phase-2 change-request** (its own mini-pass). Recommendation: **Phase-3 additive**, with the transfer-valuation commit as the one that gets the human read.

## §C — In-transit modelling (open decision 1; recommended shape)
**Recommended: in-transit as a virtual `in_transit` location** (system location per company, or per-transfer). A two-step transfer is: leg 1 `A → in_transit` (dispatch), leg 2 `in_transit → B` (receive). Stock & value always live in **some** location's ledger ⇒ conservation holds trivially and in-transit is queryable. Single-step (atomic A→B) is a degenerate case (no in-transit visibility). Alternative (transfer-document-state, no virtual location) is more bespoke and parks value on the transfer row. **Decide before build.**

## §D — Per-invariant ownership + the standing gate (built in from the start)
Each invariant from the module spec, its owning service, the write path that MUST invoke it, and the test (the §C lessons-learned gate is part of the plan, not a post-hoc review):
- **INV-1 qty conservation** → `transfer.ts::executeTransfer` (both legs via `appendStockMovement` in one tx); router invokes it; test asserts qty conserved + idempotent.
- **INV-2 value conservation** → `transfer.ts` MUST call `applyValuation` on **both** legs and inject exact `V`; the **#8-class grep** (transfer router → applyValuation, both legs) + value-conservation DB test are mandatory.
- **INV-3 bonded≠released** → location-type model + `bond.ts`; bonded stock excluded from released/available views; release moves stock out of the bonded location.
- **INV-4 bond-release authz** → `bond.ts` release path invokes the entitlement/approval seam; unauthorized release rejected + audited.
- **INV-5 tenant-FK safety** → DB composite FKs + extended H1 harness.
- **INV-6 RLS/soft-delete** → coverage gate + fail-closed tests.

## §E — Bins: structure-only in Phase 3 (open decision 3; recommended)
Ship `warehouse_zone/aisle/rack/shelf/bin` as an addressable hierarchy under a warehouse location. **Do NOT make the ledger bin-aware** in Phase 3 — that would change the frozen SKU×location costing grain (avg_cost/valuation_layer would become SKU×location×bin). Bin-level stock balances + directed putaway are a later refinement. If the owner wants bin-grained stock now, that's a larger pass touching frozen costing — flag, don't assume.

## §F — Proposed commit sequence (ONE implementation pass — see §G justification)
A single Phase-3 branch `phase-3-locations-warehouses-bonds`, one PR, commits grouped by deliverable:
0. **Composite-FK groundwork** — `UNIQUE(tenant_id, id)` on `company/location/product/sku/lot` (expand-only); extend the H1 harness scaffolding. (Enables every later composite FK.)
1. **Location refinement** — tighten `location.type` to enum+CHECK; add `LOCATION_TYPES` incl. `bonded`/`in_transit`; RLS unchanged (existing table).
2. **Warehouse structure** — zone/aisle/rack/shelf/bin tables + composite FKs + RLS + coverage gate.
3. **Transfer model + qty conservation** — transfer movement types (`transfer_out`/`transfer_in`), `stock_transfer`/`stock_transfer_line`, in-transit location, `transfer.ts::executeTransfer` (both legs, qty-conserving) + RLS + events + INV-1 test. *(No valuation yet.)*
4. **Transfer VALUE conservation** — the additive costing extension (exact `V` injection) + `applyValuation` on both legs + INV-2 value-conservation DB test. **← the commit that earns a line-by-line human read + the mid-pass owner checkpoint (§G).**
5. **Bonded receiving + separation** — `bond_receipt`/`bond_receipt_line`, bonded-location handling, INV-3 separation + RLS + events.
6. **Bond release + approval seam** — `bond_release`, release-as-transfer, INV-4 authz/approval seam, customs/landed-cost **reference** columns/tables (no allocation) + events.
7. **RBAC + robust seed + API contract docs** — new entitlements enforced in-tx; rich Phase-3 seed (multi-location tenant, a bonded location, a warehouse with bins, in-flight + completed transfers); `phase-3-api-contracts.md`.
8. **Reassessment (§45)** — end-of-phase review + ADR(s): an ADR for the transfer-valuation model and one for bonded-as-location-type + composite-FK adoption.

Per-commit loop (unchanged): gates (`check`/`check-types`/`test` + coverage gate + real-Postgres DB-gated) → Codex adversarial review (CRITICAL/HIGH) → fix → commit → push → PR update → lessons + PROGRESS.

## §G — ONE pass vs split (justification — §D of the brief)
**Proposed: ONE implementation pass.** Phase 2 fractaled (schema→hotfix→close-out→behavior→housekeeping) because it was the **financial core** with wrong-money stakes. Phase 3 is **structural CRUD + transfers over a proven spine** (RLS, ledger, costing all shipped + tested), so it should NOT inherit that cadence by default. **The one genuine financial touch** is the additive transfer-value extension (§B, commit 4). Rather than split into multiple PRs, the plan keeps ONE PR but places a **single risk-justified owner checkpoint after commit 4** (transfer value-conservation) — the one place touching frozen financial code — for a line-by-line read before continuing to bond logic. That's a checkpoint matched to a real risk, not habit.

## §H — Recommended FIRST implementation commit (after approval)
**Commit 0 — composite-FK groundwork (expand-only):** add `UNIQUE(tenant_id, id)` to `company`, `location`, `product`, `sku`, `lot`; no behaviour change; coverage gate + existing suites stay green; verified by applying the migration in a disposable PG18 and re-running DB-gated tests. Rationale: it's the lowest-risk, fully-additive foundation that **every** later Phase-3 composite FK depends on, it kills the H1 class at the DB layer for the Phase-3 surface from the first commit, and it touches no frozen behaviour — the ideal first step to prove the pass is on rails before any new table or the costing touch.

## §I — Open decisions requiring owner answer BEFORE implementation
1. **In-transit:** virtual `in_transit` location (recommended) vs transfer-document-state vs single-step-only.
2. **Bond-release mechanics:** bonded = location type + release = approved bond-to-store transfer (recommended); approval seam = RBAC-gated immediate vs request→approve workflow?
3. **Bins:** structure-only in Phase 3 (recommended) vs bin-level stock balances now (touches frozen costing grain).
4. **FIFO transfer cost basis:** aggregate single destination layer (recommended, value-conserving, simplest) vs layer-preserving multi-layer.
5. **Frozen-costing touch:** approve the additive transfer-value extension to `costing.ts` as a **Phase-3 additive** (recommended) vs a Phase-2 change-request.
6. **Transfer oversell:** hard-block at source regardless of D5 sale-oversell policy (recommended — can't ship stock you don't have) vs honour D5 per location.
