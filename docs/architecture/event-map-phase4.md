# Phase 4 — Domain Event Map (POS / Payments / Shifts / Offline)

- **Status:** PLAN / contract doc — **no code**. Purpose: lock event **payload shapes + required IDs now**, explicitly **shaped for the Phase-5 Accounting consumer** (the Phase-5 Codex review proved that POS events must carry COGS/tax/tender detail + stable reversal IDs, or the GL cannot post). Same discipline as `event-map-phase2.md`/`event-map-phase3.md`. This is the top Phase-4 readiness blocker (Task C) — it must be locked before POS implementation.
- **Transport:** transactional outbox (charter §24) — every event row written in the SAME tenant tx as the mutation (`emitEvent`). `occurredAt` is **server-injected** (last in the spread; device clocks untrusted, §14). Money = integer `*Minor` + `currency` + `scale`; quantities are **base-unit int8** (Decision #3).
- **Envelope (every event):** `id, type, version (default 1), tenant_id, correlation_id, request_id, payload (jsonb), status (pending), created_at`. Tenant-scoped, correlation/request-ID aware, versioned, replay-safe.
- **`DomainEventType` constants to ADD (Phase 4):** `sale.refunded`, `sale.voided`, `payment.received`, `shift.opened`, `shift.closed`. **`sale.created` already exists but is MINIMAL** (`{ saleId, number, totalMinor, currency }` — verified) and **must be EXTENDED** to the shape below. Do NOT enumerate an event nothing emits (Phase-2 lesson).

> **Consumer-idempotency contract (Phase-5 INV-P5-7, CRITICAL).** The outbox can REDELIVER. The accounting consumer dedups on **`(tenant_id, outbox_event_id, posting_kind)`** (UNIQUE), posting in the same tx as the journal; a replay returns the existing journal, never re-posts. Therefore every event below carries the data needed to post **deterministically from the event alone** (no re-reading mutable OLTP state at post time).

> **Ordering/parking contract (Phase-5 INV-P5-8).** Reversal events (`sale.refunded`/`sale.voided`) carry `originalSaleId`; if the consumer sees a reversal before its original sale is posted, it **parks** the event until the dependency posts. Hence the stable source/original IDs on every event.

> **Reserved-field discipline (Phase-2 lesson):** any field a later consumer will bind but Phase 4 can't yet populate is reserved **present-but-null**, never shipped absent. Money fields are `_minor`-suffixed; carry `currency` + `scale`.

## Event catalog

### `sale.created` — EXTEND (exists, minimal today)
- **Producer:** `pos.createSale` router.
- **Phase-4 consumer:** receipt; sales read model; audit. **Future:** **P5 Accounting** (revenue, tax-payable, inventory-asset↓/COGS, cash-clearing), P12 Analytics.
- **Payload (extended):** `{ saleId, number, locationId, companyId, shiftId, salesRepId, customerId, saleType: "sale", currency, scale, subtotalMinor, discountMinor, taxMinor, totalMinor, lines:[{ saleLineId, skuId, productId, lotId, qtyBase, qtyScale, unitPriceMinor, lineDiscountMinor, lineTaxMinor, taxRateId, cogsMinor, costingMethodApplied }], taxBreakdown:[{ taxRateId, rate, baseMinor, taxMinor }], tenders:[{ tenderId, method, tenderCurrency, tenderScale, amountMinor, fxRateToSale, settledAmountMinor }], offline:{ deviceId, terminalId, monotonicCounter, localTs, payloadVersion }, createdBy, occurredAt }`.
- **Required IDs:** saleId, locationId, companyId, per-line saleLineId + skuId, per-tender tenderId. `shiftId`/`salesRepId`/`customerId` reserved nullable (no shift/rep/customer captured ⇒ null). **`cogsMinor` per line drives the inventory-asset↓/COGS posting — populated because Phase 4 closes #8 (INV-P4-3 runs `applyValuation`); `costingMethodApplied` stamps which method valued it.** `taxBreakdown` drives VAT-payable per rate. `tenders[]` drives cash-clearing per tender (FX recorded). `lotId` nullable.
- **GL posting it drives (P5):** Dr cash-clearing/tender, Cr revenue (subtotal−discount), Cr VAT payable (per rate); Dr COGS, Cr inventory-asset (per line `cogsMinor`).

### `sale.refunded` — NEW
- **Producer:** `pos.refund` router (first-class return, `saleType="return"`, links `originalSaleId`).
- **Future consumer:** **P5 Accounting** (reverse revenue/tax/COGS proportionally), commission clawback (INV-P4-7/Decision #7), P12.
- **Payload:** `{ saleId, originalSaleId, number, locationId, companyId, shiftId, currency, scale, saleType: "return", subtotalMinor, discountMinor, taxMinor, totalMinor, lines:[{ saleLineId, originalSaleLineId, skuId, productId, lotId, qtyBase, unitPriceMinor, lineTaxMinor, taxRateId, cogsMinor, restockLocationId }], taxBreakdown:[...], tenders:[{ tenderId, method, amountMinor, currency, scale }], refundReason, refundedBy, occurredAt }`.
- **Required IDs:** saleId (the return doc), **`originalSaleId` (ordering/parking key)**, per-line `originalSaleLineId`. `cogsMinor` = value RESTOCKED to inventory (reverses COGS); `restockLocationId` reserved nullable (damaged-return ⇒ may not restock). Partial refunds carry only the refunded lines/qty.
- **GL posting it drives (P5):** reverse the proportional sale postings; restock inventory-asset at `cogsMinor`.

### `sale.voided` — NEW
- **Producer:** `pos.voidSale` router (whole-sale void; manager step-up, §22).
- **Future consumer:** **P5 Accounting** (full reversal if the sale was already posted), commission 100% clawback, P12.
- **Payload:** `{ saleId, originalSaleId, number, locationId, companyId, shiftId, currency, scale, totalMinor, voidReason, voidedBy, occurredAt }`.
- **Required IDs:** saleId, **`originalSaleId`** (= the voided sale's id; ordering key). A void is a full reversal — the consumer reverses the original sale's journal (or no-ops if never posted). Distinct from refund (partial, restock-aware).

### `payment.received` — NEW
- **Producer:** `pos` payment path (a tender settling against a sale; also standalone AR receipts later).
- **Future consumer:** **P5 Accounting** (cash/bank clearing → AR/revenue settlement), shift cash reconciliation, P12.
- **Payload:** `{ paymentId, saleId, shiftId, locationId, companyId, tenderId, method, tenderCurrency, tenderScale, amountMinor, fxRateToSale, settledAmountMinor, saleCurrency, saleScale, changeMinor, receivedBy, occurredAt }`.
- **Required IDs:** paymentId, tenderId, saleId (nullable only for non-sale receipts), shiftId. `fxRateToSale`/`settledAmountMinor` carry the FX so the GL posts realized FX at settlement (P5). `changeMinor` for cash.
- **GL posting it drives (P5):** Dr cash/bank, Cr cash-clearing (or AR); realized FX gain/loss line where `fxRateToSale` differs.

### `shift.opened` — NEW
- **Producer:** `pos.openShift` router.
- **Future consumer:** shift/X-Z read model; **P5** (cash-drawer float as a cash account movement); P12.
- **Payload:** `{ shiftId, terminalId, locationId, companyId, cashierUserId, openingFloat:[{ currency, scale, amountMinor }], openedAt, openedBy, occurredAt }`.
- **Required IDs:** shiftId, terminalId, locationId, cashierUserId. `openingFloat[]` is multi-currency (split drawers, §12).

### `shift.closed` — NEW
- **Producer:** `pos.closeShift` router (**blind close** — counted entered without seeing expected; system computes over/short).
- **Future consumer:** Z-report read model; **P5** (cash-drawer settlement to clearing; over/short to a shrinkage account); manager audit (§19/§22); P12.
- **Payload:** `{ shiftId, terminalId, locationId, companyId, cashierUserId, countedCash:[{ currency, scale, amountMinor }], expectedCash:[{ currency, scale, amountMinor }], overShort:[{ currency, scale, amountMinor }], cashMovements:[{ type, currency, scale, amountMinor }], zReportId, closedAt, closedBy, occurredAt }`.
- **Required IDs:** shiftId, zReportId. `expectedCash`/`overShort` are **system-computed** (blind close — the cashier never saw `expectedCash`); `overShort` drives the shrinkage posting + the manager audit signal. `cashMovements[]` = pay-ins/pay-outs/drops during the shift.

## What this map locks for Phase 5 (the consumer)

1. **Every posting field travels on the event** — `cogsMinor`, `taxBreakdown`, `tenders[]`/`fxRateToSale`, `overShort` — so the GL posts deterministically from the event without re-reading mutable OLTP (a precondition for idempotent replay, INV-P5-7).
2. **Stable source + reversal IDs** (`saleId`, `originalSaleId`, `paymentId`, `shiftId`) — the ordering/parking + dedup keys (INV-P5-8).
3. **Reserved-nullable** for what Phase 4 can't populate (`salesRepId`, `customerId`, `restockLocationId`) — present-but-null, additive later.
4. **Money is always the triple** (`*Minor` + `currency` + `scale`) and FX is carried at tender granularity — so Phase-5 multi-currency + realized-FX posting has its inputs.

> When Phase 4 is built, each emitted payload is locked by a contract test asserting the keys are PRESENT (the Phase-2 `toHaveProperty` discipline), so a refactor can't silently drop a field the GL consumer binds.
