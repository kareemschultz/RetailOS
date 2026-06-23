# Phase 3 — Gap Analysis (Locations / Warehouses / Bonds / Transfers / Bins)

- Status: **Planning — no code.** Verified against the schema/services on master `eabf98e` (Phase 2 complete).
- Method: read the actual schema (`packages/db/src/schema/*`), services (`costing.ts`, `stock-ledger.ts`, `inventory.ts`), migrations (0000–0011), RLS (`tenant.ts`, `tenant-isolation-coverage.test.ts`), routers (`vs1.ts` `assert*Visible`). Findings are what's **on disk today**.

## A. What already exists (the spine Phase 3 builds on)
- **`company` + `location`** (uuid PKs; `tenant_id` text). `location.companyId` FK → `company.id`; `location.type` = **bare `text` default `"store"`** (valid set only in a comment); `location.removalStrategy` already location-level.
- **`stock_ledger`** is the append-only sole mutator: `location_id`/`product_id` NOT NULL FKs, `sku_id`/`lot_id`/`serial_id` nullable FKs, `movement_type` text, `qty_delta`/`balance_after` bigint, cost columns, `value_delta_minor`, `costing_method_applied`, `source_movement_id`, `ref_type`/`ref_id`, `idempotency_key`. `appendStockMovement` advisory-locks `(tenant:location:cell)`; `balance_after = SUM(qty_delta)` per `(location, sku|product)`.
- **Costing is SKU×location:** `avg_cost` unique `(tenant, sku, location)` + invariant `qty_on_hand<>0 OR total_value_minor=0`; `valuation_layer` per `(tenant, sku, location, received_at, seq)`. Method resolves **product→category→tenant (NOT location)** ⇒ a SKU is AVCO-everywhere or FIFO-everywhere ⇒ **transfers are never mixed-method**.
- **Value-only seam exists:** `applyAvcoValueOnly` handles `movement_type='valuation_adjustment'` (`qty_delta=0`, value>0), updating `total_value_minor` only, with a `qty_on_hand>0` guard. **FIFO value-only is REJECTED today** (parked OPEN decision). ← this is the exact seam bond-release duty reuses.
- **RLS** fail-closed via `withTenant` + ENABLE/FORCE/`tenant_isolation`; coverage gate blocks any uncovered tenant table.
- **Cross-tenant FK guard** = router `assert*Visible` RLS-scoped reads. **Set-once** = app-only `assertCostingMethodSetOnce`. **Outbox** `emitEvent` injects `occurredAt`. Next migration = **0012**.

## B. GAPS — findings first

### G0 — Parked Phase-2 debt with a Phase-3 home, unpaid
- **#5 — NO composite `(tenant_id,id)` FKs and NO `unique(tenant_id,id)` anywhere.** Cross-tenant safety is router-only ⇒ the **H1 class lives at the DB layer**. Phase-3 tables must be born composite; referenced tables (`company/location/product/sku/lot`) need `UNIQUE(tenant_id,id)` (expand-only). **Pay first** (plan §0).
- **#7 — set-once costing-method enforced app-only.** A raw service UPDATE bypasses `assertCostingMethodSetOnce`. Needs a **DB trigger** backstop (reject `costing_method` UPDATE when `stock_ledger` rows exist). **Pay first** (plan §0).

