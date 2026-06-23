# Locations, Warehouses & Bonded Warehouses — Module Specification (Phase 3)

- Status: **Draft (planning — no implementation)**. Entry criteria for Phase-3 build per §42; exit criteria = §35 Definition of Done.
- Charter refs: §8 (platform/tenant/company/location model), §18 (warehouse/zone/bin, bonded warehouse, transfers, in-transit, procurement seams), §12 (Caribbean/dev-market: bonded warehouses, customs, landed cost), §9 (deployment/RLS), §25 (audit), §24 (events/outbox), §33/§35/§39 (engineering rules / DoD / AI safety).
- Companion docs: `phase-3-implementation-plan.md` (build order), `phase-3-gap-analysis.md` (findings), `event-map-phase3.md` (event contracts), `competitive/locations-warehouses-bonds.md` (§41 parity).
- Builds on (FROZEN Phase-2 spine): `module-specs/inventory.md`, ADR-0006 (RLS role model), ADR-0007 (costing), ADR-0008 (settings resolver). **Phase 3 extends the spine; it does not rebuild it and does not silently change frozen Phase-2 schema/costing.**

> **Scope:** company/location refinement, location typing (store / warehouse / bonded / DC / fulfillment), warehouse internal structure (zone → aisle → rack → shelf → bin), the stock-location model, transfer-out / transfer-in with **in-transit** inventory, **bonded vs released** separation, bond receiving, the bond-release **approval seam**, bond-to-store transfer, and the customs/landed-cost **reference seams** (NO landed-cost allocation behaviour). **Out of scope:** POS/offline (Phase 4), GL/accounting postings (Phase 5), procurement & landed-cost **allocation** (Phase 6), ecommerce (Phase 8), any UI. No POS, no GL, no ecommerce, no offline-queue work.

---

## 1. Vision & personas
A multi-branch Caribbean retailer/wholesaler/importer runs stores, warehouses, distribution centres, and **customs-bonded warehouses**. They must move stock between locations without losing or double-counting quantity **or value**, hold imported goods in bond until duty is cleared, and release bonded stock to stores under control. RetailOS must make all of this a **ledger-true, tenant-isolated, audited** extension of the Phase-2 inventory engine.

Personas: warehouse manager (transfers, putaway, counts), store manager (receives transfers), bond/customs officer (bond receiving, release requests), finance/compliance (bond-release approval, audit), platform/MSP (residency/health). Cashier/POS personas are **Phase 4** — not here.

## 2. User stories (P0 unless noted)
- As a warehouse manager I can **transfer** stock from warehouse A to store B, and the system deducts from A and adds to B exactly once, moving the **cost basis** with it.
- As a warehouse manager I can see stock that has **left A but not yet arrived at B** (in-transit) so I never over-promise.
- As a bond officer I can **receive an import batch into a bonded location** so the goods are tracked but held as **bonded (not released)** stock.
- As a bond officer I can **request release** of bonded stock; as finance I can **approve** it; on approval the stock becomes **released** (bond-to-store transfer).
- As a warehouse manager I can model my warehouse's internal structure (**zones / aisles / racks / shelves / bins**) so locations within a warehouse are addressable.
- As compliance I can attach **customs references/documents** to a bond receipt (reference seam — no OCR). (P1)
- As finance I can see **landed-cost references** linked to a bond receipt, with allocation deferred to procurement. (P1, seam-only)
- As any actor, every transfer, bond receipt, and bond release is **audited** and emits a **domain event**.

