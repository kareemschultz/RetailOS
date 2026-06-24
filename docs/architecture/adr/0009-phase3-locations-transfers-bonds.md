# ADR 0009 — Phase 3: locations, transfers, and bonds

- **Status:** Accepted (merged to master 2026-06-23, commits 0–7, `67e6120`).
- **Context:** charter §18 (inventory/warehouse/bond engine), §12 (Caribbean/import — bonded warehouses, customs, duty, landed cost), §8 (tenant/company/location hierarchy), §7 (entitlements). Relates: ADR 0006 (RLS role model), ADR 0007 (costing), ADR 0008 (settings resolver), `module-specs/locations-warehouses-bonds.md`, `event-map-phase3.md`, `phase-3-implementation-plan.md` §I (owner-locked decisions).
- **Scope:** the load-bearing architectural decisions for the Locations/Warehouses/Bonds module. Costing internals are ADR 0007/0008; this ADR covers the structural model and the bond/transfer mechanics built on top.

## Decision 1 — Unified self-referential `location` tree

A SINGLE `location` table models the entire physical hierarchy (store, warehouse, bonded, DC, fulfillment, in_transit, zone, aisle, rack, shelf, bin) via `parent_location_id`, rather than separate zone/aisle/rack/bin tables.

- **Tenant+company integrity:** a child's parent is pinned to the SAME tenant AND company by a 3-col composite self-FK `(tenant_id, company_id, parent_location_id) → location(tenant_id, company_id, id)`. A CHECK cannot enforce this (it can't read the parent row) — the composite FK is the only DB-layer mechanism.
- **Behaviour flags** (`is_sellable`, `is_quarantine`, `is_bonded`, `is_transit`) let POS/sales auto-exclude non-sellable stock without per-query special-casing.
- **Capacity seam** (`max_weight`, `max_volume`) is reserved nullable — NO WMS routing logic now.
- **Alternative rejected:** separate per-level tables → rigid depth, join explosion, and no clean way to add a new level. The unified tree is the Odoo/NetSuite-style location model.

## Decision 2 — Two-step, intra-company, value-conserving transfers

A transfer moves stock `source → per-transfer in-transit node → dest` (`draft → shipped → received`/`cancelled`).

- **Per-transfer in-transit node** (not one shared transit location): each `createTransfer` makes its own `is_transit` location so concurrent transfers never blend value (Codex F2 of the plan review).
- **Quantity AND value conserved (INV-1/INV-2):** every leg goes through the sole ledger mutator `appendStockMovement` + valuation; the receive leg lands EXACTLY the value that left the source. AVCO reuses the frozen receipt + value-only seams; FIFO got one ADDITIVE primitive (`applyTransferInValuation`) — `costing.ts` was touched +202/−0, with the frozen Phase-2 costing suite passing byte-identical (the additivity proof).
- **Intra-company only:** source/dest must share a company — enforced by 3-col composite location FKs on all endpoints + a friendly service guard. Inter-company is a DB-layer impossibility. (Cross-company stock movement is a sale/invoice concern, not a transfer.)
- **Transfer transitions lock the transfer row `FOR UPDATE`** so concurrent ship/receive serialize (Codex commit-3 HIGH-1).

## Decision 3 — Bonded receiving keeps bonded and released stock separate (INV-3)

A bond receipt is a normal valued AVCO receipt INTO a bonded location node, decorated with customs/landed-cost reference seams (generic, not GRA-specific) and a per-line costing-method STAMP.

- **Bonded is AVCO-only in Phase 3 (§I.4 LOCKED):** a FIFO-resolving SKU is rejected at receipt. The value-only duty seam used on release is AVCO-only; a FIFO-bonded path is a future change-request, not built speculatively.
- **F5 stamp:** the resolved costing method is stamped on `bond_receipt_line.costing_method_applied` at receipt — the receipt-time record the release reads.
- **Positive cost required:** bonded dutiable goods carry a positive declared landed cost (`unit_cost_minor > 0`), so the duty-on-release basis is never zero (the `qty=0⟺value=0` CHECK does not catch qty>0 & value=0).

## Decision 4 — Bond release = approved transfer + value-only duty add (INV-4/5)

A bond release composes existing machinery — NO new costing path:

1. an approved bonded→released `stock_transfer` (create→ship→receive; qty + value conserved per INV-2);
2. a per-line value-only duty/tax `valuation_adjustment` (`qty_delta=0`, `value_delta = duty + tax`) via the existing AVCO value-only seam — an INTENTIONAL value-ADD raising the released cost basis, NOT conservation.

- **RBAC-immediate** (resolving the plan's OPEN decision): ONE `bond.release` mutation requiring BOTH `bond.release` + `bond.approve_release`. Emits only `inventory.bond_released`. The §22 request→approve workflow (and its `inventory.bond_release_requested`/`_approved` events + `requested_by`/`approved_by` columns) is RESERVED nullable and binds additively later — the events are deliberately NOT enumerated in `DomainEventType` (nothing emits them).
- **Stamp/live consistency (commit-5 F1):** the F5 stamp is only a gate; `applyValuation` re-resolves costing from the LIVE setting. So the release re-resolves the LIVE method (via the same `resolveCostingMethod` the engine uses) and REJECTS any drift to non-AVCO. Consequence: a tenant/category costing flip blocks pending bonded releases until reconciled. **OWNER DECISION PENDING** (OVERNIGHT-LOG 🔒): keep "reject + reconcile" (safe, current) vs force AVCO-from-stamp through the engine (needs a frozen-code change-request). See ADR consequence below + TD-P3-1/2 in `phase-3-reassessment.md`.
- **Over-release prevented under concurrency:** the bonded on-hand check takes the same per-cell advisory lock the mutator uses, BEFORE the read (commit-5 F2 TOCTOU).
- **Per-line released value** is attributed deterministically (per-SKU proportional-by-qty), independent of transfer-line row order (commit-5 F3).

## Decision 5 — Durable cross-tenant / cross-company defenses (parked debt #5/#7)

- **Composite `(tenant_id, id)` FKs** on company/location/product/sku/lot/bond_receipt_line are the durable kill for the H1 cross-tenant FK-bypass class (Postgres FK checks bypass RLS). Proven by raw-insert tests that bypass router guards.
- **Set-once costing trigger (#7):** `costing_method` is immutable on a product/sku once it has any `stock_ledger` movement — a DB trigger, the class-level backstop behind the router-layer guard. Covers product-level movements for a SKU (nullable `sku_id`). Re-confirmed in commit 5 (it blocked a product costing flip).

## Consequences

- **Positive:** bonded/released separation, intra-company transfers, and duty-into-cost-basis match Cin7/Fishbowl-class capability and are the §12 Caribbean/import differentiators. All defenses are DB-layer and proven by adversarial (raw-insert, concurrent) tests, not just router tests. Zero frozen-costing regressions.
- **Negative / open:** bonded release is brittle to a tenant/category costing flip (TD-P3-1, owner decision pending); `organization`/`category` costing has no set-once guard yet (TD-P3-2); no WMS routing/tree-builder route yet (TD-P3-3); release lineage is by bonded on-hand, not per-receipt-line (TD-P3-4). All recorded in `phase-3-reassessment.md` §3.
- **Precision:** transfer/duty value is exact-integer (division-free on the hot path), so issue #6 (BigInt `mulDivRound`) is NOT a Phase-3 blocker; it remains a Phase-5 blocker before a large tenant onboards.