### G1 — `location.type` unconstrained; no hierarchy; no behaviour flags
Bare `text` (any string insertable); no `parent_location_id` (can't nest Warehouse→Zone→Aisle→Bin); no `is_sellable/is_quarantine/is_bonded/is_transit` flags ⇒ sales/POS can't auto-exclude non-sellable stock; no bin capacity seam. **Gap:** tighten `type` to enum+CHECK; add a **self-referential `parent_location_id`** (one unified tree, composite FK); add the four **flags**; add nullable **`max_weight`/`max_volume`** capacity seam (reserved, no routing).

### G2 — no transfer movement types / transfer model / in-transit
`movement_type` enum = `adjustment|receipt|sale|valuation_adjustment|return` — **no `transfer_out`/`transfer_in`**, no transfer header/line, no in-transit node, no `shipped_at/expected/actual` date seams, no intra-company guard. **Gap:** add transfer types + `stock_transfer`/`stock_transfer_line` + in-transit virtual location + intra-company-only enforcement. Transfers reuse `appendStockMovement` (two legs).

### G3 — no way to move VALUE on a transfer, and the AVCO path can reuse existing seams
The receipt path computes value as `unitCost×qty`, so injecting `floor(V/q)` loses pennies. **But:** the AVCO value-only seam already exists, so an **AVCO transfer can conserve value exactly with NO frozen-costing change** (receipt at `floor(V/q)` + value-only remainder of `V−floor(V/q)·q`). **FIFO** still needs an **additive** `transfer_in` primitive (FIFO value-only is rejected). **Gap:** the FIFO transfer path is the *only* plain-transfer reach into frozen `costing.ts` (owner decision — Phase-3 additive vs Phase-2 change-request).

### G4 — no bonded↔released separation, and duty-on-release has a ready seam
No bonded concept today. **Gap:** model bonded as a **location flag/type** (separation = location separation); bond release = approved bond-to-store **transfer**; **duty/tax on release reuses the existing AVCO value-only `valuation_adjustment` seam** (qty_delta=0, value>0) — no new costing machinery. **FIFO caveat:** value-only is AVCO-only ⇒ bonded FIFO needs FIFO value-only or a bonded-AVCO restriction (owner decision).

### G5 — no bond receive/release/approval, no generic customs seam
**Gap:** `bond_receipt`/`bond_receipt_line`, `bond_release` with an approval seam (RBAC `bond.release`/`bond.approve_release`), and **generic jurisdiction-agnostic** `customs_reference`/`customs_document` + `landed_cost_reference` columns (references only; **no allocation** — Phase 6). NOT hardcoded GRA/Guyana.

### G6 — entitlements don't cover warehouse/bond actions
**Gap:** add `warehouse.manage_structure`, `inventory.transfer`, `inventory.transfer_receive`, `bond.receive`, `bond.release`, `bond.approve_release`; enforce in-tx.

## C. Cross-cutting risks (from Phase 2)
- **#8-class on transfers:** the transfer write path could append ledger movements **without** calling `applyValuation` (the POS↔costing bug). INV value-conservation + a write-path-invokes-service grep + the conservation test are mandatory **from commit 1**.
- **Frozen-file touch:** only the **FIFO** transfer path touches `costing.ts` (additive); AVCO transfers and duty-on-release reuse existing seams. Flag, don't assume.
- **#6 precision:** not on the value path (we carry exact integers).
- **Stock grain:** keeping stock at the stock-holding node (not bin) preserves the frozen SKU×location costing grain; bin-grained stock would be a frozen-touching enlargement (open decision).

## D. Decisions LOCKED (owner directive, 2026-06-22)
All six approved (recommended defaults + explicit bonded-FIFO call); see `phase-3-implementation-plan.md` §I:
1. **Stock grain → stock-holding-node** (SKU×location; no bin grain).
2. **FIFO transfer → Phase-3 additive, AGGREGATE layer** (lot carries age, not the layer); existing costing suites must pass UNCHANGED (additivity proof).
3. **In-transit → value flows through the virtual `is_transit` node** (no escrow-on-line).
4. **Bond-release → RBAC-immediate** with reserved nullable approval fields; **bonded restricted to AVCO** (no speculative FIFO value-only).
5. **Bins → structure + capacity seam only** (no bin-level balances).
6. **Transfer oversell → hard-block at source** (D5 does not apply to internal transfers).

**Remaining gate before implementation:** Codex plan review on PR #11 (transfer value-conservation §C + the commit-0 composite-FK/set-once approach). Commit 0 is held until that review is in and any CRITICAL/HIGH addressed.
