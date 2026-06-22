# Phase 2 — Domain Event Map (Products & Inventory Ledger)

- **Status:** PLAN / contract doc — no code. Purpose: lock event **payload shapes + required IDs now** so later phases (Accounting §5, Ecommerce §8, Edge Hub §10, Analytics §12) never discover a missing field after the fact.
- **Transport:** transactional outbox (charter §24) — every event row written in the SAME tenant transaction as the mutation (VS#1 `emitEvent`). Dispatcher/consumers are later phases; Phase 2 only **writes** rows.
- **Envelope (every event, from `outbox_event` + VS#1 `emitEvent`):** `id`, `type`, `version` (default 1), `tenant_id`, `correlation_id`, `request_id`, `payload` (jsonb), `status` (`pending`), `created_at`. **All events are tenant-scoped, correlation/request-ID aware, versioned, and replay-safe (idempotent by the producing mutation's idempotency key).**

> **ID & integrity requirements (apply to ALL events below):** `tenant_id` mandatory (RLS-scoped); `correlation_id` + `request_id` carried from the RequestContext; the producing mutation carries an **idempotency key** so replay yields one event; **server time is authoritative** (`occurredAt` in payload is server-set, device clocks untrusted, §14). Money fields are integer **minor units + currency + scale** (never floats). Quantities are **base-unit** integers (§D2).

> **`occurredAt` is injected by `emitEvent` (verified as-built, 2026-06-22):** every payload below carries a server-set `occurredAt` (ISO-8601, `new Date().toISOString()`) added inside `emitEvent` — NOT by individual producers — so it is uniform across all events and applied LAST in the payload spread, so a producer cannot override server time. The per-event payloads below therefore list `occurredAt` as a guaranteed field even where the producer does not set it.

## Event catalog

### `inventory.received`
- **Producer:** `inventory.receive` router (receipt movement).
- **Phase-2 consumer:** valuation (updates `avg_cost`/`valuation_layer`); audit.
- **Future consumers:** **P5 Accounting** (inventory-asset debit / GRNI), **P6 Procurement** (PO/GRN reconciliation), **P12 Analytics** (receipt velocity), **P10 Edge Hub** (replay/sync).
- **Payload (verified as-built):** `{ productId, skuId, locationId, qtyBase, unitCostMinor, currency, scale, lotId, serialIds, sourceMovementId, costingMethod, occurredAt }`.
- **Required IDs:** productId, locationId, sourceMovementId (+ envelope). `skuId` present but **nullable** — product-level receipts (no variant) carry `skuId: null`.
- **Notes/risks:** must carry `unitCostMinor`+`currency`+`scale` so P5 can post inventory value without a lookup; `costingMethod` included so analytics/accounting know which projection moved. **`productId` is carried as-built** (receipts can be product-level before a SKU is chosen). **`serialIds` is reserved `null`** — serial capture is deferred (no serial entity wired yet); the field is locked in the contract now so consumers tolerate it additively when serial tracking lands.

### `inventory.adjusted`
- **Producer:** `inventory.adjust` (manual adjustment / write-off / found stock).
- **Phase-2 consumer:** valuation; audit; (manager review surfaces).
- **Future consumers:** **P5 Accounting** (shrinkage/write-off expense vs inventory), **P12 Analytics** (adjustment-rate, shrinkage trend).
- **Payload (verified as-built):** `{ skuId, locationId, lotId, qtyDeltaBase, reasonCode, cogsMinor, currency, scale, sourceMovementId, occurredAt }`.
- **Required IDs:** skuId, locationId, sourceMovementId, actor (envelope/audit).
- **Notes/risks:** `reasonCode` is an extensible `text` enum (see schema rule); negative vs positive delta drives different P5 postings — keep sign explicit. **Decision (2026-06-22): the event carries `cogsMinor` (the actual value moved through the AVCO/FIFO valuation), not a raw `unitCostMinor`** — a negative adjustment's value can only be expressed as the valuation-computed COGS, which is exactly what P5 posts to shrinkage/write-off; `currency`/`scale` come from that valuation. `lotId` is carried (nullable). **`approvedBy` is deferred** — there is no adjustment-approval workflow yet (§22); it is added when that workflow lands (additive, version stays 1).

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
- **Payload (verified as-built):** `{ countId, locationId, currency, scale, lines:[{ skuId, lotId, countedQtyBase, systemQtyBase, varianceBase, varianceValueMinor }], postedBy, occurredAt }`.
- **Required IDs:** countId, locationId, per-line skuId.
- **Notes/risks:** `varianceValueMinor` precomputed so P5 posts without recomputation; value uses the SKU's costing method at post time. **Top-level `currency`/`scale`** are the count's single valuation currency (lines COALESCE to USD/2); the `postStockCount` service return surfaces them on the header. Per-line `lotId` is carried (nullable). The internal service `adjustments` keep their own field names (`countedQty`/`systemQty`/`varianceQty`/`valuationMinor`); only the **event payload** is normalized to the base/Minor names above.

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
- **Payload (verified as-built, oversell variant):** `{ productId, locationId, saleId, qtySold, resultingOnHand, deltaBase, source (oversell|count|sync), reason, sourceMovementId, occurredAt }` (+ envelope `idempotencyKey`).
- **Required IDs:** locationId, productId (+ saleId when oversell).
- **Notes/risks:** **as-built is PRODUCT-LEVEL, not SKU-level** — `pos.createSale` deducts stock at the product grain (it does not resolve a SKU), so the oversell event carries `productId` + `qtySold` + `resultingOnHand`, NOT `skuId`/`expectedQtyBase`/`actualQtyBase`. **This moves to `skuId` + the `expected/actual` shape only when the POS↔costing boundary is wired in Phase 4 (ticket #8, owner-ratified 2026-06-22)** — it is intentionally not changed here (POS sale path is Phase-4-frozen). **D5 divergence (as-built):** the oversold/negative units are recorded **zero/unvalued** (NOT last-known-cost — see `module-specs/inventory.md` D5 divergence). Analytics correlates by cashier/terminal later — `source` + `saleId` keep the chain reconstructable.

### `inventory.cost_reconciliation`
- **Producer (§3):** the receipt path, when inventory moves **from negative to zero/non-negative** and a later receipt establishes the **actual** cost for previously-unvalued (oversold) units. **Emit wiring is DEFERRED behavior** (reconciliation logic); this entry locks the contract now so Phase-5 Accounting can consume it without a missing field.
- **Phase-2 consumer:** none (contract seam only).
- **Future consumers:** **P5 Accounting** (post the cost-basis correction / COGS true-up), **P12 Analytics** (oversell-cost exposure).
- **Payload:** `{ tenantId, locationId, skuId, receiptId, priorNegativeQtyBase, receiptQtyBase, receiptUnitCostMinor, priorCostBasisMinor, reconciliationAmountMinor, occurredAt }`.
- **`reconciliationAmountMinor`** is the **computed variance, rounded once at emission** (not raw inputs for Phase 5 to re-derive). Given the as-built zero/unvalued basis (D5 divergence), `priorCostBasisMinor = 0` and `reconciliationAmountMinor` ≈ the **full receipt cost of the previously-unvalued units** (`receiptUnitCostMinor × min(priorNegativeQtyBase, receiptQtyBase)`).
- **`priorCostBasisMinor` reflects ACTUAL current behavior (zero/unvalued), not a hypothetical last-known-cost.** Do not claim last-known-cost here.
- **Required IDs:** tenantId, locationId, skuId, receiptId (+ envelope `correlation_id`/`request_id`/`idempotency_key`).
- **Notes/risks (M3 cross-ref):** value-only valuation adjustments and these reconciliation true-ups **grow `total_value_minor` without growing quantity**, which **accelerates the 2^53 precision exposure** tracked in issue #6 (`costing.ts` valuation math in JS `number`). Money fields are integer **minor units**; rounding mode is the still-open D-money decision.

### `inventory.lot_expiring`
- **Status (2026-06-22): DEFERRED — NOT emitted in Phase 2.** There is no Phase-2 producing action: the producer is a **scheduled/threshold evaluator** that requires a background-job runner / cron, which is later-phase infrastructure (notifications/jobs, §22/§28). The contract is locked here so the Phase-12 expiry evaluator emits the right shape; it is intentionally not in `DomainEventType` (nothing emits it yet).
- **Producer (when built):** scheduled/threshold evaluation (lot crosses the configurable near-expiry horizon, D4).
- **Phase-2 consumer:** notifications/alerts.
- **Future consumers:** **P12 Analytics** (expiry-risk, dead-stock), **P8 Ecommerce** (suppress/markdown near-expiry online), **P6 Procurement** (over-ordering signal).
- **Payload:** `{ lotId, skuId, locationId, expiryDate, qtyRemainingBase, horizonDays, occurredAt }`.
- **Required IDs:** lotId, skuId, locationId.
- **Notes/risks:** horizon is configurable (D4); emitted once per lot per crossing (idempotent on `lotId`+horizon) to avoid alert storms.

### `inventory.lot_expired`
- **Status (2026-06-22): DEFERRED — NOT emitted in Phase 2.** Same reason as `lot_expiring`: produced by a scheduled expiry evaluator (background-job runner), which is later-phase infrastructure. Contract locked now; not in `DomainEventType`.
- **Producer (when built):** lot passes expiry.
- **Phase-2 consumer:** notifications; quarantine/blocked-from-sale state (per D4 policy).
- **Future consumers:** **P5 Accounting** (expired-stock write-off), **P12 Analytics** (waste KPI), **P8 Ecommerce** (delist).
- **Payload:** `{ lotId, skuId, locationId, expiryDate, qtyRemainingBase, unitCostMinor, currency, scale, occurredAt }`.
- **Required IDs:** lotId, skuId, locationId.
- **Notes/risks:** carries `unitCostMinor` so the eventual write-off value is known; whether sale is hard-blocked depends on the D4 per-tenant/category/product policy (override = audited `inventory.override_expiry`).

### `inventory.valuation_updated`
- **Producer:** the valuation step after any cost-affecting movement (receipt/issue/adjustment/revaluation).
- **Phase-2 consumer:** valuation read model / report.
- **Future consumers:** **P5 Accounting** (inventory-asset balance sync, COGS), **P12 Analytics** (margin, valuation roll-forward).
- **Payload (verified as-built):** `{ skuId, locationId, sourceMovementId, costingMethod, cogsMinor, currency, scale, unvaluedQty, occurredAt }`.
- **Required IDs:** skuId, locationId, sourceMovementId.
- **Notes/risks:** as-built the event carries the `ValuationResult` of the movement that triggered it — **`cogsMinor`** (value moved) + **`unvaluedQty`** (oversold units valued at zero, the D5 divergence). **DEFERRED enrichment:** the integer-truth fields `totalValueMinor` + `qtyOnHandBase` (which preserve the qty=0 ⟺ value=0 invariant for P5 inventory-asset balancing) and the display-only `derivedAvgCostMinor` are **not emitted yet** — `applyValuation`'s return (`ValuationResult`) does not expose post-movement on-hand value, so surfacing them needs a valuation-service return extension. Scheduled for the **Phase-5 valuation read-model** work (additive, version stays 1; consumers tolerate the later fields). Documented honestly rather than claimed.

### `inventory.revalued`
- **Producer:** `inventory.revalue` router (manual revaluation — AVCO total-value reset, or FIFO layer unit-cost correction).
- **Phase-2 consumer:** valuation read model; audit.
- **Future consumers:** **P5 Accounting** (revaluation adjustment to inventory-asset / revaluation reserve), **P12 Analytics** (valuation roll-forward, margin restatement).
- **Payload (verified as-built — two variants by costing method):**
  - **AVCO:** `{ method: "avco", skuId, locationId, reasonCode, totalValueMinor, currency, scale, occurredAt }`.
  - **FIFO:** `{ method: "fifo", skuId, locationId, fifoLayerId, reasonCode, unitCostMinor, currency, scale, occurredAt }`.
- **Required IDs:** skuId, locationId (+ `fifoLayerId` for the FIFO variant), actor (envelope/audit).
- **Notes/risks:** AVCO resets the SKU×location `total_value_minor` (integer truth, preserves qty=0 ⟺ value=0 — a zero-on-hand row is rejected unless value is also zero); FIFO corrects a single `valuation_layer.unit_cost_minor`. `reasonCode` is mandatory (audited). Money fields integer minor units; M3/#6 precision exposure applies (value moves without quantity).

### `inventory.stock_discrepancy_reviewed`
- **Producer:** `inventory.stockDiscrepancyReview` router (a manager resolves a flagged oversell/count discrepancy — D5 review limb).
- **Phase-2 consumer:** manager-review dashboard feed; audit.
- **Future consumers:** **P12 Analytics** (discrepancy-resolution rate, cashier-anomaly correlation §27), **P5 Accounting** (when the resolution is `adjusted` and posts a write-off).
- **Payload (verified as-built):** `{ skuId, locationId, resolution (count_requested|accepted|adjusted), notes, reviewedBy, occurredAt }`.
- **Required IDs:** skuId, locationId, reviewedBy (actor).
- **Notes/risks:** closes the loop opened by `inventory.stock_discrepancy` — pairs with it for the §27 shrinkage/anomaly chain. `resolution` is the manager's decision; `notes` is free text (nullable). No money field (the value correction, if any, flows through the follow-on `adjust`/`revalue`).

### `inventory.uom_converted`
- **Status (2026-06-22): DEFERRED / FOLDED — NOT emitted standalone in Phase 2.** The producer `convertUom` exists and runs, but (per the Notes/risks below, and a deliberate decision) it is a **pure helper returning a base-unit quantity** — the conversion context is already captured by the `received`/sale base-unit `qtyBase`, so emitting a separate event would be redundant. It is **folded into the receive/sale metadata** rather than emitted standalone. Contract locked here; not in `DomainEventType`. Revisit if a consumer ever needs the conversion as a first-class event.
- **Producer (if ever standalone):** UoM conversion service when a transaction unit differs from the base unit (receive/sale/transfer).
- **Phase-2 consumer:** (informational) — the ledger always stores base units; this records the conversion that happened at the edge.
- **Future consumers:** **P12 Analytics** (purchase-vs-sale unit mix), **P6 Procurement** (carton-vs-each buying), **P8 Ecommerce** (display unit).
- **Payload:** `{ skuId, fromUom, toUom, fromQty, toQtyBase, factor, factorScale, occurredAt }`.
- **Required IDs:** skuId.
- **Notes/risks:** factor stored as **integer ratio** (`factor`/`factorScale`, D2); a discrete-SKU conversion that isn't an exact integer in base units is **rejected upstream**, so this event only ever carries exact conversions. Lowest-value event — may be folded into `received`/sale metadata rather than emitted standalone (decide at implementation; documented here so the field shape is reserved).

## Consumer matrix (which later phase needs which event)

| Event | P5 Accounting | P6 Procurement | P8 Ecommerce | P10 Edge Hub | P12 Analytics |
|---|:--:|:--:|:--:|:--:|:--:|
| inventory.received | ✅ | ✅ | | ✅ | ✅ |
| inventory.cost_reconciliation | ✅ | | | | ✅ |
| inventory.adjusted | ✅ | | | ✅ | ✅ |
| inventory.count_started | | | | ✅ | ✅ |
| inventory.count_posted | ✅ | | | ✅ | ✅ |
| inventory.reorder_triggered | | ✅ | | | ✅ |
| inventory.stock_discrepancy | ✅ | | | ✅ | ✅ |
| inventory.lot_expiring | | ✅ | ✅ | | ✅ |
| inventory.lot_expired | ✅ | | ✅ | | ✅ |
| inventory.valuation_updated | ✅ | | | ✅ | ✅ |
| inventory.revalued | ✅ | | | | ✅ |
| inventory.stock_discrepancy_reviewed | ✅ | | | ✅ | ✅ |
| inventory.uom_converted (folded) | | ✅ | ✅ | | ✅ |

## Cross-cutting risks

- **Field-completeness:** every value-bearing event carries `*Minor` + `currency` + `scale` so P5 never recomputes money; every quantity is base-unit so units are unambiguous.
- **Versioning:** `version` starts at 1; add fields additively (consumers tolerate unknown fields). Breaking a payload requires a `version` bump + upcaster (§24).
- **Idempotency/replay:** events inherit the producing mutation's idempotency key; Edge Hub replay (P10) must dedupe on `(tenant_id, idempotency_key, type)`.
- **Server time:** `occurredAt` is server-set; never trust device clocks for ordering (§14).
