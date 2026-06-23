# Phase 3 — Domain Event Map (Locations / Warehouses / Bonds / Transfers)

- **Status:** PLAN / contract doc — no code. Purpose: lock event **payload shapes + required IDs now** so later phases (Accounting §5, Procurement §6, Edge Hub §10, Analytics §12) never discover a missing field. Same discipline as `event-map-phase2.md`.
- **Transport:** transactional outbox (charter §24) — every event row written in the SAME tenant tx as the mutation (`emitEvent`). `occurredAt` is **server-injected** by `emitEvent` (last in the spread; device clocks untrusted, §14). Money = integer `*Minor` + `currency` + `scale`; quantities are **base-unit** integers.
- **Envelope (every event):** `id, type, version (default 1), tenant_id, correlation_id, request_id, payload (jsonb), status (pending), created_at`. Tenant-scoped, correlation/request-ID aware, versioned, replay-safe (idempotent by the producing mutation's idempotency key).
- **New `DomainEventType` constants to add** (Phase 3): `inventory.transfer_dispatched`, `inventory.transfer_received`, `inventory.transfer_cancelled`, `inventory.bond_received`, `inventory.bond_release_requested`, `inventory.bond_release_approved`, `inventory.bond_released`. Warehouse-structure CRUD (zone/bin) is **audited but not evented** in Phase 3 (no consumer needs it; add later if one does).

> **Reserved-field discipline (Phase-2 lesson):** any field a later consumer will bind but Phase 3 can't yet populate is reserved **present-but-null**, never shipped absent. Money fields are `_minor`-suffixed.

## Event catalog

### `inventory.transfer_created`
- **Producer:** `transfer.create` router (draft transfer + lines + the per-transfer in-transit node). **Intra-company only.**
- **Phase-3 consumer:** transfer worklist; audit. **Future:** P12 Analytics.
- **Payload (as-built, commit 2):** `{ transferId, companyId, number, sourceLocationId, destLocationId, inTransitLocationId, expectedReceiptDate, lines:[{ skuId, productId, qtyBase }], createdBy, occurredAt }`.
- **Notes:** no stock moves yet (draft). Value is established at ship time.

> **Commit-2 status (2026-06-22):** `transfer_created`/`transfer_dispatched`/`transfer_received`/`transfer_cancelled` are EMITTED for the quantity lifecycle. The **value fields** on dispatched/received (`releasedValueMinor`/`receivedValueMinor`/`currency`/`scale`) are **RESERVED `null`** until commit 3 wires value conservation (same present-but-null reserved-field discipline as Phase 2).

### `inventory.transfer_dispatched`
- **Producer:** `transfer` router → `executeTransfer` (leg 1: source issue → in-transit). **Intra-company only** — `sourceLocationId` & `destLocationId` share `companyId` (INV-6); inter-company transfers are blocked (need P5 due-to/due-from GL).
- **Phase-3 consumer:** in-transit read model; audit. **Future:** P5 Accounting (in-transit asset move), P10 Edge Hub, P12 Analytics (transfer velocity).
- **Payload:** `{ transferId, companyId, sourceLocationId, destLocationId, inTransitLocationId, shippedAt, expectedReceiptDate, lines:[{ skuId, productId, qtyBase, releasedValueMinor, currency, scale, costingMethod }], dispatchedBy, occurredAt }`.
- **Required IDs:** transferId, companyId, sourceLocationId, destLocationId, per-line skuId. `releasedValueMinor` = the exact integer value `V` that left source (INV-2). `inTransitLocationId` null only if single-step. `expectedReceiptDate` reserved nullable (date seam).

### `inventory.transfer_received`
- **Producer:** `transfer` router → `executeTransfer` (leg 2: in-transit → destination receipt).
- **Phase-3 consumer:** destination valuation; audit. **Future:** P5 (inventory-asset at destination), P12.
- **Payload:** `{ transferId, sourceLocationId, destLocationId, actualReceiptDate, lines:[{ skuId, productId, qtyBase, receivedValueMinor, currency, scale, costingMethod, varianceQtyBase }], receivedBy, occurredAt }`.
- **Required IDs:** transferId, destLocationId, per-line skuId. `receivedValueMinor` MUST equal the dispatched `releasedValueMinor` for the line (value conservation, INV-2). `actualReceiptDate` = receipt date seam. `varianceQtyBase` reserved (0 unless a receive-discrepancy is recorded — P1).

### `inventory.transfer_cancelled`
- **Producer:** transfer cancel/return-to-source path (in-transit never received).
- **Payload:** `{ transferId, sourceLocationId, inTransitLocationId, lines:[{ skuId, qtyBase, returnedValueMinor, currency, scale }], reason, cancelledBy, occurredAt }`.
- **Notes:** returns in-transit stock+value to source; value still conserved (no creation/destruction).

### `inventory.bond_received`
- **Producer:** `bond` router → bond-receipt (import batch into a `bonded` location).
- **Phase-3 consumer:** bonded stock read model; audit. **Future:** P6 Procurement (PO/GRN reconciliation), P5 (bonded-asset vs GRNI), P12.
- **Payload:** `{ bondReceiptId, locationId, lines:[{ skuId, productId, qtyBase, unitCostMinor, currency, scale, lotId, customsRef, landedCostRef }], supplierRef, receivedBy, occurredAt }`.
- **Required IDs:** bondReceiptId, locationId (must be a `bonded` location), per-line skuId. `customsRef`/`landedCostRef` are **reference seams** (nullable; no allocation behaviour). `lotId` nullable.

### `inventory.bond_release_requested`
- **Producer:** `bond` router → release request (approval seam, limb 1).
- **Payload:** `{ bondReleaseId, bondReceiptId, locationId, destLocationId, lines:[{ skuId, qtyBase }], requestedBy, occurredAt }`.
- **Notes:** opens the approval seam; no stock moves yet. `destLocationId` = where the released stock will land.

### `inventory.bond_release_approved`
- **Producer:** `bond` router → approval (approval seam, limb 2; requires `bond.approve_release`).
- **Payload:** `{ bondReleaseId, bondReceiptId, approvedBy, occurredAt }`.
- **Notes:** authorization event (INV-4); the actual stock move is `bond_released` (executed as a transfer).

### `inventory.bond_released`
- **Producer:** `bond` router → release execution (bonded → released **transfer**, then a value-only duty adjustment).
- **Phase-3 consumer:** released stock read model; audit. **Future:** P5 (duty/landed-cost posting seam), P6, P12.
- **Payload:** `{ bondReleaseId, bondReceiptId, transferId, sourceLocationId (bonded), destLocationId, lines:[{ skuId, qtyBase, releasedValueMinor, dutyMinor, taxMinor, currency, scale }], releasedBy, requestedBy, approvedBy, occurredAt }`.
- **Notes:** carries `transferId` because release IS a transfer (reuses INV-1/INV-2 conservation). The **duty/tax cost-basis add is an intentional value-add, NOT conservation** (INV-5): after the transfer lands the stock, a value-only `valuation_adjustment` (`qty_delta=0`, `value_delta = dutyMinor + taxMinor`) raises the released cost basis — this **reuses the existing AVCO value-only seam** and itself emits `inventory.valuation_updated`. `dutyMinor`/`taxMinor` are per-line amounts added (reserved `0` if none). **Bonded stock is AVCO-only in Phase 3 (LOCKED)** — bond-receipt rejects FIFO SKUs, so the value-only duty seam always applies. **`requestedBy`/`approvedBy` are RESERVED nullable** — release is **RBAC-immediate** in Phase 3 (gated behind `bond.release`/`bond.approve_release`; both default to `releasedBy`), and the §22 request→approve workflow binds these additively later (same pattern as `approvedBy: null` on `inventory.adjusted`). Duty/VAT clearance state beyond this is deferred (P5/P6).

### Reused Phase-2 events (emitted by transfer legs)
- **`inventory.valuation_updated`** — each transfer/bond leg that changes a SKU×location projection emits it (existing contract). The reserved `totalValueMinor`/`qtyOnHandBase` fields stay reserved-null until the Phase-5 `ValuationResult` extension.

## Consumer matrix (which later phase needs which event)
| Event | P5 Accounting | P6 Procurement | P10 Edge Hub | P12 Analytics |
|---|:--:|:--:|:--:|:--:|
| inventory.transfer_dispatched | ✅ | | ✅ | ✅ |
| inventory.transfer_received | ✅ | | ✅ | ✅ |
| inventory.transfer_cancelled | ✅ | | ✅ | ✅ |
| inventory.bond_received | ✅ | ✅ | ✅ | ✅ |
| inventory.bond_release_requested | | ✅ | | ✅ |
| inventory.bond_release_approved | ✅ | | | ✅ |
| inventory.bond_released | ✅ | ✅ | ✅ | ✅ |

## Cross-cutting risks
- **Value conservation in the event stream:** `transfer_received.receivedValueMinor` MUST equal `transfer_dispatched.releasedValueMinor` per line — a consumer (P5) can reconcile on this; a mismatch is a bug, not a rounding artefact (exact integers carried).
- **Versioning:** `version` starts at 1; add fields additively; breaking changes need a version bump + upcaster.
- **Idempotency/replay:** events inherit the producing mutation's idempotency key; Edge Hub (P10) dedupes on `(tenant_id, idempotency_key, type)`.
- **Server time:** `occurredAt` server-injected; never trust device clocks (§14).
