# Phase 3 API Contracts — Locations / Warehouses / Bonds / Transfers

- **Status:** backend contract snapshot for branch `phase-3-overnight` (commits 0–6). Not merged; for owner review.
- **Scope:** the oRPC routes Phase 3 adds or extends on `appRouter`. All routes are tenant-scoped via `tenantProcedure` and run inside `withTenant` (fail-closed RLS).
- **Security invariants (every mutation):** RBAC via `assertPermission`; every FK-bearing input validated through an RLS-scoped read before insert (Postgres FK checks bypass RLS — the H1 class); composite `(tenant_id, …)` FKs are the durable DB backstop; audit row on state change; transactional outbox event where a downstream phase needs a seam (`occurredAt` server-injected by `emitEvent`).
- **Money/qty:** integer minor units (`*Minor` + `currency` + `scale`); quantities are base-unit integers.
- **Not UI:** no screen/component decisions here.

## Location tree (extended)

### `location.create`
- **Input:** `{ companyId, name, type }` where `type ∈ {store, warehouse, bonded, distribution_center, fulfillment_center, in_transit, zone, aisle, rack, shelf, bin}`.
- **Permission:** `location.create`
- **Writes:** `location` (unified self-referential tree; `parent_location_id`, behaviour flags `is_sellable`/`is_quarantine`/`is_bonded`/`is_transit`, and the `max_weight`/`max_volume` capacity seam exist on the row but are not yet exposed as create inputs — set via seed/import in Phase 3; a tree-builder route is a later change-request).
- **Guard:** `companyId` visible through tenant RLS.
- **DB integrity:** a child's `parent_location_id` is pinned to the SAME tenant AND company by the `location_parent_composite_fk` 3-col self-FK.
- **Audit:** `location.create`

## Transfers (`transfer.*`) — two-step, intra-company, value-conserving

A transfer moves stock `source → per-transfer in-transit node → dest`, conserving BOTH quantity and value (INV-1/INV-2). Intra-company only: source and dest must share a company (enforced by 3-col composite location FKs + a service guard). Status: `draft → shipped → received` (or `→ cancelled`).

### `transfer.create`
- **Input:** `{ sourceLocationId, destLocationId, expectedReceiptDate?, lines: [{ productId, skuId?, lotId?, qty }] }`
- **Permission:** `inventory.transfer`
- **Writes:** `stock_transfer` (status `draft`) + `stock_transfer_line` + a fresh per-transfer `in_transit` location node.
- **Guards:** source/dest visible (RLS); SKU-belongs-to-product (tuple guard); intra-company.
- **Event:** `inventory.transfer_created` · **Audit:** `transfer.create`

### `transfer.ship`
- **Input:** `{ transferId }`
- **Permission:** `inventory.transfer`
- **Effect:** `draft → shipped`; moves each line `source → in-transit` through `appendStockMovement` (`transfer_out`) + valuation (value leaves the source cell). The transfer row is `SELECT … FOR UPDATE`-locked so concurrent ships serialize (only one wins).
- **Event:** `inventory.transfer_dispatched` (per-line `releasedValueMinor` + top-level aggregate) · **Audit:** `transfer.ship`

### `transfer.receive`
- **Input:** `{ transferId }`
- **Permission:** `inventory.transfer_receive`
- **Effect:** `shipped → received`; moves each line `in-transit → dest` (`transfer_in`) + `applyTransferInValuation` lands EXACTLY the value that left the source (INV-2). No double-receive (status guard).
- **Event:** `inventory.transfer_received` (per-line `receivedValueMinor` == the dispatched `releasedValueMinor`) · **Audit:** `transfer.receive`

### `transfer.cancel`
- **Input:** `{ transferId }`
- **Permission:** `inventory.transfer`
- **Effect:** cancels a `draft` or `shipped` transfer; a shipped-then-cancelled transfer returns value+qty to the source (no orphan in the transit node). Cannot cancel a `received` transfer.
- **Event:** `inventory.transfer_cancelled` · **Audit:** `transfer.cancel`

## Bonds (`bond.*`)

