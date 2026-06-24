# Phase 4 — POS & Offline Queue — Implementation Plan (DRAFT for review)

> **STATUS: DECISIONS LOCKED (2026-06-23) — PLAN HARDENED — NO CODE YET.** Research complete, Codex-reviewed, and all 7 🔒 decisions locked by Kareem (§12). **Locking decisions + hardening the plan is NOT authorization to build** — Phase-4 implementation (schema/migrations/code/PRs) is a separate session. This doc is the approved-design-of-record for that future build.

## Confidence

- **Overall: HIGH** for the data-model, offline, numbering, shift, and RBAC design — these are grounded in (a) the **actual codebase seams** (verified by reading the schema) and (b) the **charter** (§13/§14 offline, §17 fiscal/numbering, §19 POS/money/commission), which are authoritative in-repo sources.
- **MEDIUM/SPECULATIVE** for anything competitive-comparison or Guyana-GRA-specific — see the ⚠️ banner.
- **THIS PLAN ASSUMES:** (1) Phase 3 merges as-is (the location tree, transfers, bonds, and the `sale`/`number_block` seams stay); (2) money stays integer minor units + currency + scale; (3) D5 oversell policy (allow-oversell-with-flagging default, configurable hard-block) carries into POS unchanged; (4) the POS sale remains idempotent end-to-end on `(tenant_id, idempotency_key)`; (5) no UI is built in this phase — backend mutations, queue, and Tauri offline-store contract only.

> ## ✅ RESEARCH COMPLETE (2026-06-23, post-reset)
> The competitive matrix (§11) and Guyana-GRA fiscalization specifics (§8) were researched and filled on 2026-06-23 — see `competitive/pos.md` for the sourced matrix + per-cell verification legend. **Load-bearing fact resolved (HIGH confidence, documentary):** the GRA does **not** mandate electronic fiscal devices / fiscal printers / ECRs / real-time e-invoicing — invoice requirements are content-based → **Decision #1 = ship the pluggable seam + "none" provider** (not a hard integration). Remaining caveat per charter §17: confirm with a Guyana tax expert before launch.

## 1. Scope (charter §31 Phase 4)

POS sale mutation, payments, receipts, shifts, offline queue, idempotency, sync logs, number-block reservation, and the Tauri POS target (static/SPA build). Per the standing build order: schema → migrations → RLS → robust seed → services → routers → validation → RBAC → audit/outbox → tests → API contract docs. **No accounting GL (Phase 5), no hardware bridge (Phase 9), no Edge Hub (Phase 10), no real fiscalization integration (seam only).**

## 2. What already exists (codebase grounding — verified)

