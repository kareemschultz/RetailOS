# Phase 4 — POS & Offline Queue — Implementation Plan (DRAFT for review)

> **STATUS: PLANNING DRAFT — NOT APPROVED, NO CODE.** Produced during the overnight autonomous run for Kareem's morning review. Decisions in the 🔒 section are **Kareem's to lock**, not the agent's.

## Confidence

- **Overall: HIGH** for the data-model, offline, numbering, shift, and RBAC design — these are grounded in (a) the **actual codebase seams** (verified by reading the schema) and (b) the **charter** (§13/§14 offline, §17 fiscal/numbering, §19 POS/money/commission), which are authoritative in-repo sources.
- **MEDIUM/SPECULATIVE** for anything competitive-comparison or Guyana-GRA-specific — see the ⚠️ banner.
- **THIS PLAN ASSUMES:** (1) Phase 3 merges as-is (the location tree, transfers, bonds, and the `sale`/`number_block` seams stay); (2) money stays integer minor units + currency + scale; (3) D5 oversell policy (allow-oversell-with-flagging default, configurable hard-block) carries into POS unchanged; (4) the POS sale remains idempotent end-to-end on `(tenant_id, idempotency_key)`; (5) no UI is built in this phase — backend mutations, queue, and Tauri offline-store contract only.

> ## ⚠️ LIVE RESEARCH PENDING (session limit during authoring)
> Web research agents were blocked by an API session limit (resets 2pm America/Guyana). Per charter §40, competitor capability claims and Guyana-GRA fiscal facts were **NOT fabricated**. The **Competitive matrix (§11)** and the **Guyana fiscalization specifics (§8)** below are marked with their research agenda — **re-run that research and fill/verify before locking**. Everything else is codebase- and charter-grounded.

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
1. **Shift + cash management:** `shift` (open/close, opening float, blind-close counted vs expected, over/short), `cash_movement` (pay-in/pay-out/drop). X/Z report read models.
2. **Payment/tender model:** `payment` + `tender` (cash/card/bank-transfer/mobile-money/cheque/store-credit/gift-card/mixed), split + multi-currency tender, change calc. Gift-card/store-credit as **liabilities** (recognized on redemption, not issue — charter §19).
3. **POS sale mutation (extended):** sale/line extension, sale→stock-deduction (reuse `appendStockMovement`; D5 oversell flag), sale→payment, sale→invoice, returns/refunds/exchanges (first-class, link `originalSaleId`), held/parked sales. Idempotent end-to-end.
4. **Commission engine:** sales-rep at checkout; flat/%/product/category/tiered; refund/void adjustment.
5. **Document numbering reservation:** distributed/offline-safe number-block lease so two terminals never mint the same number; gap/void tracking.
6. **Offline queue + sync ingestion:** server-side sync-batch ingestion (idempotency keys, monotonic counters, device/terminal IDs, server-authoritative time), reconnection backpressure (Redis), conflict surfacing. The client-side Tauri/Dexie store contract is defined here (no UI).
7. **Fiscalization SEAM (interface only):** pluggable provider interface (submit/clear/sign/status/credit-note/void/logs); a no-op "none" provider for Guyana-today. **No real integration.**
8. **RBAC + robust seed + API contracts + §45 reassessment.**

## 4. Offline conflict policy (charter §13/§14; reuse D5)

Three canonical policies (charter §14) — RetailOS picks **per tenant/location**:
1. allow-oversell-with-flagged-backorder (the D5 default already wired in Phase 2/3: negative ledger + `inventory.stock_discrepancy` event);
2. hard local reservation via Edge Hub (Phase 10 dependency);
3. optimistic deduction + compensating correction on sync conflict.

Phase 4 ships **policy 1 + 3 hooks** (Edge-Hub hard-reservation is Phase 10). Append-only events (sales, payments, ledger, audit) replay in order with idempotency keys; mutable shared state (stock-on-hand) never blind last-write-wins — ledger truth dominates. **Device clocks untrusted; server time authoritative for posting** (§14). Every offline mutation carries deviceId, terminalId, monotonic counter, local ts, payload version, idempotency key.

## 5. Document numbering integrity (charter §17)

Sequential tamper-evident numbering per company/location/fiscal-year/doc-type/series. Offline terminals **reserve number blocks** issued by cloud (or Edge Hub in Phase 10); never let two terminals mint the same number. Track gaps, voids, out-of-sequence, unused reserved, expired blocks. Credit note is a first-class fiscal document type (not a refund flag). The existing `number_block` becomes a **leasable** block: a terminal leases `[start,end]`, advances `next` locally offline, returns/reconciles on sync.

## 6. Shift & cash (charter §19)

