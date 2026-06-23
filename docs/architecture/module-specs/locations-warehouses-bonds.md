# Locations, Warehouses & Bonded Warehouses — Module Specification (Phase 3)

- Status: **Draft (planning — no implementation)**. Entry criteria per §42; exit = §35 Definition of Done.
- Charter refs: §8 (tenant/company/location), §18 (warehouse/zone/bin, bonded, transfers, in-transit, procurement seams), §12 (Caribbean: bonded/customs/landed cost), §9 (RLS), §24 (events), §25 (audit), §33/§35/§39.
- Companions: `phase-3-implementation-plan.md`, `phase-3-gap-analysis.md`, `event-map-phase3.md`, `competitive/locations-warehouses-bonds.md`.
- Builds on FROZEN Phase 2: `module-specs/inventory.md`, ADR-0006 (RLS), ADR-0007 (costing), ADR-0008 (settings/value-only seam). **Extends the spine; does not rebuild or silently change frozen schema/costing.**

> **Scope:** parked-debt paydown (#5 composite-FK, #7 set-once trigger); a **unified self-referential location tree** (Warehouse→Zone→Aisle→Bin via `parent_location_id`) with **behaviour flags** (`is_sellable/is_quarantine/is_bonded/is_transit`) and a **bin capacity seam** (`max_weight/max_volume`); typed locations (store/warehouse/bonded/DC/fulfillment/in_transit); **two-step intra-company transfers** (in-transit, qty+value conserved, date seams); **bonded vs released** separation; bond receiving; bond-release **approval seam**; **duty/tax on release via the existing value-only `valuation_adjustment` seam**; **generic** customs/landed-cost **reference** seams (no allocation). **Out of scope:** POS/offline (P4), GL (P5), procurement/landed-cost **allocation** (P6), ecommerce (P8), UI, inter-company transfers (need due-to/due-from GL — P5).

---

## 1. Vision & personas
A multi-branch Caribbean retailer/wholesaler/importer runs stores, warehouses, DCs, and **customs-bonded warehouses**, moves stock between locations of the **same company** without losing/double-counting quantity **or value**, holds imports in bond until duty clears, and releases bonded stock under control with duty added to cost. RetailOS makes this a ledger-true, tenant-isolated, audited extension of the Phase-2 engine. Personas: warehouse manager, store manager, bond/customs officer, finance/compliance, platform/MSP. (Cashier/POS = Phase 4.)

## 2. User stories (P0 unless noted)
- Transfer stock from warehouse A to store B **in the same company**, deducting from A and adding to B exactly once, moving the **cost basis** with it.
- See stock that has **left A but not yet arrived at B** (in-transit) so I never over-promise.
- Model a warehouse's internal structure as a **nested tree** (zones → aisles → bins, any depth).
- Mark a location/bin **non-sellable** (quarantine/damaged/in-transit/bonded) so sales auto-exclude it.
- **Receive an import batch into a bonded location** (tracked, held as bonded — not sellable).
- **Request** bond release; **approve** it (finance); on approval the stock becomes **released** and **duty/tax is added to its cost basis**.
- Attach **generic customs references/documents** to a bond receipt (P1; no OCR).
- Every transfer / bond receipt / release is **audited** and emits a **domain event**.

## 3. Business rules & invariants (each names its OWNER service + the standing gate)
> Recognized class (lessons-learned, "correct component but a write path routes around it" — Gap B / H1 / #8): for **every** invariant, the **primary write path must INVOKE the owning service**, proven by a grep + a DB-gated test. A green service unit test is NOT evidence the write path uses it.

| # | Invariant | Owner service | Write path that MUST invoke it | Standing-gate proof |
|---|---|---|---|---|
| INV-1 | **Transfer qty conservation** — −q at source, +q at destination (through in-transit); no qty created/destroyed. | `transfer.ts::executeTransfer` (both legs via `appendStockMovement`, one tx) | `transfer` router | DB test: `Σ qty` over {src, in-transit, dest} unchanged; idempotent replay = one effect. |
| INV-2 | **Transfer VALUE conservation** — value released at source == value received at destination; total value across locations unchanged (no value created/destroyed in transit). | `transfer.ts` calling `applyValuation` on BOTH legs + the exact-`V` mechanism (plan §C) | `transfer` router → valuation both legs | **#8-class grep** + value-conservation DB test (`Δvalue_A = −Δvalue_B = V`). |
| INV-3 | **Bonded ≠ released / sellable separation** — bonded stock never counts as sellable; `is_sellable=false` for bonded/quarantine/transit; release moves it to a sellable node. | location-flag model + `bond.ts` | bond-receipt + release routers | DB test: bonded/non-sellable excluded from available; release moves stock out of the bonded node. |
| INV-4 | **Bond-release authorization** — release requires `bond.release`/`bond.approve_release`. | `bond.ts` (release path) + entitlements | release router → auth/approval seam | DB test: unauthorized release rejected + audited. |
| INV-5 | **Duty cost-basis add (intentional value-add, NOT conservation)** — on release, duty/tax is added to the released cost basis via the value-only `valuation_adjustment` seam (qty unchanged). | `bond.ts` invoking the existing value-only path | release router | DB test: released `total_value_minor` += exactly `duty+tax`; qty unchanged; qty=0⟺value=0 preserved. |
| INV-6 | **Intra-company only** — a transfer's source & dest share `company_id`; inter-company blocked. | `transfer.ts` (+ DB CHECK where feasible) | `transfer` router | DB test: cross-company transfer rejected (`CONFLICT`). |
| INV-7 | **Tenant-FK safety (composite-FK #5)** — cross-tenant references impossible at the DB layer. | DB composite FKs + router `assert*Visible` | all Phase-3 mutations | new tables use `FK (tenant_id, x_id)`; referenced tables have `UNIQUE(tenant_id, id)`; extended H1 harness. |
| INV-8 | **Set-once costing method (DB backstop #7)** — `costing_method` immutable once ledger rows exist, at the DB layer. | DB trigger + app `assertCostingMethodSetOnce` | all costing-method writes | DB test: raw UPDATE rejected after a movement. |
| INV-9 | **RLS fail-closed / soft-delete** on every new tenant table (ENABLE+FORCE+`tenant_isolation`). | migrations + `withTenant` | all | coverage gate; unset-GUC ⇒ zero rows. |

## 4. Permissions (charter §7)
New entitlements: `warehouse.manage_structure`, `inventory.transfer`, `inventory.transfer_receive`, `bond.receive`, `bond.release`, `bond.approve_release`. Cashiers get none by default; warehouse roles get transfer/structure; bond/finance get bond.* per the approval seam. Enforced in-tx (Phase-2 pattern).

## 5. Tenant isolation, audit, events
Every new table is tenant-owned ⇒ `tenant_id` + ENABLE+FORCE+`tenant_isolation` in the same migration (coverage gate enforces). Every mutation audited + emits its event (`event-map-phase3.md`) in the same tx. Server time authoritative; `occurredAt` injected by `emitEvent`.

## 6. Edge cases & error states
- Transfer to same location → reject. **Inter-company transfer → reject** (INV-6). Transfer > on-hand at source → recommend **hard-block** (you can't ship stock you don't have), regardless of D5 sale-oversell — **owner decision**.
- In-transit never received → explicit cancel/return-to-source (audited); in-transit stock visible until resolved.
- Bond release > bonded qty → reject. Release without approval → reject (INV-4). **Bonded FIFO SKU** → value-only duty add is AVCO-only today; restrict bonded to AVCO or implement FIFO value-only (owner decision).
- Cross-tenant / wrong-parent location reference → composite-FK + `assertVisible` reject (INV-7); a node's `company_id` must match its parent's (CHECK).
- Value-conservation rounding: AVCO transfers carry exact `V` via receipt + value-only remainder (no rounding); FIFO transfers use the additive layer-exact primitive (plan §C).

## 7. Deferred / explicitly NOT Phase 3
- Landed-cost **allocation** (freight/duty/insurance → unit cost apportionment) → **Phase 6**; Phase 3 reserves generic references only.
- **Inter-company transfers** (due-to/due-from GL) → **Phase 5**.
- Customs-document **OCR/AI** (§18 seam) → later, behind the provider interface.
- **Bin-level stock balances / directed putaway / wave picking / WMS routing** (incl. the `max_weight/max_volume` capacity logic) → later refinement; Phase 3 ships the tree + capacity **seam**, not bin-grained ledger/costing.
- Duty/VAT **estimation + clearance state machine** beyond bonded↔released + the duty cost add → later (P5 tax / P6 procurement).
- GL postings → **Phase 5** (events are the seam). POS/offline/Tauri/mobile → **P4+**.

## 8. Definition of Done (§35) — Phase 3 exit
Types pass; `check`/`check-types`/`test` green; **DB-gated** RLS + service + transfer qty/value-conservation + bonded separation + duty-add + intra-company + set-once-trigger tests pass against real Postgres as `retailos_app`; coverage gate green (all new tenant tables covered); H1 harness extended to all new FK inputs; audit + events verified emitted by the **write path** (not just the service); money in minor units; docs + ADRs updated. Each §3 invariant has a passing write-path-invokes-service test.
