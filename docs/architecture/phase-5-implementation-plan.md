# Phase 5 — Accounting Foundation — Plan SKELETON (DRAFT for review)

> **STATUS: PLANNING SKELETON — HARDENED by Codex review (2026-06-23) — NOT APPROVED, NO CODE.** Research complete + adversarial Codex GL review folded in (§7). Decisions are Kareem's to lock; this is the highest-stakes design in the project (a wrong GL posting/idempotency/period model corrupts the books). Hardening a plan is NOT authorization to build.

## Confidence

- **MEDIUM** (skeleton). Grounded in the **charter §20** (authoritative in-repo accounting requirements) and the **codebase** (verified: NO accounting/journal/COA/ledger-account schema exists yet → Phase 5 builds from scratch on the existing money/outbox/RLS foundation).
- **THIS PLAN ASSUMES:** money stays integer minor units + currency + scale; double-entry from day one; Phases 2–4 (inventory ledger, COGS-bearing valuation, POS cash) merge first and feed accounting via domain events (outbox), not direct coupling.
- **✅ RESEARCH COMPLETE (2026-06-23):** competitive matrix (QuickBooks/Xero/Zoho Books/Sage) + Guyana/GRA tax-filing specifics filled in `competitive/accounting.md`. Headline: match **Xero** (not QBO) on multi-currency (P0 for §12, not an upsell); the **inventory↔GL perpetual-COGS tie via event projections** is RetailOS's structural edge; Guyana VAT = **Form G0002**, monthly, due 21st (rate 14%); corporate tax 40% commercial / 25% non-commercial.

## 1. Scope (charter §31 Phase 5 / §20)

Chart of accounts, general ledger, journal entries, AP, AR, invoices, supplier bills, vendor/customer payments, bank + cash accounts, POS cash clearing, inventory-asset + COGS + sales-revenue + tax/VAT/duty payable accounts, freight clearing, landed-cost allocation accounts, expenses, P&L / balance sheet / cash flow / trial balance, multi-currency + FX revaluation (realized/unrealized gain-loss), approvals, posting periods, period close, audit-ready trail. Gift-card/store-credit liabilities (issued in Phase 4) recognized on redemption.

## 2. Codebase grounding (verified)

