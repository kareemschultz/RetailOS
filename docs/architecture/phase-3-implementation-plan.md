# Phase 3 — Implementation Plan (Locations / Warehouses / Bonds / Transfers / Bins)

- Status: **PLAN ONLY — STOP for owner approval before any schema or code.**
- Builds on FROZEN Phase 2 (master `eabf98e`). Charter refs §8/§9/§12/§18/§24/§25/§33/§35. Companions: `phase-3-gap-analysis.md`, `module-specs/locations-warehouses-bonds.md`, `event-map-phase3.md`, `competitive/locations-warehouses-bonds.md`.
- **Standing build order (charter):** schema → migrations → RLS → robust seed → services → routers → validation → RBAC → audit/outbox → tests → API contract docs. **No UI. No POS. No GL. No ecommerce. No offline-queue.**

---

## §0 — PARKED DEBT FIRST (#5 composite-FK + #7 set-once DB-trigger), BEFORE any new table

Pay down the two parked Phase-2 debts that have a Phase-3 home **first** — they harden the spine the new tables sit on, and #5 must exist before new tables can be born with composite FKs.

### #5 — composite `(tenant_id, id)` FKs (durable DB-layer kill for the H1 cross-tenant class)
- **Verified today:** NO composite FKs, NO `unique(tenant_id, id)` anywhere; cross-tenant safety is router-only (`assert*Visible`). That is the H1 class living at the DB layer.
- **Add `UNIQUE(tenant_id, id)` (expand-only) to every table a Phase-3 FK will reference:** `company`, `location`, `product`, `sku`, `lot`. (These are the composite-FK *targets*.)
- **Every new Phase-3 FK is composite:** `FOREIGN KEY (tenant_id, x_id) REFERENCES x(tenant_id, id)` — a cross-tenant reference becomes a **DB-layer impossibility**, including the self-referential `location.parent_location_id`.
- **Additive bonus (recommended):** upgrade `location.company_id` to a composite FK (the clearest existing H1 hole at the layer Phase 3 builds on). Full retrofit of *all* Phase-2 FKs to composite is a noted follow-up, not required here.
- Router `assert*Visible` reads stay as belt-and-braces; extend the H1 parameterized harness to every new Phase-3 FK input.

### #7 — set-once costing-method DB-trigger backstop
- **Verified today:** set-once is enforced only at the app layer (`assertCostingMethodSetOnce` in `product.update`/`skuUpdate`). A future raw service UPDATE bypasses it — the same class as H1.
- **Add a Postgres trigger** (expand-only) on `product`/`sku`: reject an UPDATE of `costing_method` when any `stock_ledger` row exists for that product/sku. This is the DB-level backstop the app guard always wanted; it closes the class regardless of which write path attempts the change.
- Verified by a DB-gated test (raw UPDATE rejected after a movement exists; allowed before).

> §0 touches **no behaviour** and **no frozen costing logic** — pure additive constraints/trigger. It is the safest possible first step and unblocks composite FKs for everything after it.

---

## §A — Location model: ONE unified self-referential tree (not rigid level tables)

Replace the idea of separate Zone/Aisle/Rack/Shelf/Bin tables with **a single self-referential `location` tree** so nesting is dynamic (Warehouse → Zone → Aisle → Bin, to any depth a tenant needs).

### `location` refinements (expand-only on the existing table)
| Column | Purpose |
|---|---|
| `parent_location_id` (nullable, **composite FK** `(tenant_id, parent_location_id) → location(tenant_id, id)`) | self-referential tree; top-level (store/warehouse/bonded/DC) has `NULL` parent. |
| `type` → tighten to `text({ enum: LOCATION_TYPES })` + CHECK | `LOCATION_TYPES = ['store','warehouse','bonded','distribution_center','fulfillment_center','in_transit','zone','aisle','rack','shelf','bin']` — the **kind** of node. |
| `is_sellable` boolean (default true) | sales/POS phases auto-exclude non-sellable stock. |
| `is_quarantine` boolean (default false) | damaged/hold stock — not sellable. |
| `is_bonded` boolean (default false) | duty-unpaid bonded stock — not sellable until released. |
| `is_transit` boolean (default false) | in-transit virtual node — not sellable. |
| `max_weight` / `max_volume` (nullable bigint, with unit/scale) | **bin capacity SEAM** — reserved for future WMS routing; **no routing logic now**. |

- **Flags drive behaviour, `type` describes the node.** A bonded warehouse = `type='bonded'`, `is_bonded=true`, `is_sellable=false`. In-transit = `type='in_transit'`, `is_transit=true`, `is_sellable=false`. Quarantine bin = `type='bin'`, `is_quarantine=true`, `is_sellable=false`. POS/Sales (Phase 4+) filter `is_sellable=true` to auto-exclude damaged / in-transit / duty-unpaid stock.
- `company_id` is set on **top-level** nodes; sub-nodes inherit company via the tree (and carry `company_id` denormalized for query simplicity + the intra-company transfer check). A CHECK ensures a node's `company_id` matches its parent's.

