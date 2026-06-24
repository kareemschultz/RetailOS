# POS & Offline — Competitive Analysis

- Date: 2026-06-23 · Charter ref: §41 (parity program), §19 (POS/money/commission/tax), §13/§14 (offline levels + conflict/time integrity), §17 (fiscalization + document numbering)
- Companion: `phase-4-implementation-plan.md` (the Phase-4 build) · feeds the Phase-4 🔒 decisions.
- Method: this pass is **partially live-verified** (2026-06-23). Cells marked **(v)** are grounded in the vendor's official help-centre docs read this session; cells marked **(i)** are *inferred* from the same docs' framing (e.g. "attribution + report" implies *no* commission engine) and **must be confirmed before being cited as the bar**; cells marked **(u)** are knowledge-level/unverified (charter §40). The goal is to enumerate the **parity surface** and locate RetailOS's genuine differentiators, not to assert precise vendor facts.

> **Products surveyed (4):** Lightspeed Retail (X-Series, formerly Vend), Square for Retail, Shopify POS (Pro), Odoo POS (v17/18). Charter §41 also names Revel/Clover/Toast — restaurant-leaning; deferred. The architecturally decisive axis is **offline capability**, where RetailOS's charter §13 three-level model (single-terminal → LAN Edge Hub → cloud) is materially ahead of all four bolt-on offline modes.

---

## Feature matrix (parity surface)

Legend: **Y** = supported · **P** = partial/add-on/edition-gated/hardware-gated · **N** = not offered. Verification per cell: **(v)** official-doc-verified this session · **(i)** inferred from official-doc framing · **(u)** unverified/knowledge-level. RetailOS column: **Planned-P4** (designed for Phase 4), **Planned** (later phase), **Seam-only** (modelled now, behaviour later), **Already shipped** (Phase 2/3).