Open/close shift, multi-currency cash float, **blind close** (cashier enters counted cash WITHOUT seeing expected; system computes over/short for the manager's audit log), X-report (mid-shift snapshot) + Z-report (end-of-day final settlement) per terminal/shift. Distinguish **standalone** card payment (system only records a card was used) from **integrated** EFTPOS (POS pushes exact amount to terminal) to eliminate double-entry (§19; ties to Phase 9 hardware).

## 7. Money / pricing / tax (charter §19) — reuse

Integer minor units only (amount+currency+scale together); one rounding policy. Split-currency payments + FX at POS (realized gain/loss is a Phase-5 accounting concern; POS records the tender currency + rate). Tax-inclusive vs exclusive centrally; line-item tax; consistent rounding. **Issue #6 (BigInt `mulDivRound`) becomes load-bearing here** if POS does tax/discount division — must be resolved before POS valuation math (Phase-5 blocker pulled forward into Phase 4 if needed).

## 8. Fiscalization seam (charter §17) — ⚠️ LIVE RESEARCH PENDING

Reserve a **pluggable fiscalization provider interface** from day one: `submit/clear`, `sign`, `statusTrack`, `creditNote`, `voidRules`, `fiscalLogs`. A "none" provider (no-op) is the Guyana-today default **IF Guyana has no mandatory electronic-fiscal-device regime** — **this is the single most important fact to verify** (it decides hard-dependency vs seam). Charter §17 already says "Confirm Guyana GRA requirements before launch; do not hardcode one country's fiscal rules."
- **Research agenda (run after session reset):** (1) Does the Guyana Revenue Authority mandate electronic fiscal devices / e-invoicing / signed receipts? (2) Guyana VAT rate + mandatory receipt fields (TIN, VAT breakdown). (3) 2–3 regional mandatory-fiscalization models (device vs cloud-clearance vs signed-receipt) so the provider interface covers them. Mark HIGH/MEDIUM/SPECULATIVE; confirm with a Guyana tax expert before launch.

## 9. RBAC (charter §7) — new permissions

`pos.open_shift`, `pos.create_sale`, `pos.refund`, `pos.void_sale`, `pos.price_override`, `pos.discount_override` (manager step-up), `pos.reprint_receipt`. New role seed: `cashier` (sell + open shift), `shift_manager` (+ refund/void/override/Z-report). Override/void/refund require confirmation or approval (§22), never silent. Fast cashier switch (PIN/RFID/biometric) re-auth layered on a device-authorized terminal, working offline within the device-token grace window — biometric templates non-reversible only, never raw, never synced (§19/§25).

## 10. Value-integrity invariants (mirror Phase 2/3 discipline)

- **INV-P4-1 — idempotent sale:** a replayed offline sale (same `(tenant, idempotency_key)`) collapses to exactly one sale + one stock effect + one payment set. (Already enforced by the unique key; tested under concurrent replay.)
- **INV-P4-2 — payment balance:** Σ tender (converted to sale currency at the recorded rate) == sale total (or change issued); over/under rejected or flagged.
- **INV-P4-3 — stock deduction through the ledger only:** every sale line deducts via `appendStockMovement` (per-cell advisory lock); oversell emits `inventory.stock_discrepancy` (D5), never silently lost.
- **INV-P4-4 — numbering uniqueness:** no two terminals mint the same document number, online or offline (block lease + reservation).
- **INV-P4-5 — gift-card/store-credit are liabilities:** recognized on redemption, not issue; balance audited.
- **INV-P4-6 — server-authoritative posting time:** device clock recorded but never used for the official posting timestamp.
- Each invariant gets a write-path-invokes-service gate (the recurring #8-class lesson) + a real-Postgres regression.

## 11. Competitive matrix (§41) — ⚠️ LIVE RESEARCH PENDING

The parity program requires a `| Feature | Lightspeed | Square | Shopify POS | Odoo POS | RetailOS (Supported/Planned/Not planned) |` matrix per dimension (sale/payment model, offline sync, shift/cash, numbering, commission, returns). **Authoring blocked by the session limit; do NOT fill from memory.** Research agenda to run after reset: enumerate each system's offline model, tender model, shift/Z-report, and override/permission model from official docs; classify P0/P1/P2/P3; record in `docs/architecture/competitive/pos.md`. The dimensions to compare are enumerated in §2–§9 above.

## 12. 🔒 DECISIONS NEEDING KAREEM (lock before Phase 4 code)

1. **Guyana fiscalization (load-bearing):** confirm whether GRA mandates electronic fiscal devices / e-invoicing. If NO → ship the pluggable seam + "none" provider. If YES → the provider interface must be built against the real regime in Phase 4, not deferred. **Needs a Guyana tax-expert confirmation.**
2. **Offline conflict policy default:** confirm D5 (allow-oversell-flagged) is the POS default, with hard-block configurable per location; Edge-Hub hard-reservation deferred to Phase 10.
3. **Sale-line qty type:** keep int4 each-counts, or move to int8 base-unit minor (to support weighed goods at POS now vs later)?
4. **#6 precision:** is the BigInt `mulDivRound` decision pulled into Phase 4 (if POS does tax/discount division) or can POS avoid division until Phase 5?
5. **Returns model:** first-class `saleType=return` + `originalSaleId` (recommended) vs a separate credit-note entity now.
6. **Tauri offline store:** confirm SQLite (charter §4) for the desktop POS offline catalog + queue; define the sync contract in Phase 4 (no UI).
7. **Commission timing:** accrue at sale vs at settlement; refund/void clawback policy.

## 13. Testing strategy

Real-Postgres RLS coverage gate (every new tenant table); idempotent-replay concurrency test; payment-balance property test; oversell-flag test (reuse D5 harness); numbering-collision simulation (two terminals, offline blocks); blind-close over/short; offline payload upcast; reconnection-avalanche (Redis backpressure) — per charter §26 resilience tests. Each new mutation gets the write-path-invokes-service gate.
