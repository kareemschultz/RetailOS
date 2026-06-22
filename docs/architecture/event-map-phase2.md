# Phase 2 — Domain Event Map (Products & Inventory Ledger)

- **Status:** PLAN / contract doc — no code. Purpose: lock event **payload shapes + required IDs now** so later phases (Accounting §5, Ecommerce §8, Edge Hub §10, Analytics §12) never discover a missing field after the fact.
- **Transport:** transactional outbox (charter §24) — every event row written in the SAME tenant transaction as the mutation (VS#1 `emitEvent`). Dispatcher/consumers are later phases; Phase 2 only **writes** rows.
- **Envelope (every event, from `outbox_event` + VS#1 `emitEvent`):** `id`, `type`, `version` (default 1), `tenant_id`, `correlation_id`, `request_id`, `payload` (jsonb), `status` (`pending`), `created_at`. **All events are tenant-scoped, correlation/request-ID aware, versioned, and replay-safe (idempotent by the producing mutation's idempotency key).**

> **ID & integrity requirements (apply to ALL events below):** `tenant_id` mandatory (RLS-scoped); `correlation_id` + `request_id` carried from the RequestContext; the producing mutation carries an **idempotency key** so replay yields one event; **server time is authoritative** (`occurred_at` in payload is server-set, device clocks untrusted, §14). Money fields are integer **minor units + currency + scale** (never floats). Quantities are **base-unit** integers (§D2).

## Event catalog

### `inventory.received`
- **Producer:** `inventory.receive` router (receipt movement).
- **Phase-2 consumer:** valuation (updates `avg_cost`/`valuation_layer`); audit.
- **Future consumers:** **P5 Accounting** (inventory-asset debit / GRNI), **P6 Procurement** (PO/GRN reconciliation), **P12 Analytics** (receipt velocity), **P10 Edge Hub** (replay/sync).
- **Payload:** `{ skuId, locationId, qtyBase, unitCostMinor, currency, scale, lotId?, serialIds?, sourceMovementId, costingMethod, occurredAt }`.
- **Required IDs:** skuId, locationId, sourceMovementId (+ envelope).
- **Notes/risks:** must carry `unitCostMinor`+`currency`+`scale` so P5 can post inventory value without a lookup; `costingMethod` included so analytics/accounting know which projection moved.

### `inventory.adjusted`
- **Producer:** `inventory.adjust` (manual adjustment / write-off / found stock).
- **Phase-2 consumer:** valuation; audit; (manager review surfaces).
- **Future consumers:** **P5 Accounting** (shrinkage/write-off expense vs inventory), **P12 Analytics** (adjustment-rate, shrinkage trend).
- **Payload:** `{ skuId, locationId, qtyDeltaBase, reasonCode, unitCostMinor?, currency?, scale?, sourceMovementId, approvedBy?, occurredAt }`.
- **Required IDs:** skuId, locationId, sourceMovementId, actor (envelope/audit).
- **Notes/risks:** `reasonCode` is an extensible `text` enum (see schema rule); negative vs positive delta drives different P5 postings — keep sign explicit.

### `inventory.count_started`
- **Producer:** `inventory.count.start`.
- **Phase-2 consumer:** count workflow state; audit.
- **Future consumers:** **P12 Analytics** (count cadence/coverage), **P10 Edge Hub** (in-store count coordination).
- **Payload:** `{ countId, locationId, scope (full|cycle|zone?), skuFilter?, startedBy, occurredAt }`.
- **Required IDs:** countId, locationId.
- **Notes/risks:** `count_started`/`count_posted` bracket a count; analytics needs both to measure duration. Bin/zone scope reserved for P3.

### `inventory.count_posted`
- **Producer:** `inventory.count.post` (variance posted as `adjustment` movements).
- **Phase-2 consumer:** valuation (variance value); audit.
- **Future consumers:** **P5 Accounting** (variance → shrinkage/gain posting), **P12 Analytics** (count-accuracy/variance KPI).
- **Payload:** `{ countId, locationId, lines:[{ skuId, countedQtyBase, systemQtyBase, varianceBase, varianceValueMinor }], currency, scale, postedBy, occurredAt }`.
- **Required IDs:** countId, locationId, per-line skuId.
- **Notes/risks:** `varianceValueMinor` precomputed so P5 posts without recomputation; value uses the SKU's costing method at post time.

### `inventory.reorder_triggered`
- **Producer:** `inventory.reorder` evaluation when on-hand ≤ min (D7 suggest-only).
- **Phase-2 consumer:** notifications (low-stock alert) + reorder-suggestion report.
- **Future consumers:** **P6 Procurement** (draft-PO suggestion — never auto-PO), **P12 Analytics** (stockout-risk).
- **Payload:** `{ skuId, locationId, onHandBase, minQty, maxQty, suggestedQtyBase, occurredAt }`.
- **Required IDs:** skuId, locationId.
- **Notes/risks:** **no PO created** (D7); P6 consumes the suggestion behind the §22 approval workflow. `suggestedQtyBase` = max − onHand (fixed min/max).

### `inventory.stock_discrepancy`
- **Producer:** oversell resolver (D5) when a sale drives on-hand negative (allow-with-flagging), or count variance beyond threshold.
- **Phase-2 consumer:** manager-review dashboard feed; audit.
- **Future consumers:** **P12 Analytics** (discrepancy/shrinkage, cashier-anomaly correlation, §27), **P5 Accounting** (if it resolves to a write-off), **P10 Edge Hub** (offline oversell surfaced on sync).
- **Payload:** `{ skuId, locationId, expectedQtyBase, actualQtyBase, deltaBase, source (oversell|count|sync), saleId?, occurredAt }`.
- **Required IDs:** skuId, locationId (+ saleId when oversell).
- **Notes/risks:** the negative-on-hand carrying value uses last-known cost (D5); analytics correlates by cashier/terminal later — keep `source` + optional `saleId` so the chain is reconstructable.

### `inventory.lot_expiring`
- **Producer:** scheduled/threshold evaluation (lot crosses the configurable near-expiry horizon, D4).
- **Phase-2 consumer:** notifications/alerts.
- **Future consumers:** **P12 Analytics** (expiry-risk, dead-stock), **P8 Ecommerce** (suppress/markdown near-expiry online), **P6 Procurement** (over-ordering signal).
- **Payload:** `{ lotId, skuId, locationId, expiryDate, qtyRemainingBase, horizonDays, occurredAt }`.
- **Required IDs:** lotId, skuId, locationId.
- **Notes/risks:** horizon is configurable (D4); emitted once per lot per crossing (idempotent on `lotId`+horizon) to avoid alert storms.

### `inventory.lot_expired`
- **Producer:** lot passes expiry.
- **Phase-2 consumer:** notifications; quarantine/blocked-from-sale state (per D4 policy).
- **Future consumers:** **P5 Accounting** (expired-stock write-off), **P12 Analytics** (waste KPI), **P8 Ecommerce** (delist).
- **Payload:** `{ lotId, skuId, locationId, expiryDate, qtyRemainingBase, unitCostMinor, currency, scale, occurredAt }`.
- **Required IDs:** lotId, skuId, locationId.
- **Notes/risks:** carries `unitCostMinor` so the eventual write-off value is known; whether sale is hard-blocked depends on the D4 per-tenant/category/product policy (override = audited `inventory.override_expiry`).

### `inventory.valuation_updated`
- **Producer:** the valuation step after any cost-affecting movement (receipt/issue/adjustment/revaluation).
- **Phase-2 consumer:** valuation read model / report.
- **Future consumers:** **P5 Accounting** (inventory-asset balance sync, COGS), **P12 Analytics** (margin, valuation roll-forward).
- **Payload:** `{ skuId, locationId, costingMethod, totalValueMinor, qtyOnHandBase, derivedAvgCostMinor?, currency, scale, sourceMovementId, occurredAt }`.
- **Required IDs:** skuId, locationId, sourceMovementId.
- **Notes/risks:** emits **`totalValueMinor` (integer truth) + `qtyOnHandBase`**, not just a derived average — preserves the value-integrity invariant (qty=0 ⟺ value=0) for downstream consumers; `derivedAvgCostMinor` is display-only and may be omitted/rounded per the still-open D-money mode.

### `inventory.uom_converted`
- **Producer:** UoM conversion service when a transaction unit differs from the base unit (receive/sale/transfer).
- **Phase-2 consumer:** (informational) — the ledger always stores base units; this records the conversion that happened at the edge.
- **Future consumers:** **P12 Analytics** (purchase-vs-sale unit mix), **P6 Procurement** (carton-vs-each buying), **P8 Ecommerce** (display unit).
- **Payload:** `{ skuId, fromUom, toUom, fromQty, toQtyBase, factor, factorScale, occurredAt }`.
- **Required IDs:** skuId.
- **Notes/risks:** factor stored as **integer ratio** (`factor`/`factorScale`, D2); a discrete-SKU conversion that isn't an exact integer in base units is **rejected upstream**, so this event only ever carries exact conversions. Lowest-value event — may be folded into `received`/sale metadata rather than emitted standalone (decide at implementation; documented here so the field shape is reserved).

## Consumer matrix (which later phase needs which event)

| Event | P5 Accounting | P6 Procurement | P8 Ecommerce | P10 Edge Hub | P12 Analytics |
|---|:--:|:--:|:--:|:--:|:--:|
| inventory.received | ✅ | ✅ | | ✅ | ✅ |
| inventory.adjusted | ✅ | | | ✅ | ✅ |
| inventory.count_started | | | | ✅ | ✅ |
| inventory.count_posted | ✅ | | | ✅ | ✅ |
| inventory.reorder_triggered | | ✅ | | | ✅ |
| inventory.stock_discrepancy | ✅ | | | ✅ | ✅ |
| inventory.lot_expiring | | ✅ | ✅ | | ✅ |
| inventory.lot_expired | ✅ | | ✅ | | ✅ |
| inventory.valuation_updated | ✅ | | | ✅ | ✅ |
| inventory.uom_converted | | ✅ | ✅ | | ✅ |

## Cross-cutting risks

- **Field-completeness:** every value-bearing event carries `*Minor` + `currency` + `scale` so P5 never recomputes money; every quantity is base-unit so units are unambiguous.
- **Versioning:** `version` starts at 1; add fields additively (consumers tolerate unknown fields). Breaking a payload requires a `version` bump + upcaster (§24).
- **Idempotency/replay:** events inherit the producing mutation's idempotency key; Edge Hub replay (P10) must dedupe on `(tenant_id, idempotency_key, type)`.
- **Server time:** `occurredAt` is server-set; never trust device clocks for ordering (§14).