### `bond.receive` — import batch into a bonded location (INV-3)
- **Input:** `{ companyId, locationId, supplierRef?, customsReference?, landedCostReference?, receivedAt?, lines: [{ productId, skuId, lotId?, qty, unitCostMinor, costCurrency, costScale, customsReference?, landedCostReference? }] }`
- **Permission:** `bond.receive`
- **Effect:** appends a valued AVCO receipt movement at the bonded node (`is_bonded=true`) → bonded value isolated from sellable stock (INV-3). Each line stamps `costing_method_applied` (F5).
- **Guards (H1/F2/F3/F4/F5):** company + location visible; location is bonded AND in the receipt's company (3-col composite FK); SKU-belongs-to-product; lot-belongs-to-SKU; `unitCostMinor > 0` (dutiable goods carry a positive declared cost). Bonded is **AVCO-only** (§I.4) — a FIFO-resolving SKU is rejected.
- **Event:** `inventory.bond_received` · **Audit:** `bond.receive`

### `bond.release` — clear bonded stock to a sellable location WITH duty (INV-4/5)
- **Input:** `{ bondReceiptId, destLocationId, lines: [{ bondReceiptLineId, qty, dutyMinor?, taxMinor? }] }`
- **Permission:** BOTH `bond.release` AND `bond.approve_release` (RBAC-immediate — one actor clears in a single call; a `bond_officer` role holds both).
- **Effect:** (1) an approved bonded→released `stock_transfer` (create→ship→receive; value conserved per INV-2); (2) a per-line value-only duty/tax `valuation_adjustment` (`qty_delta=0`, `value_delta = duty + tax`) raising the released cost basis — an INTENTIONAL value-ADD (INV-5), via the existing AVCO value-only seam. `bond_release` (status `pending → released`) + `bond_release_line` recorded.
- **Guards:** dest visible, non-bonded (sellable), and in the receipt's company (3-col composite FK); each line's receipt line belongs to the receipt; F5 stamp must be `avco`; the LIVE resolved method must still be `avco` (rejects a post-receipt tenant/category costing drift — see commit-5 F1); bonded on-hand not exceeded (aggregated per SKU, under the per-cell advisory lock that serializes concurrent releases).
- **Event:** `inventory.bond_released` — `{ bondReleaseId, bondReceiptId, transferId, sourceLocationId, destLocationId, lines:[{ skuId, qtyBase, releasedValueMinor, dutyMinor, taxMinor, currency, scale }], releasedBy, requestedBy, approvedBy, occurredAt }`. `requestedBy`/`approvedBy` default to the actor (RBAC-immediate); the §22 request→approve workflow + `inventory.bond_release_requested`/`_approved` events are RESERVED (not enumerated). · **Audit:** `bond.release`

## RBAC roles (Phase 3, commit 6)

Operational separation of duties added to `ROLE_PERMISSIONS`:

| Role | Phase-3-relevant permissions |
|---|---|
| `tenant_admin` | everything (incl. `bond.receive/release/approve_release`, `inventory.transfer`/`transfer_receive`, `location.create`) |
| `manager` | `inventory.transfer`/`transfer_receive` + catalog/inventory/POS; NO bond |
| `warehouse` | `inventory.receive/adjust/count/transfer/transfer_receive`, `reports.view`; **no bond, no POS** |
| `bond_officer` | `bond.receive/release/approve_release` (BOTH bond perms → RBAC-immediate), `inventory.transfer/transfer_receive`, `reports.view`; **no POS/catalog** |
| `cashier` | `pos.create_sale` only |

## Demo seed (`seedPhase3`)

`packages/db/src/seeds/index.ts → seedPhase3` provisions a fresh tenant and builds, through the SERVICES: a location tree (warehouse → zone → 2 bins with the capacity seam), a store, a bonded warehouse; two AVCO products/SKUs; one COMPLETED transfer (warehouse→store) and one IN-FLIGHT transfer (shipped, awaiting receipt); a bonded receipt (40 units) and a bond release (25 units) with duty+tax. Run-once on a fresh tenant (transfers/releases carry gapless numbers and consume stock — not idempotent on rerun).
