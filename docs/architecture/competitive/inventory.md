# Inventory & Product Engine — Competitive Analysis

- Date: 2026-06-22 · Charter ref: §41 (parity program), §18 (inventory engine), §12 (Caribbean/dev-market)
- Companion: `docs/architecture/module-specs/inventory.md` (§42 requirements) · feeds the Phase-2 HARD-STOP decisions.
- Method: features captured from each vendor's **official documentation** (URLs cited inline below). Claims that could not be confirmed from an official page are marked **(unverified)** — per charter §40, do not assert unverified facts as parity gaps.

> **Products surveyed (8):** Cin7 Core (ex-DEAR), Fishbowl, Zoho Inventory, inFlow, Finale, Odoo Inventory, Oracle NetSuite, ERPNext. These are the §41 inventory/warehousing leaders plus the ERP players whose inventory engines set the parity bar. Retail-POS-specific products (Lightspeed/Square) are surveyed in the POS competitive doc (Phase 4).

---

## Feature matrix

Legend: **Y** = supported · **P** = partial/limited · **N** = not offered · **?** = unverified from official docs. RetailOS column: **Supported** (in VS#1/shipped), **Planned-P2** (designed for Phase 2), **Planned** (later phase), **Not planned**.

| Feature | Cin7 Core | Fishbowl | Zoho Inv | inFlow | Finale | Odoo | NetSuite | ERPNext | RetailOS | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| Weighted-average / AVCO costing | P (valuation only) | Y | Y | Y (default) | Y (only) | Y | Y (default) | Y | **Planned-P2 (DEFAULT)** | P0 |
| FIFO costing (cost layers) | Y | Y | Y | Y | N | Y | Y | Y (default) | **Planned-P2** (per tenant/cat/product) | P0 |
| LIFO costing | N | Y | N | Y | N | N (picking only) | Y | Y | **Not planned** (IFRS-prohibited; flag-only) | P2 |
| Standard / specific-ID costing | Y (Special) | Y (Std) | N | N | N | Y (Std) | Y (both) | N | **Not planned** (Phase: mfg) | P2 |
| Per-product/category costing config | Y (per-product) | N (global, DB-locked) | Y (per-item) | N (global) | per-product avg | Y (per-category) | Y (per-item, locked) | Y (global + item override) | **Planned-P2** (tenant→cat→product) | P0 |
| Multi-UoM (buy/stock/sell) | Y (per-AUOM SKU) | Y | Y (6 dp) | Y | P (no auto-convert) | Y (per category) | Y (no fractional base) | Y (whole/decimal) | **Planned-P2** | P0 |
| Lot / batch + expiry | Y | Y | Y | ? | Y | Y | Y | Y | **Planned-P2** | P0 |
| Automated FEFO picking | Y (warn/enforce) | ? | P (manual) | ? | P (manual) | Y | Y (SuiteApp) | Y | **Planned-P2** (advisory+enforce) | P0 |
| Serial tracking | Y | Y | Y (XOR batch) | Y | Y | Y | Y | Y | **Planned-P2 (stub)**; flows Phase 4 | P1 |
| Warranty / RMA on serial | ? | ? | ? | ? | Y (return) | P | Y | Y (Warranty/AMC) | **Planned** (CRM/Service) | P2 |
| Valuation + COGS reporting | Y | Y | Y | Y (avg only) | Y | Y (real-time GL) | Y | Y (perpetual GL) | **Planned-P2** (report); GL Phase 5 | P0 |
| Audited revaluation / cost change | Y (adj) | Y (adj) | ? | Y (recalc) | Y (bulk) | Y (manual) | Y (CSV) | Y (reconciliation) | **Planned-P2** (revaluation event) | P1 |
| Landed-cost allocation | P | P | ? | **Y (native)** | **Y (weighted)** | Y | Y | Y | **Planned** (Phase 6 procurement) | P1 |
| Reorder point / min-max | Y (per loc) | Y | P (single) | Y (per loc) | Y (min/max) | Y (min/max) | Y (per loc) | Y | **Planned-P2** (suggest only) | P0 |
| Auto-PO / demand-based reorder | Y (AI) | Y (MRP) | ? | ? | Y (velocity) | Y (auto) | Y (planning) | Y (auto MR) | **Planned** (Phase 6) | P1 |
| Barcode scan (EAN/UPC/Code128/GS1) | Y | Y | Y | Y | Y (GS1) | Y | Y (GS1-128) | Y (multi) | **Planned-P2** | P0 |
| Variable-weight / price-embedded barcode | **Y** | N | N | N | P (scale) | **Y** | N | N | **Planned-P2** (configurable parser) | P0 (supermarket) |
| Multi-location + transfers | Y | Y | Y | Y | Y | Y | Y | Y (tree) | **Planned** (Phase 3) | P0 |
| Bin / zone (within-warehouse) | Y (pick zones) | Y | N | Y (sublocation) | Y (sublocation) | Y (putaway) | Y (WMS) | P (sub-wh) | **Planned** (Phase 3) | P1 |
| Negative stock / oversell allow | ? | P (short) | Y (soft) | Y (discouraged) | Y (warn) | ? (module) | Y (toggle) | Y (global) | **Planned-P2** (allow+flag default) | P0 |
| Configurable hard-block oversell | P (Omni) | ? | N | N | ? | ? | Y (global) | N (global) | **Planned-P2** (per tenant/cat/product) | P1 |
| Stock count / cycle count | Y | Y | P (adj) | Y (cycle) | Y (stock take) | Y (cycle) | Y (both) | P (reconcile) | **Planned-P2** | P0 |
| Kits / bundles / BOM (catalog) | Y | Y | Y | Y | Y | Y | Y | Y | **Planned-P2** (catalog only) | P1 |
| CSV/Excel import (products/stock/cost) | Y | Y | Y | Y | Y | Y | P (new items) | Y | **Planned-P2** (import wizard) | P0 |
| Open API for migration-out | Y | Y (REST) | Y (REST) | Y | P (paywall) | P (paid plan) | Y (SOAP+REST) | Y (REST) | **Planned** | P1 |
| Ledger-based perpetual inventory | P | Y (layers) | P | P | P | Y | Y | **Y** | **Supported (VS#1)** | P0 |
| Offline-first inventory | N | N | N | N | N | N | N | N | **Planned** (Phase 4/10) | P0 (differentiator) |
| Multi-tenant + RLS isolation | N (SaaS silo) | N | N | N | N | N | N | N (self-host) | **Supported (VS#1)** | P0 (differentiator) |

Sources (representative): Cin7 [Costing](https://help.core.cin7.com/hc/en-us/articles/9034464614415-Costing-Methods), [Variable-weight barcodes](https://help.core.cin7.com/hc/en-us/articles/9034446616975-Advanced-barcodes-Weight-based-price-based-GS1-EAN-UPC); Fishbowl [Costing](https://help.fishbowlinventory.com/drive/s/article/Drive-Costing-Methods); Zoho [Inventory evaluation](https://www.zoho.com/us/inventory/kb/items/item-inventory-evaluation.html), [Out-of-stock](https://www.zoho.com/us/inventory/kb/general-overview/out-of-stock-warning.html); inFlow [Costing](https://www.inflowinventory.com/support/cloud/can-i-choose-how-to-handle-cost-moving-average-fifo-lifo-etc/), [Negative](https://www.inflowinventory.com/support/cloud/why-should-i-avoid-negative-inventory-in-inflow); Finale [Average costing](https://support.finaleinventory.com/hc/en-us/articles/115007324427), [Sales velocity reorder](https://support.finaleinventory.com/hc/en-us/articles/360001542113); Odoo [Valuation](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/inventory/product_management/inventory_valuation/inventory_valuation_config.html), [Barcode nomenclature](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/barcode/operations/barcode_nomenclature.html), [FEFO](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/inventory/shipping_receiving/removal_strategies/fefo.html); NetSuite [Costing](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N2191818.html), [Negative inventory](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_1521526008.html); ERPNext [Stock Settings](https://docs.frappe.io/erpnext/stock-settings), [Batch-wise FEFO](https://docs.frappe.io/erpnext/managing-batch-wise-inventory).

---

## Parity checklist (P0 / P1)

**P0 — mandatory parity (must ship for Phase 2 to be credible):**
- [ ] Weighted-average (AVCO) costing — **the RetailOS default** (D1).
- [ ] FIFO costing with cost layers — selectable per tenant/category/product (D1).
- [ ] Per-product/category costing config (most-specific-wins) — RetailOS matches Cin7/Odoo granularity, beats the global-only crowd (Fishbowl/inFlow/Finale).
- [ ] Multi-UoM buy/stock/sell with conversions (D2).
- [ ] Lot/batch + expiry tracking with FEFO picking (D3/D4) — matches the stronger half (Cin7/Odoo/NetSuite/ERPNext).
- [ ] Standard symbology barcodes (EAN-13/UPC-A/EAN-8/Code-128/QR/GS1) (D6).
- [ ] **Variable-weight / price-embedded barcode parsing** (D6) — only Cin7 + Odoo have it; **P0 for the supermarket/deli vertical** (§18, §12).
- [ ] Valuation + COGS reporting by SKU×location per configured method.
- [ ] Reorder point / min-max with low-stock alerts (D7, suggest-only Phase 2).
- [ ] Negative-stock / oversell handling — **allow-with-flagging default** (D5).
- [ ] CSV/Excel import wizard (products/SKUs/opening stock/costs/UoM) with mapping/preview/validation/rollback.
- [ ] Stock count / cycle count + adjustments with audit trail.
- [ ] Ledger-based perpetual inventory — **already shipped (VS#1)**; matches ERPNext/Odoo/NetSuite, beats the counter-based SMB tools.

**P1 — strongly recommended:**
- [ ] Configurable hard-block oversell per tenant/category/product (D5) — **more granular than any competitor** (all are global at best).
- [ ] Serial tracking modelled now, capture flows Phase 4 (D3 stub).
- [ ] Audited revaluation / safe costing-method change — improves on NetSuite/ERPNext/Fishbowl's *immutable-after-save* lock.
- [ ] Bin/zone within-warehouse (Phase 3) — real bins, not ERPNext's sub-warehouse fake.
- [ ] Auto-draft PO from reorder (Phase 6) + demand-based reordering.
- [ ] Landed-cost allocation (Phase 6) — inFlow/Finale set the bar; ties to bonded warehouse (§18).
- [ ] Kits/bundles/BOM catalog modelling (Phase 2 catalog; build/disassembly later).

**P2 — nice to have / deferred:** LIFO (feature-flag only, IFRS-off-by-default), standard/specific-ID costing (manufacturing phase), warranty/RMA serial flows (Service module).

---

## RetailOS enhancements (differentiators)

The goal is **parity-plus**, not a clone (§41). Where RetailOS genuinely exceeds all eight:

1. **Offline-first inventory** — *none* of the eight operate the ledger offline (single-terminal or LAN Edge Hub). RetailOS's append-only, replay-safe, idempotent ledger (VS#1) + Phase 4/10 offline queue is unique in this field (§13/§14). This is the headline Caribbean/dev-market differentiator (§12).
2. **Per-tenant/category/product oversell policy** (D5) — competitors offer at most a *global* negative-stock toggle (NetSuite, ERPNext) or a soft warning (Zoho, inFlow, Finale). RetailOS resolves allow-with-flagging vs hard-block at tenant→category→product granularity, **above** a policy-neutral ledger — finer control than the entire field.
3. **Safe, audited costing-method change via revaluation** — NetSuite/ERPNext lock the method after the item is saved; Fishbowl locks it at DB creation (Support-only to change). RetailOS allows a method change only via an explicit, audited revaluation event (never silent), so a tenant is not permanently trapped by a first-day choice.
4. **Multi-tenant SaaS + RLS isolation** — the surveyed tools are single-tenant-per-instance (or self-hosted silos). RetailOS's fail-closed RLS spine (VS#1) lets one platform host many tenants safely — a SaaS/white-label differentiator (§8/§11).
5. **Variable-weight barcode parity in a multi-deployment, offline, white-label product** — Cin7 and Odoo parse weight/price-embedded barcodes, but neither is offline-first nor Caribbean-localized. RetailOS pairs that supermarket capability with offline + bonded-warehouse + multi-currency (§12/§18).
6. **Open migration-out** — Finale and Odoo paywall their APIs; RetailOS keeps export/API open across deployment tiers as a trust/commercial differentiator (§37).

---

## Migration-in requirements (§42)

How customers migrate *from* each competitor into RetailOS (drives the Phase-2 import wizard + mapping templates, §28):

- **Common path (all 8):** CSV/Excel export of products/variants/SKUs/barcodes/UoM/opening-stock/cost is universally available — the baseline import target. Opening stock imports as `opening_balance` ledger movements with the stated unit cost; the **import must reconcile the source costing method to the tenant's configured RetailOS method** (D1) — e.g. a Finale (avg-only) export seeds the AVCO `avg_cost`; a Cin7/FIFO export can seed FIFO `valuation_layer` rows.
- **Per-product templates needed:** Cin7 Core (SKU unique key; per-product method + AUOM-as-SKU to collapse), Fishbowl (Parts/Products + lot/expiry/revision columns), Zoho (Unit Groups + serial XOR batch), inFlow (one-row-per-serial; landed cost), Finale (Excel opening stock + avg-cost bulk; lot/serial in Lot ID field), Odoo (External-ID for idempotent re-import; UoM categories), NetSuite (Worksheet Import for opening stock; SuiteTalk for full sync), ERPNext (Data Import + Stock Reconciliation for opening stock).
- **API-assisted migration:** REST/SOAP available for Fishbowl, Zoho, NetSuite (SuiteTalk), ERPNext, Odoo (paid), inFlow; Finale API is paywalled (Platinum+). Where API is gated, fall back to CSV.
- **Caveats to surface in the wizard:** NetSuite CSV cannot update QoH on existing items (new-item only); costing-method differences must be flagged so COGS history is not silently misstated; serial XOR batch sources (Zoho) cannot map to both modes.

---

## Known limitations / intentionally deferred

- This analysis covers the **inventory/product engine** only. POS-specific competitors (Lightspeed, Square, Shopify POS) and their checkout/variable-weight-at-scale flows are the **Phase 4 POS** competitive doc. Procurement/landed-cost depth (inFlow/Finale leaders) is the **Phase 6** doc.
- Items marked **(unverified)** in the research (e.g. several vendors' RMA-serial flows, per-warehouse negative toggles, Zoho auto-FEFO/auto-PO) are **not** asserted as confirmed competitor capabilities; re-verify before citing them as parity gaps (§40).
- Priorities (P0–P3) are for **Phase 2 scope**; later-phase features (transfers, bins, landed cost, auto-PO) are P0/P1 *for their own phase* but out of Phase-2 scope here.