### Stock grain stays at the stock-holding node (frozen costing untouched) — OPEN decision
- `stock_ledger.location_id`, `avg_cost`, `valuation_layer` are **SKU×location** (frozen). Phase 3 keeps stock posted at the **stock-holding node** (the store/warehouse/bonded top-level), so the costing grain is unchanged. Bins/zones are addressing + capacity seams; a nullable `stock_ledger.bin_location_id` (composite FK → location) is **reserved** for the future WMS phase that makes stock bin-grained.
- **OPEN decision:** post stock at stock-holding-node grain now (recommended — zero frozen-costing change) vs bin-grained stock now (would change the SKU×location costing grain → larger, frozen-touching pass).

---

## §B — Two-step transfers (quantity + value), intra-company only

### Tables (tenant-owned; composite FKs at birth; RLS in same migration)
| Table | Purpose | Key composite FKs |
|---|---|---|
| `stock_transfer` | transfer header: source, destination, in-transit node, status, date seams | `(tenant_id, source_location_id)`, `(tenant_id, dest_location_id)`, `(tenant_id, in_transit_location_id)` → location |
| `stock_transfer_line` | per-SKU qty + carried value | `(tenant_id, transfer_id)` → stock_transfer; `(tenant_id, sku_id)` → sku; `(tenant_id, product_id)` → product |

- **Date seams on the header:** `shipped_at`, `expected_receipt_date`, `actual_receipt_date` (nullable) — reserved for ETA/aging without building scheduling now.
- **Status** = `draft | dispatched | received | cancelled` (`text` enum + CHECK).

### INTRA-COMPANY ONLY (blocked: inter-company)
- `source_location` and `dest_location` **must share `company_id`** — enforced in `transfer.ts` (reject `CONFLICT`) **and** as a DB CHECK where feasible. Inter-company transfers need due-to/due-from GL (Phase 5) — **blocked** until then. Documented, not silently allowed.

