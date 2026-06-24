# Phase 6 — Procurement — Plan SKELETON (DRAFT for review)

> **STATUS: PLANNING SKELETON — HARDENED by Codex review (2026-06-23) — NOT APPROVED, NO CODE.** Research complete + adversarial Codex review folded in (§7). Decisions are Kareem's to lock. Hardening a plan is NOT authorization to build.

## Confidence

- **MEDIUM** (skeleton). Grounded in **charter §18** (procurement + bonded/import requirements) and the **codebase** (verified: NO supplier/PO/GRN/vendor-bill schema exists; the Phase-3 bond receipt + customs/landed-cost **reference seams** already exist and are the natural attach points).
- **THIS PLAN ASSUMES:** Phases 2–5 merge first; procurement receipts feed the inventory ledger via the existing `appendStockMovement` + valuation engine (a GRN receipt is a valued stock receipt, exactly like a bond receipt); landed-cost allocation posts through Phase-5 accounting.
- **✅ RESEARCH COMPLETE (2026-06-23):** competitive (Cin7/Fishbowl/Zoho Inventory/inFlow/Odoo Purchase) + Guyana customs/import specifics filled in `competitive/procurement.md`. Headline: receiving is a **solved valued-receipt shape** (reuse `appendStockMovement`+`applyValuation`, unify bond+GRN — Decision #1); landed cost forces the **deferred FIFO value-only allocation** decision (Decision #2); Guyana imports = **ASYCUDA/eSAD**, customs value **CIF + duty**, **CARICOM CET 5–20%**, private bonded warehouse under suspension (validates Phase-3 bonded design).

## 1. Scope (charter §31 Phase 6 / §18)

Suppliers + contacts, purchase requests/orders + approvals, GRNs (goods received notes) + partial receiving, supplier invoices/bills, vendor credits/payments, **landed costs** (freight/insurance/duty allocation across lines), import batches + container/freight/customs tracking, **bond receiving** (ties to the Phase-3 bond receipt), purchase history, supplier performance, reorder suggestions (the Phase-2 `reorder_rule` already exists → procurement consumes it). The Applied-AI/OCR invoice-parsing seam (§18) is a reserved provider interface, not built.

## 2. Codebase grounding (verified)

- **No procurement tables.** Build `supplier`, `supplier_contact`, `purchase_order` + `po_line`, `goods_receipt` (GRN) + `grn_line`, `supplier_bill` + `bill_line`, `landed_cost` + allocation, `import_batch`.
- **Reuse, don't rebuild:** a GRN receipt is a **valued stock receipt** → reuse `appendStockMovement` + `applyValuation` (same engine as bond/transfer receipts). The Phase-3 `bond_receipt` is effectively a specialized import GRN — Phase 6 should generalize the receiving path so bond receipt and GRN share machinery (a likely refactor-to-unify, flagged as a decision).
- **Landed-cost allocation is the load-bearing piece:** freight/insurance/duty must allocate across PO/GRN lines into each item's cost basis. This is the SAME shape as the bond-release value-only duty add (INV-5) — allocate a value across lines and raise cost basis. **The Phase-2 OPEN decision "FIFO value-only allocation" (currently rejected/`throws`) becomes load-bearing here**: landed cost on FIFO items needs the allocation policy that Phase 2 deferred. **#6 BigInt `mulDivRound` is required** (allocation divides).
- **Reorder:** `reorder_rule` + `reorderEvaluate` exist (Phase 2, suggestions-only, manager-approval per D7) → procurement turns an approved suggestion into a PO.
- **AP / accounting is an EVENT seam, NOT direct coupling (Codex HIGH):** Phase 5 consumes **idempotent events**, so Phase 6 must EMIT named contracts, not call accounting services. Emit: `procurement.grn_received`, `supplier_bill.posted`, `supplier_payment.recorded`, `landed_cost.allocated`, `purchase_price_variance.flagged`. The **`landed_cost.allocated` payload** must carry: cost-pool id, **payable account source** (freight supplier vs customs authority), clearing-account role, **per-line allocated inventory-value delta**, and the rounding/variance line — so Phase 5 can post freight-clearing/duty-payable correctly. These contracts go in a future `event-map-phase6.md` shaped for the Phase-5 consumer (the same discipline as `event-map-phase4`).

## 3. Load-bearing invariants

- **INV-P6-1 — receiving goes through the ledger:** every GRN line is a valued `appendStockMovement` receipt; partial receipts accumulate against the PO line; over-receipt flagged. **GRN receiving-location rule (Codex HIGH):** a normal GRN receives ONLY into a non-bonded, non-transit warehouse; a bonded import GRN receives ONLY into `is_bonded=true`; **never** into `is_transit`/`is_quarantine`. (Mirrors the Phase-4 sellable-location guard INV-P4-7; verified the flags exist `company.ts:70-73`.)
- **INV-P6-2 — landed-cost conservation, PER COST POOL independently:** total allocated landed cost == declared freight+insurance+duty, exact-integer largest-remainder (mirror the bond-release F3 split — verified `bond_release.ts:289-333`). **Each cost pool is allocated in its OWN largest-remainder pass on its OWN basis (freight by weight, duty by customs value — Decision #3), then summed per line — never blend pools with different bases into one split or conservation breaks** (Codex MEDIUM). A **zero-basis fallback** is required (e.g. a line with weight=0 when freight allocates by weight).
- **INV-P6-3 — three-way match (many-to-many):** PO ↔ GRN ↔ supplier bill reconcile. **The model is many-to-many** — one PO line ↔ many GRN lines; one GRN line ↔ many bill lines — so an explicit match/allocation entity (`grn_bill_line_match` / `po_bill_match`) links them; per PO line track **qty ordered / received / billed / returned / over-received** (Codex MEDIUM). Variance flagged (§26).
- **INV-P6-4 — landed cost on FIFO needs the deferred allocation policy (still THROWS):** verified `applyValuation` rejects a FIFO value-only adjustment at `costing.ts:401-405` ("not yet supported — see OPEN decision"). Decision #2 must resolve **which `valuation_layer` rows receive the allocation** — only still-**open** layers (`qty_remaining > 0`) at allocation time, vs all layers from that receipt. **If stock from a target layer was already SOLD, the allocation is a COGS true-up VARIANCE posting, not a simple value-only write** (Codex HIGH). Resolve before any FIFO landed-cost implementation.
- **INV-P6-5 — bonded import & GRN share a PRIMITIVE, not a service (corrected — Codex HIGH):** `appendStockMovement` + `applyValuation` is already the shared low-level valued-receipt primitive (verified sole mutator `stock-ledger.ts:44-50`; bond calls it `bond.ts:181-197`). **GRN and bond stay as SEPARATE wrappers with distinct invariants** — bond enforces `is_bonded`, positive unit cost (F5), AVCO-only, lot-SKU tuple (verified `bond.ts:83/96-101/175`); GRN must not. **A single broad service with caller flags would RESTATE the #8 "write path silently routes around the invariant" class — the opposite of avoiding it.** Each wrapper carries its own **router-level write-path test** (ledger + valuation + event + audit all produced, as the bond router test does `vs1.ts:3326-3360`), not just a service test.
- **INV-P6-6 — RLS + H1 tuple validation across the procurement graph (Codex HIGH):** every new tenant table (`supplier`, `supplier_contact`, `purchase_order`, `po_line`, `goods_receipt`, `grn_line`, `supplier_bill`, `bill_line`, `landed_cost`, `lc_allocation`, `grn_bill_line_match`, `import_batch`) gets `tenant_id` + a composite `(tenant_id, id)` UNIQUE target + a migration RLS block + the coverage gate green on the same commit (supplier RLS is **mandatory, not a decision**). Beyond visibility, validate the **tuple** relationships (FK existence bypasses RLS — the H1 lesson): PO↔supplier/company, PO line↔PO, GRN line↔GRN+PO line, bill line↔bill+GRN/PO line, SKU↔product, lot↔SKU, receiving-location↔company.

## 4. Proposed build order (commits) — refine after research

1. Suppliers + contacts + supplier performance seam.
2. PO + po_line + approval workflow (PO thresholds → approval, §22).
3. GRN + partial receiving (reuse the valued-receipt engine; unify with bond receipt).
4. Landed cost + allocation (resolve the FIFO allocation policy + #6 first).
5. Supplier bill + three-way match + vendor payment (posts through Phase-5 AP).
6. Import batch / container / freight / customs tracking (generalize the Phase-3 customs/landed-cost reference seams into real tracking).
7. Reorder-suggestion → PO conversion (consume `reorder_rule`).
8. RBAC (`procurement.create_po/approve_po`, `warehouse.receive`) + seed + contracts + §45 reassessment. AI/OCR invoice-parsing = reserved provider interface only.

## 5. 🔒 DECISIONS NEEDING KAREEM

**Locked prerequisites (NOT open — Codex):**
- **Precision** — NOT a Phase-6 decision. FIFO allocation math cannot start until the Phase-4 `mulDivRound` BigInt primitive exists; Phase 6 reuses the Phase-4 rounding-policy framework unchanged.
- **Supplier RLS + composite FK** — mandatory (the coverage gate fails any tenant table without RLS), not a question. See INV-P6-6.
- **Shared receiving primitive, separate wrappers** — the bond/GRN relationship is settled (INV-P6-5): extract/keep the `appendStockMovement`+`applyValuation` primitive; do NOT build a flagged super-service.

**Genuinely open (Kareem to decide):**
1. **FIFO landed-cost allocation policy** (resolves the Phase-2 OPEN decision; `applyValuation` currently throws): allocate to **open layers only** (`qty_remaining > 0`) vs all layers from the receipt; and the **COGS true-up** rule when target stock was already sold (variance posting). *Load-bearing — blocks FIFO landed cost.*
2. **Landed-cost allocation basis per cost pool:** by value / weight / quantity, **configurable per cost type** (freight by weight, duty by customs value) — each pool allocated independently (INV-P6-2) with a zero-basis fallback.
3. **Multi-currency landed cost (NEW — Codex MISSING):** freight invoices, customs duties, and supplier bills may each arrive in **different currencies**. Decide PO/bill/freight/duty currency, the FX rate **date + source**, and whether `lc_allocation` stores **both** transaction-currency and functional-currency amounts. (Ties to the Phase-5 functional-currency decision.)
4. **Over-receipt disposition (NEW — Codex; §22):** does an over-receipt **block** GRN posting, **require approval**, or **post to an unmatched-receipt liability** account pending PO amendment?
5. **Three-way-match tolerance:** auto-approve within X% (qty/price), else flag for review/approval (§22).

## 6. ✅ Research complete (2026-06-23) → `competitive/procurement.md`

Competitive (Cin7/Fishbowl/Zoho Inventory/inFlow/Odoo Purchase) + Guyana customs localization filled in `docs/architecture/competitive/procurement.md` (sourced, per-cell legend). Key facts: bond receipt + GRN share a **valued-receipt primitive** (separate wrappers — Decision/INV-P6-5, avoids the #8 divergent-path risk); **landed cost = CIF (invoice+freight+insurance) + CET duty** allocated per cost pool into unit cost, conserved exactly (INV-P6-2); the **FIFO value-only allocation** Phase-2 deferred is now load-bearing (Decision #1 — `applyValuation` `throws`); precision reuses the Phase-4 framework. **Residual:** confirm exact ASYCUDA field mapping + current CET schedule with a Guyana customs broker before building import tracking (skeleton-level; deepen before Phase-6 code).

## 7. Codex adversarial review (2026-06-23) — findings folded in

A fresh `codex:codex-rescue` agent attacked this skeleton against the **real schema/services**. It **confirmed** the foundation (FIFO value-only throws `costing.ts:401-405`; `appendStockMovement` is the sole stock mutator and bond already calls it + `applyValuation` — the shared primitive exists; bond schema keeps its customs/landed-cost reference seams; no procurement schema yet; `reorder_rule` exists; Phase 5 is event-driven). It found **6 HIGH + 6 MEDIUM**, all folded above, each re-verified by me:

- **HIGH** — "unify bond+GRN into one service" was mis-framed; a flagged super-service restates the #8 class. → INV-P6-5 corrected to **shared primitive + separate wrappers**, each with a router-level write-path test.
- **HIGH** — FIFO landed-cost layer policy under-specified (open layers vs all; COGS true-up when sold). → Decision #1 + INV-P6-4.
- **HIGH** — AP/accounting must be an **event seam** (Phase 5 = idempotent consumer), contracts unnamed. → §2 event contracts (`grn_received`/`supplier_bill.posted`/`supplier_payment.recorded`/`landed_cost.allocated`/`purchase_price_variance.flagged`) + the `landed_cost.allocated` payload spec.
- **HIGH** — GRN receiving-location flags unspecified. → INV-P6-1 rule (non-bonded/non-transit for normal; `is_bonded` only for import).
- **HIGH** — RLS/H1 tuple-validation discipline not stated. → INV-P6-6 (every tenant table RLS + composite FK + the full tuple-check list).
- **HIGH** — unification risked losing #8 write-path test discipline. → carried into INV-P6-5.
- **MEDIUM** — per-pool independent allocation + zero-basis fallback (INV-P6-2); many-to-many match table (INV-P6-3); multi-currency landed cost (new Decision #3); over-receipt disposition (new Decision #4); precision falsely-open → prerequisite; supplier RLS mandatory not a decision.