| Feature | Lightspeed X | Square Retail | Shopify POS | Odoo POS | RetailOS | Priority |
|---|---|---|---|---|---|---|
| Offline **cash** sale | Y (v) | Y (v) | Y (v) | Y (u) | **Planned-P4** | P0 |
| Offline **card** payment | P — WisePOS E hardware only (v) | P — 72h window, per-txn cap (v) | **N** — cards need internet (v) | P (u) | **Planned-P4** (record tender offline; capture/settle on sync — §14) | P0 |
| Offline **refund/return** | P (u) | P (u) | **N** — refunds need internet (v) | P (u) | **Planned-P4** (first-class offline return, replay-safe) | P0 (differentiator) |
| Offline **stock deduction** (live ledger offline) | P (u) | P (u) | **N** — stock frozen until online (v) | P (u) | **Planned-P4** (offline ledger deduction; D5 oversell flag) | P0 (differentiator) |
| Offline **customer lookup** | P (u) | P (u) | **N** — customer records inaccessible offline (v) | P (u) | **Planned-P4** (cached customers/prices/tax — §13) | P1 |
| **LAN multi-terminal** offline coordination (Edge Hub) | N (u) | N (u) | N (u) | N (u) | **Planned (P10)** — Edge Hub; seam reserved P4 | P0 (§13/§15 differentiator) |
| Offline duration model | until reconnect (v) | 72h hard cap (v) | until reconnect, cash-only (v) | until reconnect (u) | **device-token grace window** (§13/§14) | P1 |
| Split / multi-currency tender | Y (u) | P (u) | P (u) | Y multi-currency (v) | **Planned-P4** (split + multi-currency tender, FX recorded) | P0 (§12) |
| Gift card / store credit as **liability** | Y (u) | Y (u) | Y (u) | P (u) | **Planned-P4** (liability, recognized on redemption — §19) | P1 |
| Shift open/close + cash drawer | Y (v) | Y — End Drawer / Drawer History (v) | Y — cash tracking (v) | Y — cash control (v) | **Planned-P4** | P0 |
| **Blind close** (count without seeing expected) | P (u) | P — shows expected in flow (u) | P (u) | **N** — shows theoretical balance (v) | **Planned-P4** (blind close; over/short to manager audit — §19) | P1 (shrinkage-control differentiator) |
| X-report (mid-shift) + Z-report (end-of-day) per terminal/shift | Y — Z auto-batch (v) | Y (v) | Y (u) | Y (u) | **Planned-P4** (X + Z per terminal/shift) | P0 |
| Sales-rep **attribution** on sale/line | Y (u) | Y (u) | Y — attribute to staff + report (v) | Y — salesperson (v) | **Planned-P4** (rep at checkout, per-line) | P0 |
| Commission **engine** (flat/%/product/category/tiered + statements/payouts + refund/void clawback) | **N** (i) | **N** (i) | **N** — attribution + report only, no engine (i) | P — via Sales/CRM, not POS-native (u) | **Planned-P4** (full engine — §19) | P1 (differentiator) |
| Returns / exchanges (first-class) | Y (v) | Y (u) | Y — online only (v) | Y — Refund action (v) | **Planned-P4** (`saleType=return`, `originalSaleId`) | P0 |
| **Credit note** as first-class fiscal document (not a refund flag) | P (u) | N (u) | N (u) | P (u) | **Planned-P4** (first-class doc type — §17) | P1 (fiscal-integrity differentiator) |
| **Distributed offline document-number leasing** (no two terminals mint the same #) | N (u) | N (u) | N (u) | N (u) | **Planned-P4** (number-block lease — §17) | P0 (fiscal-integrity differentiator) |
| Tamper-evident sequential numbering per company/location/fiscal-year/series | P (u) | P (u) | P (u) | P (u) | **Planned-P4** (per-series, gap/void tracking — §17) | P0 (Guyana requires unique serialized invoice #) |
| Fast cashier switch (PIN / RFID / biometric) | P — PIN (u) | P — PIN (u) | Y — unique PIN login (v) | P — PIN (u) | **Planned-P4** (PIN/RFID/biometric, offline within grace — §19) | P1 |
| Manager step-up for void/refund/discount override | Y — void needs manager by default (v) | Y (u) | Y — POS roles (v) | Y (u) | **Planned-P4** (step-up + approval + audit — §22) | P0 |
| Integrated EFTPOS vs standalone distinction | Y (u) | Y (u) | P (u) | P (u) | **Seam-only P4** (interface; real bridge = P9) | P2 |
| Real fiscalization / fiscal-device integration | country-specific (u) | country-specific (u) | country-specific (u) | country-specific (u) | **Seam-only P4** ("none" provider; Guyana has no mandate — see below) | P0 (seam) |

## Parity takeaways for Phase 4

1. **Offline is RetailOS's decisive edge, and the competition validates the gap.** Every surveyed POS is **bolt-on offline**, not offline-first: Lightspeed gates offline card on the WisePOS E **hardware**; Square enforces a **72-hour** upload window + per-transaction cap; **Shopify POS is the weakest — no offline cards, no offline refunds, frozen stock, no offline customer records**; Odoo is a single-terminal browser PWA. **None** offers LAN multi-terminal coordination. RetailOS's §13 three-level model (single-terminal → LAN Edge Hub → cloud) with offline sales, refunds, ledger deduction, cached reads, and local receipts is a real P0 differentiator for the Caribbean/unstable-WAN market (§12) — not parity-chasing. Phase 4 ships **levels 1 + 3 hooks**; the LAN Edge Hub is Phase 10 (seam reserved now).

2. **Commission is attribution-plus-report everywhere, not an engine.** Shopify/Lightspeed/Square attribute a sale (or line) to staff and surface a *report*; Odoo computes commission in Sales/CRM, not POS-native. **None** ships a configurable flat/%/product/category/tiered **commission engine** with statements, payouts, and refund/void **clawback**. RetailOS's §19 commission engine leads here (P1 differentiator) — but see Decision #7 (accrue-at-sale vs at-settlement) before building.

3. **Shift/cash/Z-report is table-stakes — match it, and add blind close.** All four have shift open/close, a cash drawer, and a close-of-day report; Lightspeed auto-batches the Z. The differentiator is the **blind close** (cashier enters counted cash *without* seeing the expected figure) for shrinkage control — Odoo explicitly *shows* the theoretical balance, the opposite of blind. RetailOS's §19 blind close + X/Z per terminal/shift is parity-plus.

4. **Document-number integrity is a genuine differentiator that Guyana makes load-bearing.** No surveyed POS publicizes **distributed offline number-block leasing**; they are cloud-authoritative and reconcile local temp IDs on sync. Because the GRA **requires a unique serialized invoice number** on every tax invoice (verified — see fiscalization note), RetailOS's §17 tamper-evident per-series numbering with offline block lease (so two offline terminals never mint the same number) is both a compliance need and an edge. This is INV-P4-4.

5. **Returns + credit note: be first-class, not a flag.** All four do returns/exchanges; Shopify's offline gap (refunds need internet) is the weakness. RetailOS models `saleType=return` + `originalSaleId` now and credit-note as a first-class fiscal document (§17) — stronger than a boolean refund flag, and required where the credit note is itself a numbered fiscal document.

## Fiscalization note (Guyana / GRA) — verified 2026-06-23

**Finding (HIGH confidence, documentary):** the Guyana Revenue Authority imposes **content-based** tax-invoice requirements only. It does **NOT** mandate electronic fiscal devices, fiscal printers, electronic cash registers, real-time e-invoicing/clearance, digital signing, or fiscal QR codes. Sources: the GRA "Taxation Simplified: VAT & Invoices" publication (referencing VAT Policy #19 and the VAT Act No. 10 of 2005, Cap. 81:05) makes no mention of fiscal hardware or signing; targeted searches for a Guyana fiscal-device/ECR mandate returned only *other* countries' regimes (EU/LatAm/Ghana).

Verified Guyana facts:
- **VAT standard rate 14%**, zero-rate 0% (VAT Act No. 10 of 2005, Cap. 81:05).
- **Mandatory tax-invoice fields:** the words "Tax Invoice" at the top; business name, address, VAT Registration Number; description, quantity/volume; tax amount, sale cost, total-including-tax; **unique serialized invoice number** and issuance date.
- Cash sale ≤ **G$10,000** → a simplified "sales invoice" may be issued in lieu of a full tax invoice.
- VAT returns are e-filed via GRA eServices (a **Phase-5** accounting concern, not Phase-4 receipt-level fiscalization).

**Architectural consequence:** Phase 4 ships the **pluggable fiscalization provider interface** (`submit/clear`, `sign`, `statusTrack`, `creditNote`, `voidRules`, `fiscalLogs`) with a **no-op "none" provider** as the Guyana-today default. The receipt/numbering work (§17 sequential per-series numbering, the mandatory field set above) is real and built now; the *clearance/signing* path is a seam. **Caveat (charter §17):** this is a documentary finding, not a tax-attorney opinion — confirm with a Guyana tax expert before launch, and watch for GRA regime changes (the country is rapidly digitizing government services). If the GRA later mandates a fiscal-device/clearance regime, the provider interface is the attach point — no core POS rework.

Regional fiscalization models the provider interface must be able to cover (so a future country plug-in fits): (a) **fiscal-device/memory** (printer or sealed device signs each receipt — common in parts of LatAm/the Balkans); (b) **real-time cloud clearance** (each invoice cleared/assigned a control number by the tax authority before/at issue — the Latin-American CFDI/e-invoice pattern); (c) **signed-receipt/reporting** (periodic signed submission). The "none" provider is the absence of all three. *(These three models are knowledge-level (u); confirm a specific country's mechanics against that authority's docs before building its provider.)*

## VAT rounding — GRA finding + ERP convention (verified 2026-06-23)

**GRA mandates NO rounding algorithm** (HIGH for the guidance/regulation layer). Verified directly this session: the GRA [How to calculate VAT](https://www.gra.gov.gy/tax-services/vat-services/how-to-calculate-vat/) page publishes the **VAT fraction 7/57** (= 14%/(1+14%)) and worked examples but states no rounding rule; the [VAT & Invoices](https://www.gra.gov.gy/vat-invoices/) page lists invoice fields with no precision rule; Policy #25 (Tax Fraction) and Policy #13 (inclusive/exclusive pricing) add none; the consolidated **VAT Act + Regulations PDF (Feb 2024)** is image-scanned and its extractable text shows no rounding clause. **Residual:** the scanned Act could carry an un-extractable clause → folds into the tax-expert launch check.

**ERP tax-rounding convention (informs the RetailOS default):**
- **Xero** — tax computed **per line**, rounded to 2 dp, then line taxes summed = invoice tax. ([Rounding in Xero](https://developer.xero.com/documentation/guides/how-to-guides/rounding-in-xero/))
- **QuickBooks (Commerce)** — tax **per line item**, rounded before the total ("generally accepted, also used by Xero").
- **Odoo** — **configurable**: `round_per_line` vs `round_globally` (Accounting config); journal lines capped at 2 dp.
- **ERPNext** — configurable, with documented line-vs-total consistency pitfalls.
- Half-even vs half-up is **not** uniformly documented — there is no single industry standard, only conventions, which is itself the argument for making it configurable.

**RetailOS conclusion (Decision #4):** a **configurable rounding-policy framework** (currency-scale + per-line/per-total granularity + mode, config-driven per country/currency — NOT one hardcoded global rule), defaulting to **per-line + half-even** (per-line matches Xero/QuickBooks and the GRA line-item-tax invoice field; half-even is the enterprise/IFRS-aligned default against margin drift). This lets Guyana/Trinidad/Barbados/Suriname differ without schema changes (charter §12/§19).

## Sources

- [Lightspeed Retail (X-Series) — Selling in offline mode](https://x-series-support.lightspeedhq.com/hc/en-us/articles/25534272395163-Selling-in-offline-mode)
- [Lightspeed Retail (X-Series) — Lightspeed Payments offline mode (WisePOS E)](https://x-series-support.lightspeedhq.com/hc/en-us/articles/25533690950427-Lightspeed-Payments-offline-mode-with-Retail-POS-X-Series)
- [Lightspeed Retail (X-Series) — Setting user roles and permissions](https://x-series-support.lightspeedhq.com/hc/en-us/articles/25534171377819-Setting-user-roles-and-permissions)
- [Square — Process offline payments (72h window, per-txn cap)](https://squareup.com/help/us/en/article/7777-process-card-payments-with-offline-mode)
- [Square — Set up cash management (End Drawer / Drawer History)](https://squareup.com/help/us/en/article/5152-cash-drawer-management)
- [Shopify Help Center — Using Shopify POS offline](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/selling-offline)
- [Shopify Help Center — Shopify POS offline features](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/selling-offline/offline-features)
- [Shopify Help Center — Attributing sales to staff](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/order-management/sales-attribution)
- [Shopify Help Center — Give staff permissions with POS roles](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/staff-management/pos-roles)
- [Odoo 18 — Point of Sale documentation](https://www.odoo.com/documentation/18.0/applications/sales/point_of_sale.html)
- [Odoo — Set up Cash Control in Point of Sale](https://www.odoo.com/documentation/13.0/applications/sales/point_of_sale/shop/cash_control.html)
- [Guyana Revenue Authority — VAT & Invoices](https://www.gra.gov.gy/vat-invoices/)
- [Guyana Revenue Authority — Value Added Tax services](https://www.gra.gov.gy/tax-services/vat-services/)
- [Guyana Revenue Authority — How to calculate VAT (7/57 fraction, no rounding rule)](https://www.gra.gov.gy/tax-services/vat-services/how-to-calculate-vat/)
- [Guyana VAT Act + Regulations consolidated (Feb 2024 PDF)](https://www.gra.gov.gy/wp-content/uploads/2024/03/VAT-Act-Regul.-Trans.-Reg.-revised-Feb-8-2024.pdf)
- [Rounding in Xero (per-line tax rounding)](https://developer.xero.com/documentation/guides/how-to-guides/rounding-in-xero/)
- [Odoo — round_per_line vs round_globally (issue #37896)](https://github.com/odoo/odoo/issues/37896)
