# RetailOS — Cross-Phase Dependency Map

- **Status:** PLAN / master contract map — **no code.** Created 2026-06-23 (owner-requested). Purpose: make every producer→consumer relationship explicit so a later phase never **discovers a missing field late** (the failure the Phase-5 review exposed: POS events that the GL cannot consume). This is the authoritative index for outbox events, accounting projections, analytics, CRM, procurement, and Edge Hub sync.
- **Source of truth per event:** the `event-map-phase{2,3,4}.md` catalogs (and future `event-map-phase{5,6}.md`). This file is the **cross-phase index**; the per-phase maps hold the full payloads.
- **Transport (all):** transactional outbox (§24), tenant-scoped, server-injected `occurredAt`, replay-safe. **Consumer idempotency is mandatory** (Phase-5 INV-P5-7): a consumer dedups on `(tenant_id, outbox_event_id, posting_kind)` — the outbox redelivers, so no consumer may post twice.

## Legend

Each dependency: **Producer (phase/module)** → **Event** → **Consumer (phase)** | **Required fields the consumer binds** | **Blocking risk** | **Deferred/reserved fields**.

## 1. Inventory value chain → Accounting (the load-bearing GL feed)

| Producer | Event | Consumer | Required fields | Blocking risk | Deferred/reserved |
|---|---|---|---|---|---|
| P2 Inventory | `inventory.received` | P5 (inventory-asset Dr), P12 | skuId, qtyBase, unitCostMinor, currency, scale, lotId | — | serialIds (null) |
| P2 Inventory | `inventory.adjusted` | P5 (shrinkage/write-off), P12 | skuId, cogsMinor, currency, scale | oversell D5 ⇒ COGS=0/unvalued (true-up) | approvedBy (null) |
| P2 Inventory | `inventory.valuation_updated` | P5 (inventory-asset ↔ GL reconciliation, INV-P5-5) | skuId, **totalValueMinor**, **qtyOnHandBase**, currency, scale | **CRITICAL: emits null today** — P5 reconciliation not computable until these bind (depends on P4 closing #8) | totalValueMinor / qtyOnHandBase (reserved null) |
| P2 Inventory | `inventory.cost_reconciliation` | P5 (COGS true-up) | skuId, varianceMinor | **emit wiring deferred** (Phase-2 parked → P4/#8) | whole event reserved |
| P2 Inventory | `inventory.count_posted` | P5, P12 | skuId, baseMinor deltas | — | — |
| P2 Inventory | `inventory.stock_discrepancy` | P4 manager alert, P5 | skuId, qty, locationId | product-level until #8 (P4) | — |
| P3 Transfers | `inventory.transfer_dispatched/received/cancelled` | P5 (in-transit asset move; inter-company GL is P5), P12 | transferId, sku, releasedValueMinor/receivedValueMinor (conserved) | intra-company only (inter-company needs P5 due-to/due-from) | varianceQtyBase (0) |
| P3 Bonds | `inventory.bond_received` | P6 (PO/GRN reconciliation), P5 (bonded-asset vs GRNI), P12 | bondReceiptId, sku, unitCostMinor, customsRef, landedCostRef | customsRef/landedCostRef are reference seams (no allocation) | customs/landed refs (null) |
| P3 Bonds | `inventory.bond_released` | P5 (duty/landed-cost posting), P6, P12 | bondReleaseId, transferId, releasedValueMinor, dutyMinor, taxMinor | AVCO-only in P3 (FIFO bonded rejected) | requestedBy/approvedBy (null, RBAC-immediate) |

## 2. POS → Accounting / CRM / Edge Hub (Phase 4 producers)

> Full shapes in `event-map-phase4.md` (shaped for the P5 consumer). Risk common to all: the **refund/void/payment/shift event TYPES do not exist yet** — `event-map-phase4` must lock them before POS code, or P4 builds contracts P5 cannot consume.
>
> **Functional-currency carriage (consumer-completeness gate, 2026-06-24).** The GL posts in the tenant/company **functional currency**; the POS events carry only `fxRateToSale` (tender→sale), so all 7 financial P4 events now **reserve (nullable)** a functional-currency context (`functionalCurrency`, `functionalScale`, server-stamped `fxRateToFunctional`) + a `*FunctionalMinor` twin beside every posting amount (per-row on the multi-currency shift drawers). `sale.voided` is exempt (parks on the original journal). **Sequencing constraint:** a historical FX rate **cannot be backfilled**, so a tenant must not run **multi-currency** POS in production until the producer stamps `fxRateToFunctional` — which needs only a `functional_currency` setting + spot-rate capture (a small P4 seam), NOT the full Phase-5 FX-revaluation model. **Single-currency tenants are unaffected** (functional == transaction, identity rate, zero setup). This couples to the open Phase-5 **functional-currency model** decision (§5 #3) — Phase 4 reserves the seam; Phase 5 locks the model.

| Producer | Event | Consumer | Required fields | Blocking risk | Deferred/reserved |
|---|---|---|---|---|---|
| P4 POS | `sale.created` (EXTEND) | **P5** (revenue/VAT/COGS/cash-clearing), P7 CRM (purchase history), P10 Edge Hub, P12 | lines[ sku, qtyBase, unitPriceMinor, lineTaxMinor, **cogsMinor**, costingMethodApplied ], taxBreakdown[], tenders[], shiftId, customerId | **minimal today** — must extend; `cogsMinor` needs #8 closed (P4) | salesRepId, customerId, lotId (null) |
| P4 POS | `sale.refunded` | P5 (proportional reversal), commission clawback, P12 | saleId, **originalSaleId**, lines[ originalSaleLineId, **restockedValueMinor**+cogsCurrency+cogsScale, restockLocationId ] | ordering (refund-before-sale) → P5 parks; restocked value derived from the original line's posted COGS | restockLocationId (null) |
| P4 POS | `sale.voided` | P5 (full reversal), commission clawback | saleId, **originalSaleId** | ordering/parking | — |
| P4 POS | `payment.received` | P5 (cash/bank clearing, realized FX), P10 | paymentId, tenderId, amountMinor, fxRateToSale, settledAmountMinor | FX rate must be on the event | saleId (null for non-sale receipts) |
| P4 POS | `shift.opened` / `shift.closed` | P5 (cash account + over/short shrinkage), P12 | shiftId, openingFloat[], countedCash[], expectedCash[], overShort[] | blind close: `expectedCash` system-computed | zReportId |
| P4 POS | `stored_value.issued` / `stored_value.redeemed` | **P5** (gift-card/store-credit **LIABILITY** on issue, draw-down on redemption — §19), P12 | storedValueId, storedValueAccountId, movementId, kind, amountMinor+currency+scale, saleId | liability NOT revenue on issue; balance never negative | saleId/customerId (null where N/A) |

## 3. Procurement → Accounting (Phase 6 producers)

> Full shapes in a future `event-map-phase6.md`. P6 must EMIT (not call P5 services) — P5 is an idempotent consumer.

| Producer | Event | Consumer | Required fields | Blocking risk | Deferred/reserved |
|---|---|---|---|---|---|
| P6 Procurement | `procurement.grn_received` | P5 (GRNI / inventory-asset), P12 | grnId, poId, sku, qtyBase, valueMinor | reuse valued-receipt primitive (sep. wrappers, INV-P6-5) | — |
| P6 Procurement | `supplier_bill.posted` | P5 (AP), P12 | billId, supplierId, currency, amountMinor | three-way-match variance | — |
| P6 Procurement | `supplier_payment.recorded` | P5 (AP settlement, realized FX) | paymentId, billId, fxRate | multi-currency (P6 Decision #3) | — |
| P6 Procurement | `landed_cost.allocated` | P5 (freight-clearing / duty-payable), P2 cost basis | costPoolId, **payableAccountSource**, clearingAccountRole, per-line inventoryValueDelta, variance/rounding line | FIFO allocation still THROWS (P6 Decision #1) | — |
| P6 Procurement | `purchase_price_variance.flagged` | P5 (PPV), P12 | poLineId, varianceMinor | — | — |

## 4. Reverse/control dependencies

- **P4 → P2/P3 valuation engine:** POS sale deduction MUST call `applyValuation` (closes #8) — without it, COGS=0, FIFO layers don't consume, AVCO diverges (INV-P4-3). Hard prerequisite for §1 row `valuation_updated`.
- **P5 ← P4 `#6 mulDivRound`:** the rounding-policy framework + BigInt primitive lands in **P4 commit 1**; P5 and P6 reuse it (no re-spec). FX/tax/allocation all divide.
- **P8 Ecommerce ↔ P4 POS:** shared inventory ledger + **reservations** (see reserved seam below) — never a separate ecommerce inventory (§21/§33).
- **P10 Edge Hub ← P4:** offline sale/payment/shift events sync upstream with `(device, terminal, monotonicCounter)` ordering (INV-P4-9).

## 5. Reserved future-proofing seams (owner-requested 2026-06-23)

These are **documented reservations** — schema is NOT changed now (Phase 2/3 are frozen; these land as **expand-only additive** columns in the phase noted). Capturing them here so a later phase doesn't redesign.

| Seam | Reserved fields | Why / consumer | Lands in (expand-only) |
|---|---|---|---|
| **Stock-movement provenance** | `stock_ledger.source_type` (purchase_receipt \| transfer \| bond_release \| adjustment \| manufacturing \| asset_capitalization), `stock_ledger.source_id` | Lets future modules (manufacturing/BOM, fixed-asset capitalization) trace a movement to its origin without redesign; complements the P5 `journal` source taxonomy | P4/P5 (additive nullable; backfill `source_type` from `movement_type`) |
| **Location geodata** | `location.latitude/longitude/address_line_1/address_line_2/city/region/country/postal_code` | Delivery routing, branch lookup, warehouse optimization, mobile workforce, future dispatch (not maps today) | P4+ (additive nullable on the `location` tree) |
| **Physical vs logical location class** | `location.location_class` (physical: warehouse/store/bond/shelf/bin · logical: in_transit/quarantine/damaged/lost/returns_holding) | Phase-3 already has `is_transit`/`is_quarantine` flags; a single `location_class` makes the physical/logical split first-class for reporting/picking | P4+ (derive initial value from existing flags; additive) |
| **Inventory ownership class** | `inventory_class` (own_sellable \| bonded \| transit \| quarantine \| **consignment** \| **vendor_owned** \| **customer_owned**) — on the stock cell / ledger, distinct from `location_class` | Consignment inventory, vendor-managed inventory (VMI), and repair/customer-owned stock must NOT post to the tenant's inventory-asset GL the same way owned stock does — the ownership class gates valuation/GL treatment | P6/P7+ (additive; default `own_sellable` derived from current behaviour). Cheap to reserve now, expensive to retrofit once GL posts against stock |
| **Inventory reservations** | `reserved_qty`, `reserved_value` (concept; likely a `stock_reservation` ledger, not a column) | POS hold/park, warehouse picking, ecommerce cart hold — all need reservations against available stock (§13/§18/§21) | P4 (POS holds) → P8 (ecommerce); reserve the concept now |
| **Barcode architecture** | `barcode_type` (EAN13/UPC/GS1/weighted-scale/pharmacy/serial), `barcode_value`, `parsing_profile` | Not just a flat `barcode` — weighted-scale labels (§18 supermarket) and GS1/serial parsing need a typed/parsed model | P4 (POS scan) — extend the Phase-2 catalog barcode additively |
| **Functional currency** | `company.functional_currency` (+ `functional_scale`) + a spot FX-rate capture at transaction time | The GL posts in functional currency (INV-P5-4); the rate must be **stamped on the event at txn time** (irreproducible later) so P5 posts deterministically (INV-P5-7). This is the **minimal** seam — NOT the full Phase-5 FX-revaluation model | P4 (additive nullable on `company`; null ⇒ single-currency, functional == transaction). Couples to open P5 functional-currency decision (§5 #3) |

> **UI design rules (owner-requested) — tracked separately:** the design-language rules (never show raw UUIDs → show `SKU-00124`; consistent primary/secondary/search/filter placement; timeline-first for ledgers/audit/approvals; KPI cards = value+trend+comparison+drilldown; global Comfortable/Compact/Dense density toggle) belong to the **design-language skill / PR #12**, not this dependency map. Flagged here so they are not lost; fold into that track.

## 6. How to use this map

- **Before building any phase:** read its row(s) here, confirm every "Required field" is actually emitted by the producer (the #8 "write path must invoke the producer" discipline), and that deferred fields are reserved **nullable**, not absent.
- **When adding an event:** add a row here AND the full payload to the phase's `event-map`. A consumer that needs a field the producer doesn't emit is a cross-phase break — catch it here, not in implementation.
- **Analytics (P12) and CRM (P7)** consume broadly; they are listed as consumers above but their specific projections are defined when those phases plan.
