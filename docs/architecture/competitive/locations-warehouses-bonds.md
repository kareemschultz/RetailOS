# Locations, Warehouses & Bonded Warehouses — Competitive Analysis

- Date: 2026-06-22 · Charter ref: §41 (parity program), §8 (platform/tenant/location model), §18 (warehouse/bond/inventory engine), §12 (Caribbean/dev-market: bonded warehouses, customs, landed cost)
- Companion: `module-specs/locations-warehouses-bonds.md` (§42 requirements) · feeds the Phase-3 design decisions.
- Method: parity features below are drawn from each vendor's documented capabilities. **This pass is knowledge-level, not a live-doc audit** — every per-vendor cell is marked **(unverified)** at the matrix level per charter §40; before any Phase-3 feature that claims a specific competitor behaviour as the bar, confirm it against that vendor's official docs + (where possible) a live probe. The purpose here is to enumerate the **parity surface** (what a serious multi-location/warehouse/bond system must do), not to assert precise vendor facts.

> **Products surveyed (6):** Oracle NetSuite (WMS + multi-location), Odoo Inventory (multi-warehouse + multi-step routes), ERPNext (Stock + multi-warehouse tree), Cin7 Core (multi-location + bin), Fishbowl (warehouse/zone/bin), Zoho Inventory (multi-warehouse). Bonded-warehouse / customs-bond handling is **rare** in mainstream SMB ERP — it is a RetailOS differentiator for the Caribbean/import market (§12) and is sourced from customs-bonded-warehouse domain practice, not a single vendor.

---

## Feature matrix (parity surface)

Legend: **Y** = generally supported · **P** = partial/add-on/edition-gated · **N** = not offered · all per-vendor cells **(unverified — confirm before citing as the bar)**. RetailOS column: **Planned-P3** (designed for Phase 3), **Planned** (later phase), **Seam-only** (modelled now, behaviour later), **Not planned**.

| Feature | NetSuite | Odoo | ERPNext | Cin7 Core | Fishbowl | Zoho Inv | RetailOS | Priority |
|---|---|---|---|---|---|---|---|---|
| Multiple stock locations per tenant/company | Y | Y | Y | Y | Y | Y | **Planned-P3** | P0 |
| Location typing (store vs warehouse vs DC) | Y | Y | P | Y | Y | P | **Planned-P3** (typed + CHECK enum) | P0 |
| Warehouse internal structure (zone/aisle/rack/shelf/bin) | Y (WMS) | Y (locations tree) | Y (warehouse tree) | Y (bin) | Y (zone/bin) | P | **Planned-P3** (bin hierarchy) | P0 |
| Bin / sub-location stock balances | Y | Y | Y | Y | Y | P | **Planned-P3** | P0 |
| Inter-location transfer (single-step) | Y | Y | Y | Y | Y | Y | **Planned-P3** | P0 |
| In-transit inventory (two-step transfer) | Y | Y (multi-step routes) | Y (Material Transfer in-transit) | P | P | P | **Planned-P3** (in-transit virtual location) | P0 |
| Transfer **value** moves with quantity (cost basis preserved) | Y | Y | Y | Y | Y | P | **Planned-P3** (value-conserving; see plan §B) | P0 |
| Transfer receive confirmation / discrepancy on receipt | Y | Y | Y | Y | P | P | **Planned-P3** | P1 |
| Bonded / customs-bonded inventory state (separate from released) | P (advanced) | N | N | N | N | N | **Planned-P3** (bonded vs released separation) | P0 (§12 differentiator) |
| Bond receiving (import batch into bond) | N | N | N | N | N | N | **Planned-P3** (bond receipt) | P0 |
| Bond-release approval workflow | N | N | N | N | N | N | **Seam-only P3** (approval seam; mechanics owner-decided) | P0 |
| Bond-to-store/warehouse transfer (release → released stock) | N | N | N | N | N | N | **Planned-P3** | P0 |
| Customs reference / document attachment | P | N | N | N | N | N | **Seam-only P3** (refs/doc seam; no OCR) | P1 |
| Landed-cost allocation (freight/duty/insurance → unit cost) | Y | Y (landed cost) | Y (Landed Cost Voucher) | Y | P | N | **Seam-only P3** (refs reserved; allocation = Phase 6) | P1 |
| Per-location costing / valuation | Y | Y | Y | Y | Y | P | **Already shipped** (avg_cost/valuation_layer are SKU×location) | P0 |
| Bin-level FEFO / pick strategy | Y | Y | P | P | P | N | **Planned** (FEFO exists; bin-aware picking later) | P2 |

## Parity takeaways for Phase 3

1. **Multi-location + typed locations + a bin hierarchy + inter-location transfers are table-stakes** — every surveyed product has them; RetailOS must reach P0 parity here. **Implementation note:** RetailOS models the warehouse structure as **one unified self-referential `location` tree** (`parent_location_id`, dynamic nesting Warehouse→Zone→Aisle→Bin) like Odoo/ERPNext's location tree — not rigid separate Zone/Aisle/Rack tables — so depth is tenant-defined. (Transfers are **intra-company only** in Phase 3; inter-company needs due-to/due-from GL → Phase 5.)
2. **Two-step (in-transit) transfers are the parity bar, not single-step** — NetSuite/Odoo/ERPNext all model in-transit so stock leaving A is not double-counted as available at B before it arrives. RetailOS should model an **in-transit holding** so quantity and value are conserved across the gap (plan §B/§transfers).
3. **Bonded warehouse is the RetailOS differentiator** (§12). Mainstream SMB ERP does **not** separate customs-bonded from released stock; this is a deliberate edge for Caribbean import/wholesale/bonded operators. Phase 3 ships the **state separation + bond receipt + bond-to-store release**; the **release-approval mechanics and customs-document/landed-cost allocation are seams** (behaviour later, owner-decided).
4. **Landed-cost allocation is parity (Odoo/ERPNext/NetSuite/Cin7) but explicitly OUT of Phase 3** — Phase 3 reserves the **references** (customs/freight/duty linkage) so the Phase-6 procurement landed-cost allocator has somewhere to write, without building allocation now.
5. **Value-with-quantity on transfers is universal** — no serious system moves quantity without cost basis. RetailOS's SKU×location `avg_cost`/`valuation_layer` already makes per-location cost real; the Phase-3 transfer must move value too (plan §B is the load-bearing design question).

## Deferred / not-Phase-3 (parity items intentionally later)
- Landed-cost **allocation** behaviour (freight/duty/insurance apportionment to unit cost) → **Phase 6 Procurement**.
- Customs-document **OCR / AI extraction** (§18 AI seam) → later, behind the provider interface.
- Bin-level **directed putaway / wave picking / slotting optimization** (full WMS) → later phase; Phase 3 ships the bin *model* + balances, not WMS optimization.
- Bonded **duty/VAT estimation + clearance-status state machine** beyond the basic bonded↔released separation → later (ties to Phase 5 tax + Phase 6 procurement).
