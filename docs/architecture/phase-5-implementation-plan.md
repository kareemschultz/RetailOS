# Phase 5 — Accounting Foundation — Plan SKELETON (DRAFT for review)

> **STATUS: PLANNING SKELETON — NOT APPROVED, NO CODE.** Overnight-run draft for Kareem's morning review. Decisions are Kareem's to lock.

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

- **INV-P5-1 — every journal balances:** Σ debits == Σ credits per entry per currency; unbalanced rejected (charter §26 unbalanced-journal rejection test).
- **INV-P5-2 — period close is immutable:** no posting into a closed period; reversals are new entries.
- **INV-P5-3 — server-authoritative posting date** (§14); device/local time never posts.
- **INV-P5-4 — money is currency-explicit** (the ADR-0008 triple); multi-currency entries carry per-line currency + the FX rate used; realized/unrealized gain-loss is its own posting.
- **INV-P5-5 — inventory ↔ GL reconciliation:** the inventory-asset account balance reconciles to the stock-ledger valuation (the `avg_cost`/`valuation_layer` totals); a divergence is a data-quality alert (§26).
- **INV-P5-6 — auditor package (§25):** a fiscal-year export (journals, GL, stock ledger, tax docs, audit logs) that is tamper-evident (hash manifest + signature), gated by `audit.export`.

## 4. Proposed build order (commits) — to refine after research

1. COA + ledger_account + posting_period + the double-entry `journal`/`journal_line` core (balance invariant enforced in DB + service).
2. Money/FX foundation: FX rate table + the BigInt `mulDivRound` (#6) + rounding policy.
3. Accounting projections (event consumers): inventory asset/COGS, sales revenue, tax payable, POS cash clearing, duty payable (bond release).
4. AR (customer invoices/payments) + AP (supplier bills/payments) sub-ledgers.
5. Bank + cash accounts + reconciliation; POS cash-clearing settlement.
6. Reports: trial balance, P&L, balance sheet, cash flow (read models, §27).
7. Period close + the auditor-package export (§25).
8. RBAC (`accounting.view/create_journal/approve_journal`, `banking.reconcile`, `audit.export`) + seed + contracts + §45 reassessment.

## 5. 🔒 DECISIONS NEEDING KAREEM

1. **Posting model:** real-time event-driven auto-posting vs batched periodic posting (recommend event-driven projections, charter §24/§27).
2. **#6 rounding policy:** the single rounding mode for FX/tax/allocation (banker's vs half-up) — locks the BigInt `mulDivRound`.
3. **Multi-currency depth in Phase 5:** full FX revaluation + gain/loss now, or single-functional-currency first with the seam reserved?
4. **COA template:** ship a default Caribbean/GRA-friendly chart, or require tenant setup? (Needs the GRA/tax research.)
5. **Inventory-accounting tie:** perpetual (post COGS per sale, recommended given the ledger) vs periodic.

## 6. ✅ Research complete (2026-06-23) → `competitive/accounting.md`

Competitive (QuickBooks Online / Xero / Zoho Books / Sage) and Guyana/GRA localization filled in `docs/architecture/competitive/accounting.md` (sourced, per-cell verification legend). Key facts feeding the decisions above: **multi-currency is P0** (match Xero, which ships it on all paid tiers; QBO paywalls it — §12); **perpetual COGS via event projections** off the existing valuation ledger is the structural edge (Decision #5 → perpetual recommended); **#6 `mulDivRound` is a hard blocker** (Decision #2); Guyana VAT **Form G0002** monthly/due-21st shapes the tax read model; a **Caribbean/GRA COA template** (Decision #4) speeds onboarding. **Residual:** confirm the GRA-preferred account structure + exact filing figures with a Guyana accountant before shipping the COA template (skeleton-level research; deepen before Phase-5 code).