| Seam | State today (VS#1) | Phase 4 action |
|---|---|---|
| `sale` | id, locationId, number, totalMinor, currency, scale, status `completed\|void`, idempotencyKey, **unique `(tenant_id, idempotency_key)`** | **EXTEND**: shiftId, salesRepId, customerId(seam), subtotal/discount/tax minor, saleType `sale\|return\|exchange`, originalSaleId (returns), offline-origin metadata (deviceId, terminalId, monotonic counter, local ts, payload version) |
| `sale_line` | saleId, productId, qty (int4), unitPriceMinor | **EXTEND**: skuId, lotId, qtyScale, line discount, line tax, commission seam; consider base-unit qty (int8) for weighed goods |
| `invoice` | minimal (saleId, number, total) | keep minimal; full AR is Phase 5 |
| `number_block` | per `(tenant, company, docType, series)`, rangeStart/End/next, **single-node allocator**; offline reservation explicitly deferred (I3) | **BUILD** the reservation/lease model + offline block hand-out |
| `idempotency_key` table | exists | reuse for sale replay-safety + sync ingestion |
| `outbox_event` | exists; `emitEvent` injects server `occurredAt` | emit `sale.created/refunded/voided`, `payment.received`, `shift.opened/closed` |
| **payment / tender** | **does NOT exist** | **BUILD NEW** |
| **shift / cash drawer** | **does NOT exist** | **BUILD NEW** |
| **offline sync log / queue-batch** | **does NOT exist** | **BUILD NEW** (server-side ingestion record) |

## 3. Proposed build order (commits)

0. Planning lock + event-map-phase4 + this plan approved (gate-only, no code).
1. **Foundation (pulled forward by Codex review):** (a) the **#6 BigInt `mulDivRound` + the single rounding policy** — a Phase-4 P0 hard blocker, because VAT 14% line tax, percentage discounts, FX tender, and commission % all divide (Codex CRITICAL-3); (b) the **composite `(tenant_id, id)` FK migration** for the legacy POS tables `sale`/`sale_line`/`invoice`/`number_block` (INV-P4-10, Codex HIGH); (c) the **`fiscal_document` schema seam** (all-nullable provider columns + nullable FK from `invoice`, INV/§8, Codex MEDIUM). All expand-only/additive. This commit unblocks every later pricing/valuation/numbering touch.
2. **Shift + cash management:** `shift` (open/close, opening float, blind-close counted vs expected, over/short), `cash_movement` (pay-in/pay-out/drop). X/Z report read models.
3. **Payment/tender model:** `payment` + `tender` (cash/card/bank-transfer/mobile-money/cheque/store-credit/gift-card/mixed), split + multi-currency tender, change calc. Gift-card/store-credit recorded in a **stored-value balance ledger (audited)**; GL liability posting is Phase 5 (INV-P4-5).
4. **POS sale mutation (extended):** sale/line extension (SKU **required** on inventory-tracked lines, INV-P4-8), sale→stock-deduction **+ `applyValuation`** (reuse `appendStockMovement` AND run valuation — closes #8, INV-P4-3; D5 oversell flag), **sellable-location guard** (INV-P4-7), sale→payment, sale→invoice, returns/refunds/exchanges (first-class, link `originalSaleId`), held/parked sales. Idempotent end-to-end. Each with the write-path-invokes-service gate.
5. **Commission engine:** sales-rep at checkout; flat/%/product/category/tiered (uses #6 from commit 1); refund/void adjustment.
6. **Document numbering reservation:** allocator + disjoint `number_lease` with the per-scope advisory-lock protocol + state machine + gap/void tracking (§5); two terminals never mint the same number, online or offline (INV-P4-4).
7. **Offline queue + sync ingestion:** server-side sync-batch ingestion with **`(tenant, device, terminal, counter)` uniqueness + payload hash** (INV-P4-9), monotonic counters, server-authoritative time, reconnection backpressure (Redis), conflict surfacing. The client-side Tauri/Dexie store contract is defined here (no UI).
8. **Fiscalization SEAM:** the pluggable provider interface (submit/clear/sign/status/credit-note/void/logs) wired to the `fiscal_document` seam from commit 1; a no-op "none" provider for Guyana-today. **No real integration.**
9. **RBAC + robust seed + API contracts + §45 reassessment.**

## 4. Offline conflict policy (charter §13/§14; reuse D5)

Three canonical policies (charter §14) — RetailOS picks **per tenant/location**:
1. allow-oversell-with-flagged-backorder (the D5 default already wired in Phase 2/3: negative ledger + `inventory.stock_discrepancy` event);
2. hard local reservation via Edge Hub (Phase 10 dependency);
3. optimistic deduction + compensating correction on sync conflict.

Phase 4 ships **policy 1 + 3 hooks** (Edge-Hub hard-reservation is Phase 10). Append-only events (sales, payments, ledger, audit) replay in order with idempotency keys; mutable shared state (stock-on-hand) never blind last-write-wins — ledger truth dominates. **Device clocks untrusted; server time authoritative for posting** (§14). Every offline mutation carries deviceId, terminalId, monotonic counter, local ts, payload version, idempotency key.

## 5. Document numbering integrity (charter §17)

Sequential tamper-evident numbering per company/location/fiscal-year/doc-type/series. Offline terminals **reserve number blocks** issued by cloud (or Edge Hub in Phase 10); never let two terminals mint the same number. Track gaps, voids, out-of-sequence, unused reserved, expired blocks. Credit note is a first-class fiscal document type (not a refund flag).

**Lease concurrency model (must be specified, not hand-waved — Codex HIGH).** Today `number_block` is a single mutable row (`range_start/range_end/next`, no state machine, scope missing location+fiscal-year). The lease protocol:
- **Scope first:** extend the unique key to `(tenant, company, location, fiscal_year, doc_type, series)` (INV-P4-4).
- **Split the model:** an **allocator** (the authoritative high-water mark per scope) issues **disjoint leases** into a `number_lease` table (`scope, range_start, range_end, terminal_id, device_id, state, leased_at, expires_at`) — a terminal advances a local cursor within its lease offline.
- **Concurrency:** allocation takes a per-scope advisory lock (or `SELECT … FOR UPDATE` on the allocator row) BEFORE computing the next range, so two terminals can **never** receive overlapping ranges (the same lock discipline as `appendStockMovement` / the transfer state machine — see the commit-3 HIGH-1 lesson). A DB constraint enforces lease ranges are disjoint per scope.
- **State machine:** `leased → active → exhausted | expired`; an expired/partially-used lease's unused numbers are tracked (gap report), never silently reissued.
- **Usage tracking:** per-number `used | void | unused-reserved`, feeding the §17 gap/void/out-of-sequence reports.
- **Tests:** two concurrent terminals leasing the same scope get disjoint ranges; an expired lease's tail is reported as a gap, not reminted.

**Migration strategy for the `number_block` scope change (expand/contract — NOT purely additive).** Today the unique key is `(tenant, company, doc_type, series)` and `location_id` is a nullable column not in the key (verified `numbering.ts:34`). Adding `location_id` + `fiscal_year` to the key is an **expand/contract** change (charter §8): **(1) Expand** — add the `fiscal_year` column (nullable) + a NEW unique index `(tenant, company, location_id, fiscal_year, doc_type, series)` alongside the old one; **(2) Backfill** — set `fiscal_year` for existing rows (current fiscal year) and `location_id` (company default location, or explicit) so the new key is satisfied; **(3) Switch** — services read/allocate on the new scope; **(4) Contract** — drop the old `(tenant, company, doc_type, series)` unique in a LATER release once no code uses it. Never ship the drop in the same release that starts using the new shape (charter §8 destructive-migration rule). For the composite-FK work (INV-P4-10): the migration must **add the `(tenant_id, id)` UNIQUE targets on `sale` and `number_block` BEFORE the composite FKs reference them** (the drizzle-kit FK-before-its-target-unique ordering lesson from Phase-3 commit 0 — read the generated SQL and reorder if needed).

## 6. Shift & cash (charter §19)

Open/close shift, multi-currency cash float, **blind close** (cashier enters counted cash WITHOUT seeing expected; system computes over/short for the manager's audit log), X-report (mid-shift snapshot) + Z-report (end-of-day final settlement) per terminal/shift. Distinguish **standalone** card payment (system only records a card was used) from **integrated** EFTPOS (POS pushes exact amount to terminal) to eliminate double-entry (§19; ties to Phase 9 hardware).

## 7. Money / pricing / tax (charter §19) — reuse

Integer minor units only (amount+currency+scale together). Split-currency payments + FX at POS (realized gain/loss is a Phase-5 accounting concern; POS records the tender currency + rate). Tax-inclusive vs exclusive centrally; line-item tax; **rounding via the configurable policy framework (Decision #4) — currency-scale + per-line/per-total granularity + mode, config-driven per country/currency, NOT a hardcoded global rule** (charter §12/§19). **Issue #6 (BigInt `mulDivRound(a,b,c,mode)`) is LOCKED as a Phase-4 P0 (commit 1)** — every tax/discount/FX/commission division goes through it; the policy resolver supplies `mode` and decides per-line vs per-total. Phase 5/6 reuse it unchanged.

## 8. Fiscalization seam (charter §17) — ✅ RESEARCHED 2026-06-23

Reserve a **pluggable fiscalization provider interface** from day one: `submit/clear`, `sign`, `statusTrack`, `creditNote`, `voidRules`, `fiscalLogs`. **A "none" provider (no-op) IS the Guyana-today default** — verified (HIGH, documentary): the GRA imposes **content-based** invoice requirements only and does **not** mandate electronic fiscal devices, fiscal printers, ECRs, real-time e-invoicing/clearance, or digital signing (see `competitive/pos.md` § fiscalization note + sources). This resolves the load-bearing seam-vs-hard-integration question in favour of the **seam**.

Verified Guyana facts the receipt/numbering work must honour now:
- **VAT 14%** standard / 0% zero-rate (VAT Act No. 10 of 2005, Cap. 81:05).
- **Mandatory tax-invoice fields:** "Tax Invoice" header; business name, address, VAT Registration Number; description; quantity/volume; tax amount, sale cost, total-including-tax; **unique serialized invoice number** + issuance date. (This makes §17 sequential per-series numbering a real compliance requirement, not just integrity hygiene — INV-P4-4.)
- Cash sale ≤ **G$10,000** → simplified "sales invoice" allowed in lieu of a full tax invoice (a receipt-template variant, not a code branch in the sale mutation).
- VAT-return e-filing (GRA eServices) is a **Phase-5** accounting concern, not Phase-4 receipt-level fiscalization.

The provider interface must be shaped to also cover three regional regimes so a future country plug-in fits without core rework: **fiscal-device/memory** (sealed device/printer signs each receipt), **real-time cloud clearance** (authority assigns a control number per invoice — the LatAm CFDI pattern), and **signed-receipt/periodic reporting**. The "none" provider is the absence of all three. **Caveat (charter §17):** documentary finding, not a tax-attorney opinion — confirm with a Guyana tax expert before launch and watch for GRA regime changes.

**Reserve the schema seam NOW, don't just ship an interface (Codex MEDIUM + the "reserve deferred fields nullable, don't ship them absent" lesson).** An interface alone means a future GRA mandate forces a breaking migration to `sale`/`invoice`. Instead, create a **`fiscal_document` table now** with all-nullable provider fields — `provider`, `status`, `control_number`, `signature_payload`, `qr_data`, `authority_submitted_at`, `authority_response_at`, and `raw_request`/`raw_response` references — plus a **nullable FK from `invoice`**. The "none" provider simply leaves them null; a future regime populates them with **no breaking change** (exactly the present-but-null → present-with-value additive pattern proven in Phase 2). This makes Decision #1 a true seam, not a deferred schema risk.

**VAT Registration Number + TIN seams (required for a GRA-compliant tax invoice).** Verified: no `vat_registration_number`/`tax_identification_number` field exists on `organization` or `company` today. A GRA tax invoice MUST show the seller's name, address, **VAT Registration Number** (and the TIN is the taxpayer identifier behind it) — so without these the receipt/invoice renderer literally cannot produce a compliant document. **Phase-4 commit 1 adds, as reserved seams (nullable, no fiscalization logic):**
- `organization.vat_registration_number`, `organization.tax_identification_number`
- `company.vat_registration_number`, `company.tax_identification_number`

Company-level overrides organization-level (a tenant may operate multiple companies with distinct registrations). These feed the receipt/invoice template + the future fiscalization provider; nullable so existing rows are unaffected (additive). Pairs with the unique-serialized-invoice-number requirement (INV-P4-4) to make the §17 receipt GRA-shaped from day one.

## 9. RBAC (charter §7) — new permissions

`pos.open_shift`, `pos.create_sale`, `pos.refund`, `pos.void_sale`, `pos.price_override`, `pos.discount_override` (manager step-up), `pos.reprint_receipt`. New role seed: `cashier` (sell + open shift), `shift_manager` (+ refund/void/override/Z-report). Override/void/refund require confirmation or approval (§22), never silent. Fast cashier switch (PIN/RFID/biometric) re-auth layered on a device-authorized terminal, working offline within the device-token grace window — biometric templates non-reversible only, never raw, never synced (§19/§25).

## 10. Value-integrity invariants (mirror Phase 2/3 discipline)

- **INV-P4-1 — idempotent sale:** a replayed offline sale (same `(tenant, idempotency_key)`) collapses to exactly one sale + one stock effect + one payment set. (Already enforced by the unique key; tested under concurrent replay.)
- **INV-P4-2 — payment balance:** Σ tender (converted to sale currency at the recorded rate) == sale total (or change issued); over/under rejected or flagged.
- **INV-P4-3 — stock deduction AND valuation through the ledger:** every sale/return line deducts via `appendStockMovement` (per-cell advisory lock) **AND runs `applyValuation`** so AVCO cells / FIFO layers actually move and COGS is recorded. **This explicitly closes ticket #8** — the known #8-class gap where `pos.createSale` appends sale movements *without* calling `applyValuation` (verified: the router does not invoke it today). Sale lines gain COGS-minor fields. Oversell emits `inventory.stock_discrepancy` (D5), never silently lost. *(Codex CRITICAL-1.)*
- **INV-P4-4 — numbering uniqueness:** no two terminals mint the same document number, online or offline (block lease + reservation). The `number_block` unique scope must be extended to include **location_id and fiscal-year** (today it is only `(tenant, company, doc_type, series)` — two locations at one company would share a range). *(Codex HIGH — verified against `numbering.ts`.)*
- **INV-P4-5 — gift-card/store-credit value is held in a stored-value ledger (audited); GL liability posting is Phase 5.** Phase 4 records issue/redemption against a balance ledger with audit, recognizing value-movement on redemption; the double-entry **liability posting** is deferred to Phase-5 accounting (Phase 4 has no GL). Downgraded from "is a liability" to avoid asserting an invariant Phase 4 cannot enforce. *(Codex MEDIUM.)*
- **INV-P4-6 — server-authoritative posting time:** device clock recorded but never used for the official posting timestamp.
- **INV-P4-7 — sale only from a sellable location:** a POS sale line's location must be `is_sellable = true` and **NOT** `is_bonded`/`is_transit`/`is_quarantine` (Phase-3 flags, verified `company.ts:70-73`). Prevents selling bonded stock without a duty release, or selling in-transit/quarantined stock. Enforced at the service AND a DB-backed test. *(Codex CRITICAL-2 — new invariant.)*
- **INV-P4-8 — SKU required on inventory-tracked lines:** `applyValuation` requires `skuId` and throws without it (verified `costing.ts:376-382`); every inventory-tracked POS line must carry a SKU, with product↔SKU↔lot tuple validation (the recurring tuple-not-just-id lesson). Product-only lines are permitted only for non-inventory items. *(Codex HIGH.)*
- **INV-P4-9 — durable offline-mutation identity:** offline mutations carry `(device_id, terminal_id, monotonic_counter)` with a **`(tenant_id, device_id, terminal_id, counter)` uniqueness** on the sync-ingestion table + a payload hash — structural ordering/dedup beyond the business idempotency key, so out-of-order/duplicate multi-terminal delivery can't double-apply. *(Codex MEDIUM.)*
- **INV-P4-10 — POS tables get composite `(tenant_id, id)` FKs:** migrate `sale.location_id`, `sale_line.sale_id`/`product_id`/`sku_id`, `invoice.sale_id`, and the `number_block` FKs to additive composite FKs against the Phase-3 `(tenant_id, id)` UNIQUE targets — the legacy POS tables still carry single-column FKs (verified `sales.ts`), leaving the H1 cross-tenant FK-bypass class open. Prove with a raw cross-tenant insert regression. *(Codex HIGH — the #5 composite-FK class extended to POS.)*
- Each invariant gets a write-path-invokes-service gate (the recurring #8-class lesson) + a real-Postgres regression.

## 11. Competitive matrix (§41) — ✅ RESEARCHED 2026-06-23 → `competitive/pos.md`

Full sourced matrix (Lightspeed X / Square Retail / Shopify POS / Odoo POS, with per-cell verification legend) lives in `docs/architecture/competitive/pos.md`. Headline findings driving the Phase-4 design:

1. **Offline is RetailOS's decisive P0 edge — the competition validates the gap.** All four are bolt-on, not offline-first: Lightspeed gates offline card on the WisePOS E **hardware**; Square enforces a **72h** upload window + per-txn cap; **Shopify POS is weakest — no offline cards, no offline refunds, frozen stock, no offline customer records**; Odoo is single-terminal browser PWA; **none** does LAN multi-terminal coordination. RetailOS's §13 three-level model leads. Phase 4 ships levels 1 + 3 hooks; LAN Edge Hub = Phase 10 (seam reserved).
2. **Commission is attribution-plus-report everywhere, not an engine** — none ships a configurable flat/%/product/category/tiered engine with statements/payouts/clawback. RetailOS's §19 engine leads (P1 differentiator; see Decision #7).
3. **Shift/cash/Z is table-stakes; blind close is the differentiator** — Odoo explicitly *shows* the theoretical balance (the opposite of blind close). RetailOS's §19 blind close + X/Z per terminal/shift is parity-plus.
4. **Distributed offline number-block leasing is a genuine differentiator Guyana makes load-bearing** — no surveyed POS publicizes it; the GRA requires a **unique serialized invoice number**, so §17 numbering is both compliance and edge (INV-P4-4).
5. **Returns + credit-note first-class, not a flag** — Shopify's offline-refund gap is the weakness; RetailOS models `saleType=return` + `originalSaleId` + first-class credit note (§17).

## 12. 🔒 LOCKED DECISIONS (locked by Kareem, 2026-06-23)

All seven are **LOCKED**. This is a decision + architecture lock — **NOT** authorization to build; Phase-4 implementation is a separate session.

1. **Guyana fiscalization → "none" provider + reserved `fiscal_document` schema seam.** 🔒 LOCKED. Ship a no-op "none" fiscalization provider (GRA mandates no fiscal device / e-invoicing — HIGH, documentary; `competitive/pos.md`). **Commit 1 reserves the `fiscal_document` table** (all-nullable `provider`/`status`/`control_number`/`signature_payload`/`qr_data`/`authority_submitted_at`/`authority_response_at`/`raw_request`/`raw_response`) **+ a nullable FK from `invoice`**, so a future GRA mandate is additive (present-but-null → present-with-value), never a breaking migration. **⚠️ CAVEAT (prominent, charter §17): this locks the ARCHITECTURE, not tax-law certainty — confirm with a Guyana tax expert before launch; if the GRA later mandates a fiscal regime, the provider interface + reserved columns are the attach point.**
2. **Offline conflict policy → D5 allow-oversell-flagged (default).** 🔒 LOCKED. POS default = allow-oversell with `inventory.stock_discrepancy` flagging (the D5 policy already wired in Phase 2/3); **hard-block configurable per location**; Edge-Hub hard-reservation deferred to **Phase 10**. The ledger stays policy-neutral; the no-negative gate is the per-location config.
3. **Sale-line quantity → int8 base-unit minor (NOT int4).** 🔒 LOCKED. Quantities are `bigint(mode:"number")` base-unit minor, applying the same range discipline as money — because weighed goods + multi-UoM at POS is a real charter §18/§19 requirement (scale-barcode parsing), and the qty-type retrofit is painful (the Phase-2 int8-quantity lesson). `qty_scale` accompanies the quantity (NULL ⇒ integer each-counts).
4. **#6 `mulDivRound` → P0 in commit 1; rounding is a CONFIGURABLE policy framework (NOT a hardcoded global rule), defaults per-line + half-even.** 🔒 LOCKED. The BigInt `mulDivRound(a, b, c, mode)` primitive is built **first** (commit 1), before any line-pricing math — VAT 14% line tax, % discounts, FX tender, and commission % all divide (Codex CRITICAL-3). **`mode` is a parameter, not a constant.** Above it sits a **config-driven rounding-policy framework** (charter §12 "country config data-driven, not hardcoded to Guyana"; §19 multi-jurisdiction tax engine), resolved via the existing settings-resolver pattern, with **three independent policy axes** so Guyana / Trinidad / Barbados / Suriname / future markets differ **without schema changes**:
   - **Currency rounding policy** (per currency): decimal **scale** + mode — e.g. GYD whole-dollar, USD scale-2; default **half-even**.
   - **Tax rounding policy** (per country / tax jurisdiction): **granularity** (round **per-line** vs per-invoice-total) + mode — default **per-line + half-even**.
   - **Tax-engine rounding** for compound/stacked taxes (per §19): order + intermediate rounding — default round-after-each-component, half-even.
   - **Defaults are platform choices because GRA mandates no algorithm** (TASK A, verified this session — the GRA publishes the 7/57 VAT fraction + worked examples with no rounding rule; the scanned VAT Act extractable text shows none either; sources in `competitive/pos.md` §fiscalization + §ERP-rounding). **Per-line granularity** matches the dominant ERP convention (Xero, QuickBooks round tax per-line then sum; Odoo/ERPNext make it configurable) and is required anyway because **line-item tax is itself a GRA invoice field**. **Half-even** is the enterprise/IFRS-aligned default (prevents directional margin drift across aggregation). Phase 5/6 reuse the SAME framework + primitive. Residual: confirm no VAT-Act/Regulations rounding clause with the tax expert (same launch check as #1).
   - **ZERO-CONFIG DEFAULT (explicit):** a **Guyana tenant invoices on day one with NO rounding setup** — the framework ships with a tested default path (**per-line + half-even**, GYD scale) applied automatically. **Configuration is the multi-jurisdiction ESCAPE HATCH, never a setup burden a tenant must complete before invoicing.** A tenant only touches rounding config to *override* the default (e.g. a different jurisdiction's per-total rule); leaving it untouched yields the tested default. The default stays per-line + half-even unless a later GRA / tax-expert confirmation requires otherwise.
5. **Returns → first-class `saleType=return` + `originalSaleId`; credit-note is a layered fiscal document type.** 🔒 LOCKED. A return is a first-class sale variant linked to its original; the **credit note is a fiscal document TYPE rendered/numbered on top** of the return (per §17 numbering), **not a separate domain entity**. Avoids a parallel returns table.
6. **Tauri offline store → SQLite; sync contract defined in Phase 4 (no UI).** 🔒 LOCKED. Desktop POS offline catalog + queue = embedded SQLite (charter §4, supermarket-scale catalogs). Phase 4 **defines the client↔server sync contract** (payload shape, idempotency, monotonic counters, block-lease hand-out); **no UI** is built.
7. **Commission timing → CONFIGURABLE `commission_accrual_policy` enum (`at_sale | at_settlement`) on organization settings, with reversal semantics specified for BOTH modes.** 🔒 LOCKED. A tenant-level `commission_accrual_policy` (`text({ enum: ["at_sale","at_settlement"] })` + CHECK — extensible-enum rule), default **`at_sale`**. **Reversal/clawback semantics are part of the lock (not deferred to implementation):**
   - **`at_sale`:** commission accrues in full when the sale completes. A **refund** (full or partial) reverses commission **proportional to the refunded value**; a **void** reverses 100%. Reversals are append-only negative commission-adjustment entries (no hard delete), audited.
   - **`at_settlement`:** commission accrues **proportional to the settled amount** as payments clear (a 40%-paid layaway accrues 40%). On **cancellation of a partially-paid credit/layaway sale**, reverse **ALL** accrued commission for that sale — commission is earned only on a **completed sale of delivered goods**, so neither a refunded deposit nor a **forfeited** deposit is commissionable (a forfeited deposit is **non-commissionable other income**, a Phase-5 GL concern). A refund of settled payment reverses its proportional accrual.
   - **Both modes:** accruals and reversals net in commission statements/payouts; a clawback against an already-paid payout carries a negative balance to the next payout cycle (payout reconciliation), never a silent deletion. Money-correctness invariant: Σ(accruals) − Σ(reversals) per rep per period == the commissionable-revenue base × rule, reconcilable from the ledger.

## 13. Testing strategy

Real-Postgres RLS coverage gate (every new tenant table); idempotent-replay concurrency test; payment-balance property test; oversell-flag test (reuse D5 harness); numbering-collision simulation (two terminals, offline blocks, **disjoint-lease assertion**); blind-close over/short; offline payload upcast; reconnection-avalanche (Redis backpressure) — per charter §26 resilience tests. Plus the Codex-driven regressions: **POS sale moves `avg_cost`/`valuation_layer` + records COGS** (#8 close, INV-P4-3); **sale rejected from bonded/transit/quarantine location** (INV-P4-7); **raw cross-tenant insert rejected** on the new composite POS FKs (INV-P4-10); **duplicate/out-of-order offline mutation deduped** (INV-P4-9). Each new mutation gets the write-path-invokes-service gate.

## 14. Codex adversarial review (2026-06-23) — findings folded in

A fresh `codex:codex-rescue` agent attacked this plan against the **real schema/services** before any decision was locked. It **confirmed** the §2 grounding (sale's `(tenant_id, idempotency_key)` unique key; sale_line/invoice/number_block/idempotency/outbox all exist as described; no payment/shift/tender/device tables) — so the codebase claims held. It found **3 CRITICAL + 4 HIGH + 3 MEDIUM + 1 LOW**, all folded into the invariants/build-order/decisions above and each verified against the schema by me:

- **CRITICAL-1** — POS sale bypasses `applyValuation` (the known #8 class). → INV-P4-3 now requires valuation + COGS; commit-4 write-path gate.
- **CRITICAL-2** — POS could sell bonded/transit/quarantine stock (Phase-3 flags unenforced). → new INV-P4-7 sellable-location guard. *(verified `company.ts:70-73`.)*
- **CRITICAL-3** — `#6 mulDivRound` is a Phase-4 hard blocker (VAT/discount/FX/commission all divide), not the optional Decision #4. → reframed Decision #4; commit 1.
- **HIGH** — legacy POS tables keep single-column FKs (H1 class open). → INV-P4-10 composite-FK migration. *(verified `sales.ts`.)*
- **HIGH** — `number_block` scope lacks location + fiscal-year. → INV-P4-4 scope extension. *(verified `numbering.ts`: key is `(tenant, company, doc_type, series)`.)*
- **HIGH** — number-block lease concurrency hand-waved. → §5 allocator + disjoint `number_lease` + advisory lock + state machine.
- **HIGH** — SKU optional in plan but `applyValuation` requires it. → INV-P4-8 SKU-required + tuple validation. *(verified `costing.ts:376-382`.)*
- **MEDIUM** — gift-card "liability" unenforceable without GL. → INV-P4-5 downgraded to stored-value ledger; GL posting Phase 5.
- **MEDIUM** — offline replay lacks durable device-counter uniqueness. → INV-P4-9 `(tenant, device, terminal, counter)` + payload hash.
- **MEDIUM** — fiscal seam too thin; reserve columns now. → §8 `fiscal_document` table reserved nullable (the "reserve deferred fields nullable, don't ship absent" lesson).
- **LOW** — Decision #1 effectively settled. → reframed as a lock recommendation.

## 15. Readiness assessment (Task C/E — 2026-06-23)

**Verdict: ✅ Phase 4 planning is COMPLETE and implementation-ready.** (Earlier verdict was B — not-ready — pending three planning artifacts; all are now closed in this pass.)

Closed in this pass:
- **Decisions** — all 7 🔒 LOCKED (§12), including the configurable rounding-policy framework (Decision #4) and the commission reversal semantics for both modes (Decision #7).
- **Event contracts** — `event-map-phase4.md` written and **shaped for the Phase-5 GL consumer** (the top former blocker): `sale.created` (extend) + `sale.refunded`/`sale.voided`/`payment.received`/`shift.opened`/`shift.closed`, carrying COGS/tax/tender breakdowns + stable reversal IDs for idempotent, order-safe posting.
- **Localization seam** — VAT Registration Number + TIN reserved on `organization` + `company` (§8); receipt is GRA-shaped (unique serialized number INV-P4-4 + mandatory fields).
- **Migration strategy** — `number_block` scope change documented as expand/contract; composite-FK migration sequenced (UNIQUE targets before FKs) (§5).
- **Cross-phase** — `cross-phase-dependencies.md` records the P2/P3→P4→P5/P6/P12 producer/consumer graph + reserved future-proofing seams.
- **Codex** — adversarial review (§14) folded; all 3 CRITICAL + 4 HIGH addressed as design requirements.

Remaining (correctly OUT of planning — for the implementation session):
- Build commit 1 first (`mulDivRound` + rounding-policy framework + composite-FK migration + `fiscal_document` + VAT/TIN seams) — it unblocks all pricing/valuation/numbering work.
- Every new tenant table gets fail-closed RLS + the coverage gate + write-path-invokes-service tests in the same commit.
- The cross-phase residuals (confirm GRA rounding/fiscal specifics + COA structure with a Guyana tax expert) before LAUNCH, not before build.

**This document is the approved design-of-record. Locking decisions + hardening the plan is NOT authorization to build — Phase-4 implementation is a separate session.**
