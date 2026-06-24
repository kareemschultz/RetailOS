# Accounting Foundation — Competitive Analysis

- Date: 2026-06-23 · Charter ref: §41 (parity program), §20 (accounting module), §12 (Caribbean/multi-currency), §19 (money rules)
- Companion: `phase-5-implementation-plan.md` · feeds the Phase-5 🔒 decisions.
- Method: **partially live-verified** (2026-06-23). Cells: **(v)** official-doc/comparison-verified this session · **(i)** inferred · **(u)** unverified/knowledge-level (charter §40). This is a **skeleton-level** pass for a Phase-5 plan that is itself a skeleton — enough to locate the parity surface and the Caribbean-localization facts; deepen before Phase-5 code.

> **Products surveyed (4):** QuickBooks Online, Xero, Zoho Books, Sage (Business Cloud / 50). All four are double-entry SMB accounting; the discriminators for RetailOS are **multi-currency depth**, **inventory↔GL tie (perpetual COGS)**, and **Caribbean/GRA tax-filing fit** — areas where RetailOS's event-fed projections from its own inventory ledger (Phases 2–4) are the structural advantage.

---

## Feature matrix (parity surface)

Legend: **Y** supported · **P** partial/tier-gated · **N** not offered · verification **(v)/(i)/(u)**. RetailOS: **Planned-P5** / **Planned** (later) / **Seam-only** / **Already shipped**.

