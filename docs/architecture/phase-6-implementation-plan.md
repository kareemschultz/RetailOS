# Phase 6 — Procurement — Plan SKELETON (DRAFT for review)

> **STATUS: PLANNING SKELETON — NOT APPROVED, NO CODE.** Overnight-run draft for Kareem's morning review. Decisions are Kareem's to lock.

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

## 3. Load-bearing invariants

- **INV-P6-1 — receiving goes through the ledger:** every GRN line is a valued `appendStockMovement` receipt; partial receipts accumulate against the PO line; over-receipt flagged.
- **INV-P6-2 — landed-cost conservation:** the total allocated landed cost equals the declared freight+insurance+duty (no rounding leak — exact-integer allocation, largest-remainder; mirror the bond-release F3 split discipline).
- **INV-P6-3 — three-way match:** PO ↔ GRN ↔ supplier bill quantities/prices reconcile; variance flagged (charter §26 data-quality).
- **INV-P6-4 — landed cost on FIFO** needs the deferred allocation policy (the Phase-2 OPEN decision) resolved — currently `applyValuation` THROWS for a FIFO value-only adjustment. This must be decided before FIFO landed cost.
- **INV-P6-5 — bonded import path unified:** a bonded import batch is a GRN into a bonded location → confirm bond receipt and GRN share the receiving service (avoid two divergent receiving paths — the #8 "two write paths" risk).

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

1. **Unify bond receipt + GRN receiving?** (Recommend yes — one valued-receipt service, bond is a specialization. Avoids divergent paths.) Confirm scope/timing.
2. **FIFO landed-cost allocation policy** — resolve the Phase-2 OPEN decision (`applyValuation` currently throws for FIFO value-only). What allocation rule for FIFO layers?
3. **Landed-cost allocation basis:** by value, by weight, by quantity, or configurable per cost type (freight by weight, duty by value)?
4. **Three-way-match tolerance:** auto-approve within X%, else flag for review?
5. **#6 precision** (shared with Phase 5): the BigInt `mulDivRound` + rounding policy must land before allocation math.

## 6. ✅ Research complete (2026-06-23) → `competitive/procurement.md`

Competitive (Cin7/Fishbowl/Zoho Inventory/inFlow/Odoo Purchase) + Guyana customs localization filled in `docs/architecture/competitive/procurement.md` (sourced, per-cell legend). Key facts: **unify bond receipt + GRN** into one valued-receipt service (Decision #1, avoids the #8-class divergent-path risk); **landed cost = CIF (invoice+freight+insurance) + CET duty** allocated into unit cost (Decision #3 basis), conserved exactly (INV-P6-2); the **FIFO value-only allocation** Phase-2 deferred is now load-bearing (Decision #2 — `applyValuation` currently `throws`); **#6 `mulDivRound`** required (Decision #5). **Residual:** confirm exact ASYCUDA field mapping + current CET schedule with a Guyana customs broker before building import tracking (skeleton-level; deepen before Phase-6 code).