### Two-step flow (no ledger orphans)
- **Dispatch (leg 1):** `transfer_out` issue at source (−q) → in-transit node receives (+q). Status → `dispatched`; `shipped_at` set.
- **Receive (leg 2):** in-transit issue (−q) → destination receipt (+q). Status → `received`; `actual_receipt_date` set.
- In-transit is a **virtual `is_transit` location** (per company), so stock leaving source is never double-counted as available at destination, and is never orphaned (it always lives in *some* node's ledger). Cancel/return-to-source path for in-transit that never arrives (audited).
- All legs go through `appendStockMovement` (the sole ledger mutator) in **one tenant tx** → idempotent, conserved.

---

## §C — TRANSFER VALUE CONSERVATION (the one reach into frozen costing)

**Setup (verified):** costing is **SKU×location**; method resolves **product→category→tenant (NOT location)** ⇒ a SKU is AVCO-everywhere or FIFO-everywhere ⇒ **transfers are never mixed-method**.

**Value must move with quantity, at the source's cost basis, conserving TOTAL value** (distinct from bond-release duty, §D, which adds value *on purpose*):
1. **Issue at source** — existing `applyValuation` issue path returns `cogsMinor = V`, the **exact integer value** leaving source (AVCO proportional, or FIFO exact layer-sum).
2. **Receive at destination at exactly `V`:**
   - **AVCO — reuse existing seams, NO frozen-costing change (recommended):** destination receipt at `unitCost = floor(V/q)` (adds `floor(V/q)·q`), then a **value-only `valuation_adjustment`** (`qty_delta=0`, `value_delta = V − floor(V/q)·q`) for the penny remainder. Net `+V`, exact. Both are existing seams (`applyAvcoReceipt` + `applyAvcoValueOnly`); the value-only guard `qty_on_hand>0` holds because the receipt ran first.
   - **FIFO — an ADDITIVE costing primitive, AGGREGATE layer (LOCKED §I.2):** the destination receives a single **aggregate** `valuation_layer` carrying exactly `V` (`qty_remaining = q`, total value `V`) — NOT layer-preserving (expiry/age is carried by the **lot** dimension, not the FIFO layer, so cross-transfer layer-age is unnecessary). Implemented as an **additive** `transfer_in` branch in `costing.ts`; existing receipt/issue/adjust/value-only behaviour is untouched. **This is the only place a plain transfer touches frozen `costing.ts`.** **HARD GATE:** the existing Phase-2 costing suites must pass **UNCHANGED** — if adding this branch requires editing an existing costing test, it is NOT additive → STOP and flag.

**Frozen-costing impact — flagged explicitly:**
- **AVCO transfers: zero frozen change** (reuse receipt + value-only seams).
- **FIFO transfers: one ADDITIVE primitive** in `costing.ts` (new branch; existing receipt/issue/adjust/value-only behaviour unchanged). **LOCKED (§I.2): Phase-3 additive, aggregate layer** — value-conservation-tested, earns a line-by-line read; the existing costing suites must pass **unchanged** (the additivity proof).
- Because we carry the **exact integer `V`**, value-conservation does **not** depend on #6 rounding.

**Planned DB-gated test (value conservation):** receive at A to set a known cost; transfer `q` to B; assert `value_A(before) − value_A(after) == value_B(after) − value_B(before) == V`, and `Σ value` (and `Σ qty`) over {A, in-transit, B} unchanged at **each** step (dispatch and receive). Run for an AVCO SKU and a FIFO SKU.

---

## §D — Bonded inventory, bond release, and the duty cost-basis link

- **Bonded vs released = location separation.** Bonded stock lives in a `type='bonded'`, `is_bonded=true`, `is_sellable=false` location; it never counts as sellable. Released stock lives in a normal sellable location.
- **Bond receiving:** `bond_receipt` / `bond_receipt_line` — an import batch received into a bonded location (a normal receipt at a bonded node). Carries generic `customs_reference` + `landed_cost_reference` seams (below).
- **Bond release = an approved bond-to-store transfer** (reuses §B/§C machinery): bonded location → released location, value conserved.
- **DUTY/TAX on release reuses the value-only `valuation_adjustment` seam (no new costing machinery):** after the release transfer lands the stock at the released location, a **value-only `valuation_adjustment`** (`qty_delta=0`, `value_delta = duty + taxes`) **adds the duty/tax to the cost basis** at the released location. This is the existing AVCO value-only path — duty is a real added cost, intentionally *not* conserved (distinct from the transfer in §C). 
  - **Bonded = AVCO-only in Phase 3 (LOCKED §I.4):** value-only is AVCO-only today, so **bonded stock is restricted to AVCO-costed SKUs** — duty-on-release works via the existing seam with zero new costing machinery. We do **not** build a FIFO value-only path speculatively; the AVCO-only-bonded limitation is documented, and a FIFO-bonded need later is a clean change-request. (Enforced: bond-receipt rejects a SKU whose resolved costing method is FIFO.)
- **Approval seam (INV-4):** `bond_release` carries request → approval (`bond.release` / `bond.approve_release` entitlements). **OPEN decision:** RBAC-gated immediate release vs a request→approve workflow row.

### Customs / landed-cost seams — generic, jurisdiction-agnostic
- `customs_reference` (generic: a reference string/number + free-form `customs_document` link) and `landed_cost_reference` — **NOT** hardcoded GRA/Guyana fields. Reserve **nullable generic** columns now; a jurisdiction-specific field is added later only if cheap-to-add-later proves false. **Landed-cost ALLOCATION behaviour is NOT built** (Phase 6) — references only.

---

## §E — Per-invariant ownership + the standing gate (built in, not post-hoc)

Per the recognized class (lessons-learned, "correct component but a write path routes around it" — Gap B / H1 / #8): each invariant names its **owner service**, the **write path that must INVOKE it**, and the **gate test** — designed in from commit 1, not added in review.

| Invariant | Owner service | Write path must invoke | Gate |
|---|---|---|---|
| Transfer **qty** conservation | `transfer.ts::executeTransfer` (both legs via `appendStockMovement`, one tx) | `transfer` router | DB test: `Σ qty` over {src, in-transit, dest} unchanged; idempotent replay = one effect. |
| Transfer **value** conservation | `transfer.ts` calling `applyValuation` (both legs) + the exact-`V` mechanism (§C) | `transfer` router | **#8-class grep**: transfer path invokes valuation on both legs; value-conservation DB test. |
| Bonded ≠ released separation | location-flag model + `bond.ts` | bond-receipt + release routers | DB test: bonded stock excluded from sellable/available; release moves it out of the bonded node. |
| Bond-release authorization | `bond.ts` release path + entitlements | release router | DB test: unauthorized release rejected + audited. |
| Duty cost-basis add | `bond.ts` invoking the value-only `valuation_adjustment` seam | release router | DB test: released cost basis increases by exactly `duty+tax`; qty unchanged; qty=0⟺value=0 preserved. |
| Tenant-FK safety | DB composite FKs (#5) + router `assert*Visible` | all mutations | composite FKs present; extended H1 harness. |

---

## §F — Proposed commit sequence (ONE pass — see §G)

Single branch `phase-3-locations-warehouses-bonds`, one PR, commits grouped by deliverable:
0. **Parked debt:** #5 `UNIQUE(tenant_id,id)` on `company/location/product/sku/lot` + #7 set-once DB-trigger (expand-only; no behaviour change). ← recommended first commit.
1. **Location model:** self-referential `parent_location_id` (composite FK) + `type` enum/CHECK + flags (`is_sellable/is_quarantine/is_bonded/is_transit`) + capacity seam (`max_weight/max_volume`). RLS unchanged (existing table) but the new columns + coverage gate re-checked.
2. **Transfer model + qty conservation:** transfer movement types, `stock_transfer`/`stock_transfer_line`, in-transit virtual node, intra-company guard, date seams, `transfer.ts::executeTransfer` + RLS + events + INV qty test.
3. **Transfer VALUE conservation:** AVCO seam-reuse path + the FIFO additive primitive + value-conservation DB test. **← line-by-line human read + the single mid-pass owner checkpoint (§G).**
4. **Bonded receiving + separation:** `bond_receipt`/`bond_receipt_line` + bonded-location handling + customs/landed-cost reference seams + INV-separation + RLS + events.
5. **Bond release + duty link + approval seam:** `bond_release`, release-as-transfer, value-only duty adjustment, approval/entitlement seam + events.
6. **RBAC + robust seed + API contracts:** new entitlements enforced in-tx; rich seed (multi-location tenant, a bonded location, a warehouse with a nested bin tree, an in-flight + a completed transfer, a bond receipt + release with duty); `phase-3-api-contracts.md`.
7. **§45 reassessment + ADRs:** ADR for the transfer-valuation model, ADR for the unified location tree + flags, ADR for composite-FK/#7 adoption.

Per-commit loop unchanged: gates + real-Postgres DB-gated → Codex adversarial review (CRITICAL/HIGH) → fix → commit → push → PR update → lessons + PROGRESS.

## §G — ONE pass vs split (justification)
**Proposed: ONE implementation pass.** Phase 2 fractaled because it was the **financial core** (wrong-money stakes). Phase 3 is **structural work over a now-proven spine** (RLS, ledger, costing all shipped + tested) and should not inherit that cadence. The single genuine financial reach is the **FIFO transfer-value primitive** (§C, commit 3). Keep ONE PR but place a **single risk-justified owner checkpoint after commit 3** (value conservation) — the one place touching frozen financial code — for a line-by-line read before bond logic. Checkpoint matched to a real risk, not habit.

## §H — Recommended FIRST implementation commit
**Commit 0 — parked debt (#5 + #7), expand-only:** add `UNIQUE(tenant_id, id)` to `company/location/product/sku/lot`; add the set-once costing-method DB-trigger. No behaviour change; coverage gate + existing suites stay green; verified by applying the migration in a disposable PG18 and re-running DB-gated tests + a new "raw costing-method UPDATE rejected after movement" test. Rationale: lowest-risk, fully additive; it hardens the spine, kills the H1 + set-once classes at the DB layer, and **unblocks composite FKs for every later Phase-3 table** — the ideal proof the pass is on rails before any new table or the costing touch.

## §I — Decisions LOCKED (owner directive, 2026-06-22)
All six recommended defaults approved; the bonded-FIFO call made explicit. These are now settled — do not re-litigate.
1. **Stock grain → stock-holding-node.** Stock stays SKU×location; NO bin grain. Preserves the frozen SKU×location costing grain.
2. **FIFO transfer / frozen touch → Phase-3 ADDITIVE, AGGREGATE destination layer.** The `transfer_in` primitive in `costing.ts` is additive (NOT a Phase-2 change-request); the destination receives a single **aggregate** layer carrying exactly `V` (NOT layer-preserving) — expiry/age is carried by the **lot** dimension, not the FIFO layer, so cross-transfer layer-age is unnecessary. **HARD GATE:** the existing Phase-2 costing suites MUST pass **UNCHANGED** after adding the transfer path; **if adding it requires editing an existing costing test, it is NOT additive → STOP and flag.**
3. **In-transit → value flows through the virtual `is_transit` location node.** In-flight stock stays in the balance-per-`(location, sku)` model; NO escrow-on-line.
4. **Bond-release → RBAC-immediate** (gated behind `bond.release` / `bond.approve_release`), with the request→approve **workflow fields RESERVED nullable** on the `bond_released` event (and the `bond_release` row) so the §22 approval workflow binds additively later (same pattern as `approvedBy: null`). **Bonded stock is RESTRICTED to AVCO-costed SKUs in Phase 3** — do NOT build a FIFO value-only path speculatively; the AVCO-only-bonded limitation is documented, and a FIFO-bonded need later is a clean change-request.
5. **Bins → structure + capacity seam ONLY.** Bins are hierarchy nodes with reserved nullable `max_weight`/`max_volume`; NO bin-level stock balances (would change the costing grain — see #1).
6. **Transfer oversell → HARD-BLOCK at source**, regardless of the D5 sale-oversell policy (D5 is for customer sales; you cannot ship internal stock you don't have).