| Feature | QuickBooks Online | Xero | Zoho Books | Sage | RetailOS | Priority |
|---|---|---|---|---|---|---|
| Double-entry GL + journals | Y (u) | Y (u) | Y (u) | Y (u) | **Planned-P5** (balance invariant in DB + service, INV-P5-1) | P0 |
| Chart of accounts (customizable) | Y (u) | Y (u) | Y (u) | Y (u) | **Planned-P5** (+ optional Caribbean/GRA template — Decision #4) | P0 |
| Multi-currency invoicing | P — Advanced plan only (v) | Y — all paid tiers (v) | Y (u) | P (u) | **Planned-P5** (currency-explicit per ADR-0008 triple) | P0 (§12) |
| FX realized/unrealized gain-loss | P (u) | Y (u) | P (u) | P (u) | **Planned-P5 or seam** (Decision #3: full now vs single-functional-currency first) | P1 |
| Bank reconciliation | Y — periodic month-end (v) | Y — continuous bank feeds (v) | Y (u) | Y (u) | **Planned-P5** (rec + POS cash-clearing settlement) | P0 |
| Period close / lock | Y (u) | Y (u) | Y (u) | Y (u) | **Planned-P5** (immutable closed period, INV-P5-2; reversals = new entries) | P0 |
| AR (customer invoices/payments) | Y (u) | Y (u) | Y (u) | Y (u) | **Planned-P5** (AR sub-ledger) | P0 |
| AP (supplier bills/payments) | Y (u) | Y (u) | Y (u) | Y (u) | **Planned-P5** (AP sub-ledger; feeds Phase-6 procurement) | P0 |
| Perpetual inventory → COGS auto-post | P — via inventory add-on (u) | P (u) | Y (u) | P (u) | **Planned-P5** (event-fed from the Phase-2 valuation engine — structural edge) | P0 (differentiator) |
| Inventory-asset ↔ GL reconciliation | P (u) | P (u) | P (u) | P (u) | **Planned-P5** (INV-P5-5: GL asset reconciles to avg_cost/valuation_layer) | P1 (differentiator) |
| Tax/VAT return reporting | Y — region packs (u) | Y — region packs (u) | Y (u) | Y (u) | **Planned-P5** (Guyana VAT Form G0002 shape — see localization) | P0 (§12) |
| Auditor package / tamper-evident export | P (u) | P (u) | P (u) | P (u) | **Planned-P5** (INV-P5-6: hash-manifest + signature, `audit.export` — §25) | P1 (differentiator) |
| Posting model: real-time vs batch | real-time (u) | real-time (u) | real-time (u) | real-time (u) | **Planned-P5** (event-driven projections — Decision #1, recommend real-time) | P0 |
| Offline / Caribbean fit | N (u) | N (u) | N (u) | N (u) | **Already shipped foundation** (offline POS feeds GL on sync) | P0 (§12 differentiator) |

## Parity takeaways for Phase 5

1. **Multi-currency is where Xero beats QuickBooks, and RetailOS must match Xero, not QBO.** Xero ships multi-currency on all paid tiers; QBO paywalls it behind Advanced. For a Caribbean/CARICOM product (§12, USD/GYD split drawers already in POS), multi-currency GL + FX gain/loss is **P0**, not an upsell. Decision #3 (full FX revaluation now vs single-functional-currency-first-with-seam) is the scoping lever — recommend at minimum currency-explicit entries + the FX-rate table now, with revaluation depth a dial.
2. **The inventory↔GL tie is RetailOS's structural advantage.** QBO/Xero/Sage bolt inventory on (or via add-ons); RetailOS already owns a perpetual valuation ledger (`avg_cost`/`valuation_layer`, SKU×location, Phase 2/3). Phase 5 posts COGS/inventory-asset by **subscribing to the existing domain events** (`inventory.valuation_updated`, `sale.created`, `inventory.bond_released`) rather than re-deriving — keeping OLTP and GL decoupled (§24/§27). INV-P5-5 (GL asset reconciles to the stock-ledger valuation) is a differentiating data-quality control. This is Decision #5 (perpetual, recommended) — the ledger already makes perpetual the natural choice.
3. **Auditor package is a commercial edge, not just compliance** (§25) — a tamper-evident, signed, per-fiscal-year export gated by `audit.export`. None of the four ships this as a first-class, cryptographically-verifiable artifact for tax-authority review.
4. **#6 BigInt `mulDivRound` is a HARD blocker for Phase 5** — FX conversion, tax, and proportional allocation all divide; the single rounding policy (Decision #2) must land before any posting math. This is shared with Phase 6 landed-cost allocation.

## Localization — Guyana / GRA (verified 2026-06-23)

- **VAT return = Form G0002**, monthly tax period, **file + remit by the 21st** of the following month (VAT standard rate **14%**). The Phase-5 tax-reporting read model should be shaped to emit the G0002 figures (output VAT, input VAT, net).
- **Corporate income tax:** commercial companies **40%** of chargeable profits **or 2% minimum corporation tax (MCT) on turnover, whichever is higher**; non-commercial companies **25%**. (Relevant to a future tax-provision report; not core Phase-5 GL, but the COA template should reserve the accounts.)
- **VAT-return e-filing** via GRA eServices/Optimal exists — a reporting-export concern, behind the same provider-seam discipline as fiscalization.
- **COA template (Decision #4):** a default Caribbean/GRA-friendly chart (VAT payable/receivable split for the 14%/0%, duty payable, CIF-based inventory-asset, MCT provision) would speed onboarding vs requiring tenant setup. *(Confirm the exact GRA-preferred account structure with a Guyana accountant before shipping the template.)*

## Sources

- [QuickBooks vs Xero vs Sage vs Zoho — 2026 comparison](https://acculinkcpa.com/blog/quickbooks-online-vs-xero-vs-sage-vs-freshbooks-vs-zoho-books-complete-comparison)
- [Xero vs QuickBooks 2026 (multi-currency, bank rec)](https://bookkeeping-services.com/xero-vs-quickbooks/)
- [Guyana Revenue Authority — File Your Returns (VAT)](https://www.gra.gov.gy/business/tax-operations-and-services/value-add-tax-services/file-your-returns/)
- [Guyana VAT Return Form G0002](https://headoffice.app/guyana/download-form-g0002-vat-return)
- [Guyana — Corporate taxes on corporate income (PwC Tax Summaries)](https://taxsummaries.pwc.com/guyana/corporate/taxes-on-corporate-income)
- [Guyana Revenue Authority — Corporation Tax Return](https://www.gra.gov.gy/optimal/corporation-tax-return/)
