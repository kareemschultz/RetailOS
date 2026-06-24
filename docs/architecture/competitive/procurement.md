# Procurement — Competitive Analysis

- Date: 2026-06-23 · Charter ref: §41 (parity program), §18 (procurement + bonded/import/landed-cost), §12 (Caribbean import market)
- Companion: `phase-6-implementation-plan.md` · feeds the Phase-6 🔒 decisions.
- Method: **partially live-verified** (2026-06-23). Cells: **(v)** official-doc/comparison-verified · **(i)** inferred · **(u)** unverified/knowledge-level (charter §40). Skeleton-level pass; deepen before Phase-6 code.

> **Products surveyed (5):** Cin7 (Core/Omni), Fishbowl, Zoho Inventory, inFlow, Odoo Purchase. The discriminators for RetailOS are **landed-cost allocation on its own valuation ledger** and **bonded-import unification** (a bond receipt and a GRN are the same valued-receipt shape) — areas tied to the Caribbean import/customs market (§12) where RetailOS already shipped the Phase-3 bond seams.

---

## Feature matrix (parity surface)

Legend: **Y** · **P** partial/add-on · **N** · verification **(v)/(i)/(u)**. RetailOS: **Planned-P6** / **Planned** / **Seam-only** / **Already shipped**.

| Feature | Cin7 | Fishbowl | Zoho Inventory | inFlow | Odoo Purchase | RetailOS | Priority |
|---|---|---|---|---|---|---|---|
| Suppliers + contacts + performance | Y (u) | Y (u) | Y (u) | Y (u) | Y (u) | **Planned-P6** | P0 |
| Purchase order + approval workflow | Y (u) | Y (u) | Y (u) | Y (u) | Y (u) | **Planned-P6** (PO thresholds → approval, §22) | P0 |
| GRN / goods receipt + partial receiving | Y (u) | Y (u) | Y (u) | Y (u) | Y (u) | **Planned-P6** (reuse valued-receipt engine — INV-P6-1) | P0 |
| Receiving posts to a valuation ledger | Y — FIFO/landed (v) | Y (u) | P (u) | P (u) | Y (u) | **Already shipped engine** (appendStockMovement + applyValuation) | P0 (differentiator: same engine as bond/transfer) |
| Landed-cost allocation (freight/insurance/duty → unit cost) | Y — tariffs/landed cost (v) | P (u) | P (u) | P (u) | Y — landed cost (u) | **Planned-P6** (exact-integer largest-remainder, INV-P6-2) | P0 (§12) |
| Landed-cost basis configurable (value/weight/qty) | P (u) | P (u) | N (u) | N (u) | P (u) | **Planned-P6** (Decision #3) | P1 |
| Three-way match (PO ↔ GRN ↔ bill) | Y (u) | P (u) | P (u) | P (u) | Y (u) | **Planned-P6** (INV-P6-3; tolerance = Decision #4) | P0 |
| Supplier bill + vendor payment (→ AP) | Y (u) | P — via QBO/Xero (u) | Y (u) | P (u) | Y (u) | **Planned-P6** (posts through Phase-5 AP) | P0 |
| Import batch / container / freight / customs tracking | Y (u) | P (u) | P (u) | N (u) | P (u) | **Planned-P6** (generalize Phase-3 customs/landed-cost refs) | P1 (§12) |
| **Bonded / customs-bonded receiving** | P (u) | N (u) | N (u) | N (u) | N (u) | **Already shipped (P3) + unify in P6** (Decision #1) | P0 (§12 differentiator) |
| Reorder suggestion → PO | Y (u) | Y (u) | Y (u) | Y (u) | Y (u) | **Planned-P6** (consume Phase-2 `reorder_rule`) | P1 |
| AI/OCR invoice parsing | P — add-on (u) | N (u) | P (u) | N (u) | P (u) | **Seam-only** (provider interface, §18; not built) | P2 |

## Parity takeaways for Phase 6

1. **Receiving is a solved shape for RetailOS — reuse, don't rebuild.** A GRN line is a **valued stock receipt**, identical to a bond/transfer receipt → reuse `appendStockMovement` + `applyValuation`. The Phase-3 `bond_receipt` is a specialized import GRN; Decision #1 is whether to **unify** them into one valued-receipt service (recommended — avoids the #8-class "two divergent write paths" risk). This is the structural advantage: competitors bolt landed cost onto an inventory module; RetailOS already owns the valuation ledger.
2. **Landed-cost allocation is the load-bearing piece — and it forces the deferred FIFO decision.** Cin7/Odoo allocate freight/duty/insurance into unit cost; this is the SAME shape as the Phase-3 bond-release value-only duty add (INV-5: allocate a value across lines, raise cost basis). **But the Phase-2 OPEN decision — FIFO value-only allocation, currently `throws` in `applyValuation` — becomes load-bearing here** (INV-P6-4, Decision #2): landed cost on FIFO items needs the allocation policy Phase 2 deferred. AVCO landed cost reuses the existing value-only seam; only FIFO needs the new additive primitive. **#6 BigInt `mulDivRound` is required** (allocation divides) — shared with Phase 5.
3. **Conservation discipline carries over** — total allocated landed cost == declared freight+insurance+duty, exact-integer largest-remainder split (mirror the bond-release F3 attribution discipline; no rounding leak). INV-P6-2.

## Localization — Guyana / customs (verified 2026-06-23)

- **Imports run on ASYCUDA World** with an electronic **Single Administrative Document (eSAD)**; accompanying docs: commercial invoice, bill of lading/airway bill (freight-certified stamp), **CARICOM Certificate of Origin**, import licence, tax-exemption/CG letter. → the import-batch model should reserve fields for the eSAD/lodgement number, bill of lading, and CARICOM CoO.
- **Customs value = transaction value on a CIF basis** (invoice price + **freight + insurance** + related costs); **import VAT (14%) is charged on CIF + import duties + other charges.** → this defines the landed-cost composition RetailOS must allocate: CIF + duty → unit cost basis. INV-P6-2's "declared total" = CIF freight/insurance + CET duty.
- **CARICOM Common External Tariff (CET): 5%–20%** for most goods (40% only on specified agricultural products). → the duty estimate on an import batch is CET-rate-driven; reserve a tariff/HS-code seam (not built in P6 — reference only).
- **Private Bonded Warehouse under suspension regimes** — confirms the Phase-3 bonded design (duty/VAT suspended until release); Phase-6 import-into-bond is a GRN into a bonded location (INV-P6-5). *(Confirm exact ASYCUDA field mapping + current CET schedule with a Guyana customs broker before building import tracking.)*

## Sources

- [Cin7 — inventory ERP (FIFO costing, landed costs, tariffs)](https://www.cin7.com/)
- [Fishbowl Inventory](https://www.fishbowlinventory.com/)
- [Three-way matching in accounts payable (PO/GRN/invoice)](https://ramp.com/blog/accounts-payable/3-way-match)
- [Guyana Revenue Authority — Imports (ASYCUDA / eSAD)](https://www.gra.gov.gy/business/customs-and-trade/imports/)
- [Guyana — Import Requirements and Documentation (US Dept of Commerce)](https://www.trade.gov/country-commercial-guides/guyana-import-requirements-and-documentation)
- [Guyana — Import Tariffs (CET 5–20%)](https://www.trade.gov/country-commercial-guides/guyana-import-tariffs)
- [Guyana — Customs Regulations (CIF valuation)](https://www.trade.gov/country-commercial-guides/guyana-customs-regulations)