## 3. Business rules & invariants (each names its OWNER service + the standing gate)
> Per the recognized defect class (lessons-learned, "correct component but a write path routes around it" — Gap B / H1 / #8): for **every** invariant below, the **primary write path must INVOKE the owning service**, proven by a grep + a DB-gated test. A green service unit test is NOT evidence the write path uses it.

| # | Invariant | Owner service | Write path that MUST invoke it | Standing-gate proof |
|---|---|---|---|---|
| INV-1 | **Transfer quantity conservation** — a transfer of q moves exactly −q at source, +q at destination (and through in-transit); no qty created/destroyed. | `transfer.ts` (executes both legs through `appendStockMovement` in ONE tenant tx) | `transfer` router → `executeTransfer` | DB test: `SUM(qty_delta)` across A+in-transit+B unchanged; one deduction even on idempotent replay. |
| INV-2 | **Transfer value conservation** — value released at source == value received at destination; total value across locations unchanged (no value created/destroyed in transit). | `transfer.ts` calling `applyValuation` (costing engine) on BOTH legs, injecting the **exact released integer value** into the receive leg. | `transfer` router → `executeTransfer` → `applyValuation` (both legs) | DB test: `ΔvalueA == −ΔvalueB == V`; total value conserved; **this is the #8-class check** — the transfer path must not skip `applyValuation` the way POS did. |
| INV-3 | **Bonded ≠ released separation** — bonded stock is never counted as sellable/released; it lives in a `bonded` location and only becomes released via an approved bond-to-store transfer. | location-type model + `bond.ts` | bond-receipt + bond-release routers | DB test: bonded stock excluded from released/available views; release moves it out of the bonded location. |
| INV-4 | **Bond-release authorization** — releasing bonded stock requires the `bond.release`/`bond.approve_release` entitlement (and, per owner decision, an approval seam). | `bond.ts` (release path) + entitlements | bond-release router → auth/approval seam | DB test: unauthorized release rejected; release is audited with actor. |
| INV-5 | **Tenant-scoped FK safety (composite-FK)** — every Phase-3 FK carries `tenant_id`; a cross-tenant reference is impossible at the **DB layer**, not just guarded in the router. | DB constraints (composite FKs) + router `assert*Visible` (belt-and-braces) | all Phase-3 mutations | coverage: new tables use `FK (tenant_id, x_id) → x(tenant_id, id)`; referenced tables have `UNIQUE(tenant_id, id)`; H1 parameterized harness extended to Phase-3 inputs. |
| INV-6 | **No hard deletes / soft-delete** for operational rows; **RLS fail-closed** on every new tenant-owned table (ENABLE+FORCE+`tenant_isolation`). | migrations + `withTenant` | all | `tenant-isolation-coverage` gate fails if any new table is uncovered; unset-GUC ⇒ zero rows. |

## 4. Permissions (charter §7 — extends the entitlements model)
New entitlements (RBAC): `warehouse.manage_structure` (zones/bins), `inventory.transfer` (create/dispatch transfers), `inventory.transfer_receive`, `bond.receive`, `bond.release`, `bond.approve_release`. Cashiers get none of these by default; warehouse roles get transfer/structure; bond/finance get bond.* per the approval seam. All enforced inside the tenant tx (same pattern as Phase 2).

## 5. Tenant isolation, audit, events
- Every new table is tenant-owned ⇒ `tenant_id` + ENABLE+FORCE+`tenant_isolation` RLS in the same migration (charter rule; coverage gate enforces).
- Every mutation audited (`recordAudit`) and emits the relevant domain event (`event-map-phase3.md`) in the same tx (transactional outbox).
- Server time authoritative; `occurredAt` injected by `emitEvent`.

## 6. Edge cases & error states
- Transfer to the same location → reject. Transfer of more than on-hand at source → governed by the existing oversell policy (D5) at the source location (transfers are issues at source); recommend **hard-block for transfers** regardless of sale oversell policy (you cannot ship stock you do not have) — **owner decision**.
- In-transit never received (lost/cancelled) → an explicit cancel/return-to-source path (audited); in-transit stock is visible until resolved.
- Bond release of more than bonded qty → reject. Release without approval → reject (INV-4).
- Bin referenced from another tenant / wrong warehouse → composite-FK + `assertVisible` reject (INV-5).
- Value-conservation rounding: by moving the **exact integer released value** (not `unitCost × qty`), no division/rounding occurs, so #6 precision is **not** on the value-conservation path (documented in the plan).

## 7. Deferred / explicitly NOT Phase 3 (separated from scope)
- Landed-cost **allocation** (freight/duty/insurance → unit cost) → **Phase 6**; Phase 3 reserves references only.
- Customs-document **OCR / AI extraction** (§18 seam) → later, behind the provider interface.
- **Bin-level stock balances / directed putaway / wave picking** → later refinement; Phase 3 ships the bin **structure model**, not bin-grained ledger/costing (which would change the frozen SKU×location costing grain).
- Duty/VAT **estimation + clearance state machine** beyond bonded↔released → later (Phase 5 tax / Phase 6 procurement).
- GL postings for transfers/bond moves → **Phase 5** (events are the seam).
- POS/offline transfer entry, Tauri, mobile scanning → **Phase 4+**.

## 8. Definition of Done (per §35) — Phase 3 exit criteria
Types pass; `check`/`check-types`/`test` green; **DB-gated** RLS + service + transfer value/qty-conservation + bond separation/authorization tests pass against real Postgres as `retailos_app`; coverage gate green (all new tenant tables covered); H1 harness extended to all new FK inputs; audit + events verified emitted by the **write path** (not just the service); money in minor units; docs updated (this spec, ADR(s), event map, API contracts). Each §3 invariant has a passing write-path-invokes-service test.
