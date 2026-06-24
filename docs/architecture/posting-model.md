# RetailOS — Posting Model (authoritative GL journal specification)

- **Status:** SOURCE-OF-TRUTH spec — **no code.** Created 2026-06-24 (owner-requested, after two consecutive event-map gates each surfaced a *new posting dimension* — functional-currency, then commission — proving the GL's journal impact was being reconstructed implicitly from scattered docs rather than enumerated once). This document is the single authoritative enumeration of **every journal RetailOS posts for every business transaction**. It is sourced **directly from the charter** (§17 fiscal, §18 inventory/valuation, §19 POS/commission/money/tax, §20 accounting) and the **locked decisions** — NOT from any one event map. It is the external spec that `event-map-phase{2,3,4}.md` (producers) and the Phase-5 GL + Phase-12 analytics (consumers) are all checked against.
- **Why it exists (the lesson):** an event-sourced GL has two separable concerns — (a) *what journals a transaction posts* (accounting truth, derivable from the charter alone) and (b) *whether the event carries the data to post them* (the contract). Conflating them let dimensions hide. This doc owns (a); the event maps are validated against it for (b). See `lessons-learned.md` "NEW STRUCTURAL CATEGORY" (2026-06-24).
- **Scope today:** the Phase-4 POS transactions (sale/refund/void/payment/stored-value/shift) plus the inventory/bond transactions (Phase 2/3) that feed the inventory-asset and duty accounts. Phase-5 builds the actual posting engine; this is its specification. Phase-6 procurement postings (GRNI/AP/landed-cost) are referenced where they intersect and will be fully enumerated in their own section when Phase 6 plans.

---

## 0. Universal posting conventions (apply to EVERY journal below)

These are the load-bearing rules every journal in this document obeys. They are the charter's money/accounting invariants (§19/§20/§25) plus the Phase-5 consumer invariants (`phase-5-implementation-plan.md` INV-P5-1..9).

- **C1 — Double-entry, always balanced (INV-P5-1).** Σ debits == Σ credits **per `(journal, currency, scale)`**. An unbalanced journal is rejected structurally (posting stored-proc / deferred-constraint trigger).
- **C2 — Functional currency (POST-1 / INV-P5-4).** The books post in ONE **functional currency** (tenant/company). Every posting line carries a **functional amount** (`*FunctionalMinor`) computed from the transaction amount × the **FX rate used**, where the rate is **server-stamped on the source event at transaction time** (never re-resolved). The journal balances **in functional currency**. An explicit **FX gain/loss** line is the balancing line where transaction-currency legs convert at different rates. Single-currency tenants: functional == transaction, identity rate (the Guyana zero-config default).
- **C3 — Money is integer minor units** (§19): `*Minor` + `currency` + `scale`; never floats; one rounding policy via the Phase-4 `mulDivRound` framework (configurable per currency/tax/jurisdiction, default per-line + half-even).
- **C4 — Perpetual inventory** (§18/§20): every stock movement posts to **Inventory Asset** at its valuation (AVCO/FIFO), and COGS is recognized **on issue** (sale/transfer-out), not on receipt. The inventory-asset GL balance reconciles to the stock-ledger valuation (`avg_cost`/`valuation_layer`).
- **C5 — Cash-clearing bridge** (§20 "POS cash clearing"): a sale posts revenue/tax against a **tender-clearing** (or AR) account; the **payment** later moves clearing → actual cash/bank. The clearing account nets to zero once both post. This decouples the sale's revenue recognition from the cash settlement (and is where realized FX lands).
- **C6 — Liabilities, not revenue, on stored-value issue** (§19): gift cards / store credit are a **liability** when issued; revenue is recognized by the **sale** they later tender.
- **C7 — Server-authoritative posting date** (§14/INV-P5-3): `posted_at = now()` (server); device/local time never posts. No posting into a **closed period** (INV-P5-2); reversals are **new append-only** entries (INV-P5-9), never edits of a posted journal.
- **C8 — Idempotent, order-safe consumption** (INV-P5-7/8): the GL is an event CONSUMER; it dedups on `(tenant_id, outbox_event_id, posting_kind)` (same tx as the journal) and **parks** an out-of-order event (e.g. refund-before-sale) until its dependency posts. Every posted journal traces to `source_outbox_event_id` + a source taxonomy (sale/refund/payment/inventory/transfer/bond/shift/stored_value/manual).
- **C9 — Tax-inclusive vs exclusive** (§19): both supported. The source event always carries `subtotalMinor` (net), `taxMinor`, `totalMinor` (gross) explicitly, so the posting is identical regardless of pricing mode.
- **C10 — Discount method** (§19): **net** by default (revenue = subtotal − discount). A **gross + contra-discount** policy is a tenant option; `discountMinor` is on the event either way, so either policy posts from the payload.

> **Account roles referenced below** (the COA template reserves these — Phase 5 §5 #4): Cash, Bank, Tender-Clearing, Drawer-Cash, Cash-Vault, Cash-Over/Short, Accounts-Receivable, Sales-Revenue, Output-VAT-Payable, Inventory-Asset (per location), COGS, Inventory-Shrinkage/Write-off, Inventory-Adjustment-Gain, Stored-Value-Liability, Commission-Expense, Commission-Payable, Duty-Payable, Customs-Clearing, GRNI (Goods-Received-Not-Invoiced), FX-Gain/Loss-Realized, Rounding-Difference.

---

## 1. `sale` — POS sale (event `sale.created`)

| Dr | Cr | Amount |
|---|---|---|
| Tender-Clearing (per tender) *(or AR for on-account)* | | `totalMinor` (gross, incl. tax) |
| | Sales-Revenue | `subtotalMinor − discountMinor` (net; §C10) |
| | Output-VAT-Payable (per `taxBreakdown[]` rate) | `taxMinor` per rate |
| COGS (per line) | | `lines[].cogsMinor` |
| | Inventory-Asset (per line, per location) | `lines[].cogsMinor` |
| Commission-Expense **(only if `commissionAccrualPolicy = at_sale`)** | | `commissionMinor` (Σ `lines[].lineCommissionMinor`) |
| | Commission-Payable (to `salesRepId`) | `commissionMinor` |

- **Balance check:** Tender-Clearing(`total`) = Revenue(`subtotal−discount`) + VAT(`tax`); COGS = Inventory; Commission-Expense = Commission-Payable. ✔ per currency (C1), in functional (C2).
- **Posting timing:** at sale posting, server time (C7). Synchronous-vs-async is Phase-5 decision #1.
- **Required event fields:** `subtotalMinor, discountMinor, taxMinor, totalMinor` + functional twins; `taxBreakdown[{ taxRateId, baseMinor, taxMinor, *FunctionalMinor }]`; `lines[{ cogsMinor, cogsCurrency, cogsScale, cogsFunctionalMinor, costingMethodApplied, lineCommissionMinor, lineCommissionFunctionalMinor }]`; `tenders[{ tenderId, amountMinor, fxRateToSale, settledAmountMinor, settledFunctionalMinor }]`; `commissionAccrualPolicy, commissionMinor, commissionFunctionalMinor, salesRepId`; `fxRateToFunctional`.
- **Reversal behavior:** by `sale.refunded` (partial, restock-aware) or `sale.voided` (whole, full reversal). Never edited.
- **FX behavior:** all lines post in functional via `fxRateToFunctional` (stamped at sale time). **No realized FX at sale** — the tender-clearing is booked at the sale rate; realized FX is recognized at **payment** (C5/§4) when the tender actually settles.
- **Commission behavior:** `at_sale` → accrue here (Dr Commission-Expense/Cr Commission-Payable). `at_settlement` → **null here**, accrued on `payment.received` (§4). Commission resolved from mutable rules ⇒ **stamped at sale time** (Decision #7).
- **Oversell (D5):** if a line sold from negative/unvalued stock, `cogsMinor = 0` ⇒ no COGS/inventory line for it; a Phase-5 **true-up** journal corrects when the stock is later valued. The `inventory.stock_discrepancy` event flags it.

---

## 2. `refund` — first-class return (event `sale.refunded`)

Reverses the **proportional** sale postings for the refunded lines/qty. Derives values from the **original** sale (via `originalSaleId`/`originalSaleLineId`), never re-resolves.

| Dr | Cr | Amount |
|---|---|---|
| Sales-Revenue (reversal) | | refunded `subtotalMinor − discountMinor` |
| Output-VAT-Payable (reversal, per rate) | | refunded `taxMinor` |
| | Tender-Clearing (per refund tender) *(or AR)* | refunded `totalMinor` |
| Inventory-Asset (restock, per line) | | `lines[].restockedValueMinor` |
| | COGS (reversal) | `lines[].restockedValueMinor` |
| Commission-Payable **(if `at_sale`)** | | `commissionClawbackMinor` |
| | Commission-Expense (reversal) | `commissionClawbackMinor` |

- **Posting timing:** at refund (server time).
- **Required event fields:** refunded `subtotal/discount/tax/totalMinor` + twins; `taxBreakdown[]`; `lines[{ originalSaleLineId, restockedValueMinor, restockedValueFunctionalMinor, costingMethodApplied, restockLocationId, lineCommissionClawbackMinor }]`; `tenders[]`; `commissionAccrualPolicy, commissionClawbackMinor`.
- **Reversal behavior:** this IS a reversal (append-only; reverses the original proportionally).
- **FX behavior:** the merchandise reversal (revenue/VAT/COGS/inventory) reuses the **original sale's stamped rate** (`fxRateToFunctional` from the original) — a pure reversal must NOT re-quote, else it posts a spurious FX gain/loss. The **refund tender** settlement may carry its own realized FX (refunding at a different rate) — that lands on the refund's payment leg, not the merchandise reversal.
- **Commission behavior:** `at_sale` → claw back `commissionClawbackMinor`, **derived from the original line's stamped `lineCommissionMinor`, proportional to refunded qty** (never re-resolve rules). `at_settlement` → null (handled on the payment reversal).
- **Damaged return (no restock):** `restockLocationId = null`, `restockedValueMinor = 0` ⇒ **no inventory-restock / COGS-reversal lines** (the goods are written off — the COGS stays as expense). Revenue/VAT still reverse (customer is refunded).
- **Partial refund:** only the refunded lines/qty are carried; amounts are the proportional share.

---

## 3. `void` — whole-sale void (event `sale.voided`)

A void is a **full 1:1 reversal of the entire original sale journal** — every line in §1 reversed, including the commission accrual. Distinct from refund (no partial, no restock-value logic — inventory returns at the original cost via the reversal).

| Dr | Cr | Amount |
|---|---|---|
| *(exact reversal of every §1 line for the original sale)* | | original amounts |

- **Posting timing:** at void (server time). **If the original sale was never posted** (voided before the GL processed it) ⇒ **no-op** (the consumer parks/cancels).
- **Required event fields:** `saleId`, `originalSaleId` (the ordering/parking key), `totalMinor`. **No line/amount detail needed** — the consumer reverses the **parked original journal**, not mutable sale rows (this is why `sale.voided` needs no functional twins — it inherits the original's amounts).
- **Reversal / FX / commission behavior:** all inherited from the original journal's reversal (commission 100% clawed back as part of reversing the original accrual line). Replay-safe via `originalSaleId`.

---

## 4. `payment` — tender settlement (event `payment.received`)

Moves the sale's **tender-clearing → actual cash/bank** (C5), and is where **realized FX** is recognized.

| Dr | Cr | Amount |
|---|---|---|
| Cash / Bank | | `settledAmountMinor` (tender → functional via `tenderFxRateToFunctional`) |
| | Tender-Clearing *(or AR for on-account settlement)* | the clearing amount the sale booked |
| FX-Gain/Loss-Realized | | `realizedFxGainLossFunctionalMinor` (Dr loss / Cr gain) when tender settles at a different rate than the sale booked |
| Commission-Expense **(only if `commissionAccrualPolicy = at_settlement`)** | | `commissionMinor` (proportional to settled) |
| | Commission-Payable | `commissionMinor` |

- **Posting timing:** at payment receipt (server time). For a cash sale settled immediately, §1 + §4 post together and Tender-Clearing nets zero.
- **Required event fields:** `paymentId, tenderId, saleId, amountMinor, fxRateToSale, settledAmountMinor, settledFunctionalMinor, changeMinor, changeFunctionalMinor, tenderFxRateToFunctional, realizedFxGainLossFunctionalMinor, commissionAccrualPolicy, commissionMinor, commissionFunctionalMinor`.
- **Reversal behavior:** a refund's tender leg (cash back) or a payment reversal; append-only.
- **FX behavior:** **this is the realized-FX posting point.** The tender-clearing was booked at the sale rate; the cash/bank settles at the tender rate; the difference is `realizedFxGainLossFunctionalMinor`.
- **Commission behavior:** `at_settlement` → accrue here, proportional to the settled amount (stamped at settlement). Cancellation/refund of the settlement reverses the accrual. `at_sale` → null here.
- **Change (cash):** `changeMinor` is cash returned to the customer (reduces the net cash Dr). Non-sale AR receipts: `saleId = null`, Cr Accounts-Receivable.

---

## 5. `stored_value.issued` — gift card / store credit issued

| Dr | Cr | Amount |
|---|---|---|
| Tender-Clearing *(gift card SOLD — the tender paid for it)* **or** Sales-Returns/refund-contra *(store credit granted in lieu of cash refund)* | | `amountMinor` |
| | Stored-Value-Liability | `amountMinor` |

- **Posting timing:** at issue. **No revenue recognized** (C6).
- **Required event fields:** `storedValueId, storedValueAccountId, movementId, kind, amountMinor, currency, scale, fxRateToFunctional, amountFunctionalMinor, saleId, paymentId, tenderId`.
- **Reversal behavior:** gift-card cancellation reverses the liability (rare; audited).
- **FX behavior:** liability posts in functional via `fxRateToFunctional`. **Commission:** none.
- **Debit-side resolution:** by a **stable, versioned account-mapping by `kind`** (gift_card vs store_credit) + nullable `saleId`/`paymentId` — an immutable-config lookup, not a mutable-OLTP re-read.

---

## 6. `stored_value.redeemed` — gift card / store credit redeemed

| Dr | Cr | Amount |
|---|---|---|
| Stored-Value-Liability | | `amountMinor` (draw down) |
| | Tender-Clearing | `amountMinor` (settles the sale's tender leg) |

- **Posting timing:** at redemption (concurrent with the `sale.created` it tenders). **Revenue is recognized by the linked sale, NOT here** (C6).
- **Required event fields:** `storedValueId, storedValueAccountId, movementId, kind, saleId, paymentId, tenderId, amountMinor, fxRateToFunctional, amountFunctionalMinor`.
- **Reversal / FX:** liability drawdown reverses on a refunded redemption; functional via `fxRateToFunctional`. **Balance never goes negative** (audited). **Commission:** none.

---

## 7. `shift.opened` — drawer float issued

| Dr | Cr | Amount |
|---|---|---|
| Drawer-Cash (terminal/shift sub-account) — per currency | | `openingFloat[].amountMinor` |
| | Cash-Vault — per currency | `openingFloat[].amountMinor` |

- **Posting timing:** at shift open. A transfer of float from the vault to the drawer (no P&L impact).
- **Required event fields:** `shiftId, terminalId, cashierUserId, openingFloat[{ currency, scale, amountMinor, fxRateToFunctional, functionalAmountMinor }]`.
- **FX:** per-row functional twin (multi-currency drawer). **Reversal:** balanced at close (§8). **Commission:** none.

---

## 8. `shift.closed` — blind drawer close + over/short

| Dr | Cr | Amount |
|---|---|---|
| Cash-Vault (counted cash returned) — per currency | | `countedCash[].amountMinor` |
| | Drawer-Cash (clear the drawer) — per currency | `expectedCash[].amountMinor` |
| Cash-Over/Short *(if short)* **or** (Cr if over) | | `overShort[].amountMinor` (= counted − expected) |
| *(per `cashMovements[]`: pay-in Dr Drawer / Cr source; pay-out/drop Cr Drawer / Dr dest)* | | `cashMovements[].amountMinor` |

- **Balance check:** counted (to vault) + over/short = expected (cleared from drawer), per currency. ✔
- **Posting timing:** at close. **Blind close:** the cashier enters `countedCash` without seeing `expectedCash`; the system computes `expectedCash` and `overShort` (= counted − expected). `overShort` drives the shrinkage posting **and** the manager audit signal (§19/§22).
- **Required event fields:** `shiftId, zReportId, countedCash[], expectedCash[], overShort[], cashMovements[]` — each row with `{ currency, scale, amountMinor, fxRateToFunctional, functionalAmountMinor }`.
- **FX:** per-row twin (each drawer/over-short/movement row independently multi-currency). **Reversal:** corrections are new entries. **Commission:** none.

---

## 9. `inventory.adjusted` — stock adjustment (Phase 2 producer)

| Dr | Cr | Amount |
|---|---|---|
| Inventory-Shrinkage/Write-off Expense *(negative adj / loss)* | | `cogsMinor` |
| | Inventory-Asset | `cogsMinor` |
| Inventory-Asset *(positive adj / found stock)* | | `cogsMinor` |
| | Inventory-Adjustment-Gain | `cogsMinor` |

- **Posting timing:** at adjustment posting (approved). **Event fields:** `skuId, cogsMinor, currency, scale, approvedBy` + functional twin. **FX:** functional. **Reversal:** correcting adjustment (append-only). **D5 oversell:** unvalued ⇒ `cogsMinor = 0`, true-up later.

---

## 10. `inventory.received` — stock receipt (Phase 2/6 producer)

| Dr | Cr | Amount |
|---|---|---|
| Inventory-Asset (per location) | | `unitCostMinor × qtyBase` |
| | GRNI / Inventory-Receipt-Clearing / Opening-Balance-Equity *(per source: procurement GRN vs direct/opening)* | same |

- **Posting timing:** at receipt. **Event fields:** `skuId, qtyBase, unitCostMinor, currency, scale, lotId` + functional. **COGS:** not here (C4 — recognized on issue). The Cr side depends on origin (Phase-6 GRN ⇒ GRNI; opening stock ⇒ Opening-Balance-Equity). **Commission:** none.

---

## 11. `inventory.bond_released` — bonded → released + duty (Phase 3 producer)

| Dr | Cr | Amount |
|---|---|---|
| Inventory-Asset (released location) | | `releasedValueMinor` *(merchandise value moves, conserved)* |
| | Inventory-Asset (bonded location) | `releasedValueMinor` |
| Inventory-Asset (released, landed-cost add) | | `dutyMinor + taxMinor` |
| | Duty-Payable / Customs-Clearing | `dutyMinor` |
| | Output-VAT/Import-Tax-Payable | `taxMinor` |

- **Posting timing:** at bond release (approved, RBAC-immediate). **Event fields:** `bondReleaseId, transferId, releasedValueMinor, dutyMinor, taxMinor` + functional. **FX:** AVCO-only in Phase 3. **Reversal:** bond-release reversal. **Note:** the merchandise move is value-conserving (INV-2); the duty/tax is an additive value-only adjustment (INV-5).

---

## 12. Transactions enumerated and CLASSIFIED out of scope (so this model is provably complete)

To make POST-2 (posting completeness) checkable, every transaction the charter implies is either enumerated above or classified here with a reason — so a later gate cannot "discover" a dimension this model silently omitted:

- **Loyalty accrual / redemption** (§21 CRM): a points liability accrues on sale, draws down on redemption — **Phase-7 scope**. Reserved there; the `sale.created` event will gain loyalty fields when Phase 7 plans. NOT a Phase-4 posting.
- **Tips / gratuity** (§19 restaurant patterns): a tips-payable liability — **restaurant scope, not retail Phase 4**. Out of scope.
- **Supplier bill / AP / landed-cost allocation / PPV** (§20/§18 procurement): GRNI → AP, three-way-match variance, freight/duty clearing — **Phase-6 scope** (`event-map-phase6`); §10/§11 above name the inventory-asset/GRNI/duty intersection points.
- **Bank reconciliation, period close, year-end retained-earnings roll, FX revaluation (unrealized)** (§20): **Phase-5 internal** GL operations, not event-driven POS postings.
- **Asset capitalization / depreciation** (§21): **Phase-13 / asset module**; the `stock_ledger.source_type` seam reserves the provenance.
- **Manufacturing/assembly build/disassembly** (§21): component-issue → finished-goods receipt; **future module**; reuses §9/§10 inventory-asset patterns.

---

## 13. How this model is used (the validation loop)

- **Producers** (`event-map-phase{2,3,4}.md`): every journal-line amount in §1–§11 must be **carried on the producing event** (POST-1 quintuple) or explicitly **reserved-nullable/deferred**. The event maps are checked against THIS doc, not re-derived.
- **Consumer** (Phase-5 GL): implements the posting engine to THIS spec; the `accounting_processed_event` dedup + parking guarantee idempotent/ordered application (C8).
- **Analytics** (Phase-12): margin/COGS/tax read models derive from the same account roles.
- **On any change:** update THIS doc first (it is source of truth), then the affected event map + cross-phase map in the same pass. A posting dimension added here that an event can't yet carry is reserved-nullable on the event, never shipped absent.