- **No accounting tables exist.** Build `ledger_account` (COA), `journal`/`journal_line` (double-entry), `posting_period`, AR/AP sub-ledgers, `bank_account`, FX rate table.
- **Feed from events, not coupling (charter §24):** Phase 2/3/4 already emit `inventory.received/adjusted/valuation_updated`, `inventory.transfer_*`, `inventory.bond_released`, `sale.created/refunded/voided`, `payment.received`. Phase 5 adds **accounting projections** that subscribe to these to auto-post (inventory asset/COGS on sale, duty payable on bond release, cash clearing on POS payment). This is the load-bearing design choice: accounting is a CONSUMER of the event stream, keeping OLTP and GL decoupled (§27 — don't run analytics/posting on OLTP checkout tables synchronously).
- **`#6` BigInt `mulDivRound` is a HARD blocker here** (charter money rule + this plan): FX conversion, tax, and proportional allocation all divide — must land the chosen rounding policy + BigInt math before posting math.

## 3. Load-bearing invariants

- **INV-P5-1 — every journal balances:** Σ debits == Σ credits **per `(journal, currency, scale)`**; unbalanced rejected. Enforced **structurally** (a row-level CHECK can't sum child lines): a **deferred-constraint trigger or a posting stored-procedure validates the sum before flipping status to `posted`** (charter §26 unbalanced-journal rejection test). *(Codex HIGH-5.)*
- **INV-P5-2 — period close is immutable:** no posting into a closed period; reversals are new entries. **Structural:** journal header carries `posting_period_id`; a DB trigger/stored-proc **rejects posting into a `closed` period**; a late event routes to the next open period or an approval workflow with reversal semantics. *(Codex HIGH-6.)*
- **INV-P5-3 — server-authoritative posting date** (§14): journal header `posted_at DEFAULT now()` (never caller-supplied); device/local time never posts. *(Codex HIGH-6.)*
- **INV-P5-4 — money is currency-explicit** (the ADR-0008 triple): multi-currency entries carry per-line currency + the FX rate used **AND a functional-currency base amount** per line; balance holds per-currency, with an explicit **FX gain/loss / balancing-line** journal model. Realized/unrealized gain-loss is its own posting. **These inputs are carried ON the Phase-4 events** — the consumer-completeness gate (2026-06-24) added reserved-nullable `functionalCurrency`/`functionalScale`/`fxRateToFunctional` (server-stamped at txn time) + `*FunctionalMinor` twins to all 7 financial P4 events (`event-map-phase4.md`), so the GL posts in functional currency **without re-reading a mutable FX-rate table** (the INV-P5-7 precondition). Phase 5 locks the **functional-currency model** (§5 #3); Phase 4 reserves the `company.functional_currency` seam + rate capture. *(Codex HIGH-5; consumer-completeness gate.)*
- **INV-P5-5 — inventory ↔ GL reconciliation (depends on Phase-4 #8):** the inventory-asset account balance reconciles to the stock-ledger valuation (`avg_cost`/`valuation_layer` totals). **This is only computable once Phase 4 closes #8 (POS↔costing wiring) AND `inventory.valuation_updated` binds its reserved-nullable `totalValueMinor`/`qtyOnHandBase` AND `inventory.cost_reconciliation` is emitted** (all currently deferred — verified: the event emits `null` today). Reconciliation queries are defined per currency/account/location/SKU and must handle the **D5 oversell case** (negative/unvalued stock, COGS=0) with explicit **true-up journals**. Divergence is a data-quality alert (§26). *(Codex CRITICAL-3.)*
- **INV-P5-6 — auditor package (§25):** a fiscal-year export (journals, GL, stock ledger, tax docs, audit logs) that is tamper-evident (hash manifest + signature), gated by `audit.export`. Extended with the **Guyana tax-period model** (monthly VAT, due 21st) and a **VAT Form G0002 read-model/export** (output VAT, input VAT, net payable). *(Codex MEDIUM-10.)*
- **INV-P5-7 — idempotent event posting (the GL #8-class analogue, CRITICAL):** GL posting is a **CONSUMER** of outbox events, and the outbox can **redeliver** — yet `outbox_event` has **no consumer/checkpoint state today** (verified: producer-only). Without a dedup key, a replayed `sale.created` double-posts COGS/revenue. **Required:** an `accounting_processed_event(tenant_id, outbox_event_id, posting_kind)` table with a **UNIQUE** constraint (or `journal.source_outbox_event_id` unique), written **in the same tx as the journal**; replay returns the existing journal, never re-posts. Reuse the proven `(tenant, key)` producer-idempotency pattern on the consumer side. *(Codex CRITICAL-1.)*
- **INV-P5-8 — event ordering & dependency (CRITICAL):** consumed events (`sale.created/refunded/voided`, `payment.received`, the inventory/transfer/bond value events) must carry **stable source IDs + reversal/original-sale refs**; the consumer must **park an out-of-order event** (e.g. a refund arriving before its sale) until its dependency is posted, then drain. **NB: these event TYPES + rich payloads do not exist yet — only `sale.created` (minimal) is defined; they are a Phase-4 deliverable (`event-map-phase4`), so Phase 4's contracts must be shaped for this consumer.** *(Codex CRITICAL-2 — cross-phase.)*
- **INV-P5-9 — source traceability & append-only reversals:** every auto-posted journal traces to its originating event (`source_outbox_event_id`) + a **journal source taxonomy** (sale/refund/payment/inventory/transfer/bond/manual/opening/close); reversals and backfills are **append-only** (no edit/delete of a posted journal); AR/AP **sub-ledger balances tie out to their control accounts** (a reconciliation invariant). *(Codex MEDIUM-8.)*

## 4. Proposed build order (commits) — to refine after research

1. COA + `ledger_account` + `posting_period` + the double-entry `journal`/`journal_line` core, with the **balance trigger** (INV-P5-1), `posted_at DEFAULT now()` + `posting_period_id` + the **closed-period rejection trigger** (INV-P5-2/3), functional-currency base amounts (INV-P5-4), and the **journal source taxonomy** + `source_outbox_event_id` (INV-P5-9). **Opening-balance import** is part of this commit.
2. FX-rate table + currency model. **#6 `mulDivRound` is NOT rebuilt here — it lands in Phase-4 commit 1 and Phase 5 reuses it unchanged** (Codex HIGH-4).
3. **Accounting projections (idempotent event consumers):** the `accounting_processed_event` dedup table (INV-P5-7) + the out-of-order parking queue (INV-P5-8) FIRST, then the consumers — inventory asset/COGS, sales revenue, tax payable, POS cash clearing, duty payable (bond release). Each consumer is replay-safe and order-safe.
4. AR (customer invoices/payments) + AP (supplier bills/payments) sub-ledgers, with **sub-ledger ↔ control-account tie-out** (INV-P5-9).
5. Bank + cash accounts + reconciliation; POS cash-clearing settlement.
6. Reports: trial balance, P&L, balance sheet, cash flow (read models, §27); accrual/deferral journals.
7. Period close + **year-end close / retained-earnings roll** + the auditor-package export (§25) + the Guyana VAT-period / G0002 read-model (INV-P5-6).
8. RBAC (`accounting.view/create_journal/approve_journal`, `banking.reconcile`, `audit.export`) + seed + contracts + §45 reassessment.

## 5. 🔒 DECISIONS NEEDING KAREEM

**Locked prerequisites (NOT open — corrected per Codex HIGH-7):**
- **Rounding** — NOT an open Phase-5 decision. Phase 5 **consumes the Phase-4 rounding-policy framework unchanged** (configurable currency/tax/mode, default per-line + half-even); no new rounding model in accounting.
- **Inventory-accounting tie = perpetual** — already mandated by the architecture (accounting consumes valuation events; inventory-asset must equal the stock ledger — `accounting-crm-ecommerce.md`). Not a fork; a locked prerequisite.

**Genuinely open (Kareem to decide):**
1. **Posting model & execution:** event-driven projections (recommended, §24/§27) — and the real sub-question (Codex MEDIUM-9c): is GL posting **synchronous in the domain tx**, an **async projection**, or **async with read-your-post** guarantees? (Affects when the GL reflects a sale.)
2. **Accounting basis:** **accrual vs cash** — the charter implies accrual but it is never locked. *(Codex MEDIUM-9a — new.)*
3. **Functional-currency model:** tenant/company **functional currency**, transaction-currency vs functional-amount storage, and the FX-revaluation scope (full realized+unrealized now vs single-functional-currency-first with the seam). (ADR-0008 reserved multi-currency for P5/6.) *(Codex MEDIUM-9b — new, merges old "multi-currency depth".)*
4. **COA template:** ship a default Caribbean/GRA-friendly chart (reserving roles for output VAT, input VAT, VAT payable, duty payable/clearing, MCT provision, corporate-tax expense/payable — Codex MEDIUM-10) vs require tenant setup. (Confirm structure with a Guyana accountant.)

## 6. ✅ Research complete (2026-06-23) → `competitive/accounting.md`

Competitive (QuickBooks Online / Xero / Zoho Books / Sage) and Guyana/GRA localization filled in `docs/architecture/competitive/accounting.md` (sourced, per-cell verification legend). Key facts feeding the decisions above: **multi-currency is P0** (match Xero, which ships it on all paid tiers; QBO paywalls it — §12); **perpetual COGS via event projections** off the existing valuation ledger is the structural edge (now a locked prerequisite); **#6 `mulDivRound`** lands in Phase 4 and is reused here; Guyana VAT **Form G0002** monthly/due-21st shapes the tax read model; a **Caribbean/GRA COA template** speeds onboarding. **Residual:** confirm the GRA-preferred account structure + exact filing figures with a Guyana accountant before shipping the COA template (skeleton-level research; deepen before Phase-5 code).

## 7. Codex adversarial review (2026-06-23) — findings folded in

A fresh `codex:codex-rescue` agent attacked this skeleton against the **real schema/services** (the highest-stakes review in the project). It **confirmed** the foundation is solid (no GL schema yet — build-from-scratch premise correct; money is the integer triple with division/rounding deferred; outbox writes atomically with server `occurredAt`; producer idempotency `(tenant,key)` is reusable; `avg_cost`/`valuation_layer` reconciliation targets are real). It found **3 CRITICAL + 4 HIGH + 3 MEDIUM**, all folded above, each re-verified by me against the schema:

- **CRITICAL-1** — event-driven posting not idempotent vs outbox redelivery (no consumer/checkpoint state — verified `outbox.ts` is producer-only). → INV-P5-7 `accounting_processed_event` dedup, same-tx.
- **CRITICAL-2** — event ordering/dependency silent (refund-before-sale); the refund/void/payment event TYPES don't even exist yet (verified `DomainEventType` has only `sale.created`). → INV-P5-8 parking + a **Phase-4 cross-phase requirement** that `event-map-phase4` shapes these contracts for this consumer.
- **CRITICAL-3** — inventory↔GL reconciliation not currently computable (`valuation_updated` emits null totals; `cost_reconciliation` deferred; #8 open). → INV-P5-5 made dependent on Phase-4 closing #8 + binding the reserved-nullable totals.
- **HIGH-4** — rounding decision was stale vs the Phase-4 lock. → removed as open; Phase 5 reuses the Phase-4 framework.
- **HIGH-5** — balance enforcement asserted, not designed (a CHECK can't sum child lines). → INV-P5-1 deferred-constraint trigger / posting stored-proc; INV-P5-4 functional-currency + FX balancing line.
- **HIGH-6** — period-close + posting-date not structural. → INV-P5-2/3 triggers + `posted_at DEFAULT now()` + `posting_period_id`.
- **HIGH-7** — two decisions falsely open (perpetual + rounding already settled). → moved to locked prerequisites.
- **MEDIUM-8** — missing GL concepts (opening balances, year-end/retained-earnings, control-account tie-out, source taxonomy, append-only reversal/backfill). → INV-P5-9 + build order commits 1/4/7.
- **MEDIUM-9** — three missing decisions (accrual-vs-cash, functional-currency model, sync-vs-async posting). → added to §5.
- **MEDIUM-10** — Guyana localization too thin. → INV-P5-6 tax-period + G0002 read-model + reserved COA roles.
