# Inventory — Screen Planning Map (Phase 2)

- **Status:** SCREEN PLANNING ONLY — **no UI implementation.** Purpose: surface backend **API/field gaps now** before any screen is built, and pre-bind each future screen to a verified `ui-inventory/` source.
- **Hard constraint (charter §5, owner directive):** when these screens are eventually built (later phase, against approved + stable APIs), components come **strictly from the verified `ui-inventory/` files and the configured MCP registries** (shadcn Studio / Magic UI / ReUI) — **never hand-rolled generic React**, and every block is re-themed to RetailOS tokens.
- **No POS/Tauri decisions here** — the cashier POS surface is a Phase-4 decision (offline-first Tauri/SQLite); this doc covers **back-office inventory** only.
- Personas (§5): Inventory/stock manager, Receiving clerk, Accountant (read), Buyer (read), Tenant admin, Platform/MSP admin.

> Each row maps Workflow · Persona · Screen · Actions · Permissions (§7) · Backend API calls · Required data fields · Events emitted · Edge cases · Future UI source (`ui-inventory/`). API/field columns are the gap-finding output.

## 1. Product / catalog management
- **Persona:** Inventory manager. **Screen:** Products list + product detail/editor.
- **Actions:** list/search/filter products; create/edit/archive; assign category/brand, base UoM, costing method, tracking mode.
- **Permissions:** `products.view` / `products.create` / `products.edit` / `products.archive`.
- **API:** `product.list` (paginated, faceted), `product.create`, `product.update`, `product.archive`, `category.list`, `brand.list`, `uom.list`.
- **Data fields:** id, sku root, name, category_id, brand_id, base_uom_id, costing_method (resolved + override), tracking_mode, price_minor/currency/scale, deleted_at.
- **Events:** `product.created/updated`.
- **Edge cases:** duplicate SKU/name (reject, surface conflict); archive with on-hand > 0 (warn); changing costing_method after movements exist → **blocked except via audited revaluation** (D1).
- **UI source:** shadcn studio `datatable-06` (product/inventory + CSV/Excel/JSON export); product editor = shadcn Form + Field; faceted filters per §5 admin map.
- **GAP CHECK:** need `product.list` faceted/paginated contract; need resolved-vs-override costing display field.

## 2. SKU / variant / barcode management
- **Persona:** Inventory manager. **Screen:** Variant matrix + SKU detail (barcodes, UoM set).
- **Actions:** define variants → SKUs; add/remove barcodes (symbology); define alternate UoMs (purchase/stock/sale/reporting) + integer-ratio factors.
- **Permissions:** `products.edit`.
- **API:** `variant.create`, `sku.create/update`, `barcode.add/remove`, `uom.addConversion`.
- **Data fields:** variant attrs, sku code, barcode value+symbology, uom_conversion (factor, factor_scale, role), is_base.
- **Events:** `product.updated`, (info) `inventory.uom_converted` at transaction time.
- **Edge cases:** duplicate barcode (reject); >1 base UoM (reject); non-integer discrete conversion (reject, D2); weight-embedded barcode config (data-driven, D6).
- **UI source:** shadcn studio data-table variants + Combobox; barcode/label designer is a **custom build** (`ui-inventory/gaps-and-custom.md`).
- **GAP CHECK:** barcode parser config contract (D6); UoM role enum surfaced as extensible `text`.

## 3. Receiving stock
- **Persona:** Receiving clerk. **Screen:** Receive-stock form (per location).
- **Actions:** select SKU + location, qty (in purchase UoM), unit cost, lot/expiry (if lot-tracked), serials (stub).
- **Permissions:** `inventory.receive`.
- **API:** `inventory.receive` (RLS-scoped FK checks on sku/location); `uom.convert`.
- **Data fields:** skuId, locationId, qty+uom, unitCostMinor+currency+scale, lot (batch no, expiry, mfg date), serialIds?.
- **Events:** `inventory.received`, `inventory.valuation_updated`, `inventory.uom_converted`.
- **Edge cases:** receive with past expiry (warn/block per D4); cross-tenant sku/location id (NOT_FOUND); UoM non-exact for discrete (reject); multi-currency cost.
- **UI source:** shadcn Form + Field + Combobox; scanner-friendly Inputs (tablet, §5 warehouse map).
- **GAP CHECK:** `inventory.receive` payload must accept lot+cost+uom; confirm idempotency key on receive.

## 4. Lot / expiry management
- **Persona:** Inventory manager (pharmacy/supermarket). **Screen:** Lots list + expiry dashboard (FEFO horizon).
- **Actions:** view lots by SKU/location/expiry; flag/quarantine; configure expiry/FEFO policy per category/product (D4).
- **Permissions:** `inventory.view`, `inventory.override_expiry` (for overrides), `settings.manage` (policy config).
- **API:** `lot.list` (by expiry), `inventory.expiryPolicy.get/set`, `inventory.allocate` (FEFO preview).
- **Data fields:** lotId, skuId, locationId, expiryDate, qtyRemainingBase, status, policy (warn-override | hard-block), horizonDays.
- **Events:** `inventory.lot_expiring`, `inventory.lot_expired`.
- **Edge cases:** D4 policy resolution (tenant/category/product); audited override; expired hard-block per regulated category.
- **UI source:** shadcn Data Table + Badge (expiry status) + date filters; alert surfaces via Sonner.
- **GAP CHECK:** expiry policy config API + the configurable horizon field; FEFO allocation preview endpoint.

## 5. Stock adjustment
- **Persona:** Inventory manager. **Screen:** Adjustment form + approval queue.
- **Actions:** add/remove qty with reason code; large adjustments route to approval.
- **Permissions:** `inventory.adjust`; `inventory.approve_adjustment` (threshold).
- **API:** `inventory.adjust`, `inventory.approveAdjustment`.
- **Data fields:** skuId, locationId, qtyDeltaBase, reasonCode (extensible text), unitCost?, approvedBy?.
- **Events:** `inventory.adjusted`, `inventory.valuation_updated`.
- **Edge cases:** adjustment exceeding threshold without permission → blocked/routed (§22); negative-on-hand result governed by D5.
- **UI source:** shadcn Form + Dialog (confirm) + approval queue Data Table.
- **GAP CHECK:** reason-code taxonomy (extensible); approval-threshold config.

## 6. Stock count / cycle count
- **Persona:** Inventory manager / clerk. **Screen:** Count session (start → enter counts → post variance).
- **Actions:** start count (full/cycle/scope); enter counted qty (blind option); post variance as adjustments.
- **Permissions:** `inventory.count`, `inventory.adjust` (post), `inventory.approve_adjustment` (large variance).
- **API:** `inventory.count.start`, `inventory.count.addLine`, `inventory.count.post`.
- **Data fields:** countId, scope, lines[{ skuId, countedQtyBase, systemQtyBase, varianceBase, varianceValueMinor }].
- **Events:** `inventory.count_started`, `inventory.count_posted`, `inventory.stock_discrepancy` (beyond threshold).
- **Edge cases:** blind count (hide system qty); concurrent movement during count; variance valuation per costing method.
- **UI source:** shadcn Data Table (editable) + Progress; tablet scanner inputs.
- **GAP CHECK:** blind-count flag; variance threshold → discrepancy event.

## 7. Low-stock / reorder suggestions
- **Persona:** Inventory manager / Buyer (read). **Screen:** Reorder rules editor + low-stock suggestion report.
- **Actions:** set min/max per SKU×location; view below-reorder suggestions (suggest-only, D7).
- **Permissions:** `inventory.view`, `inventory.edit` (rules); buyer read.
- **API:** `inventory.reorderRules.list/set`, `reports.lowStock`.
- **Data fields:** skuId, locationId, min, max, onHandBase, suggestedQtyBase.
- **Events:** `inventory.reorder_triggered`.
- **Edge cases:** **no PO created** (D7 — manager approval before procurement, P6); per-SKU/per-location rules.
- **UI source:** shadcn Data Table + Statistics/KPI cards; export.
- **GAP CHECK:** reorder rule contract; suggestion report shape (no PO fields in P2).

## 8. Inventory valuation report
- **Persona:** Inventory manager / Accountant (read). **Screen:** Valuation by SKU/location + roll-forward.
- **Actions:** filter by location/category/method; export; drill to movements.
- **Permissions:** `reports.view`, `advanced_reporting_enabled` flag.
- **API:** `reports.valuation` (per costing method), `reports.valuationRollforward`.
- **Data fields:** skuId, locationId, costingMethod, totalValueMinor, qtyOnHandBase, derivedAvgCostMinor?, currency, scale.
- **Events:** consumes `inventory.valuation_updated`.
- **Edge cases:** mixed AVCO+FIFO in one report; **value-integrity (qty=0 ⟺ value=0)**; rounding of displayed avg is D-money-parameterized (read-only display).
- **UI source:** shadcn Data Table + Chart (disable live-data enter-animations, §5); tabular/monospaced figures.
- **GAP CHECK:** report must read `totalValueMinor` truth, not a stored average; read-model vs OLTP (§27, P12).

## 9. Stock discrepancy review
- **Persona:** Inventory/store manager. **Screen:** Discrepancy queue / manager dashboard.
- **Actions:** review negative-on-hand + count discrepancies; trigger cycle count; resolve.
- **Permissions:** `inventory.view`, `inventory.adjust` (resolve).
- **API:** `reports.discrepancies`, `inventory.count.start` (from a discrepancy).
- **Data fields:** skuId, locationId, expected/actual/deltaBase, source (oversell|count|sync), saleId?.
- **Events:** consumes `inventory.stock_discrepancy`.
- **Edge cases:** offline-sync-surfaced discrepancies (P10); cashier-anomaly correlation (P12, §27).
- **UI source:** shadcn Data Table + Badge + Sheet (detail); dashboard cards.
- **GAP CHECK:** discrepancy feed/query contract + `source`/`saleId` for traceability.

## 10. Oversell review
- **Persona:** Store manager. **Screen:** Oversell events list (allow-with-flagging tenants).
- **Actions:** review oversells; configure hard-block per category/product (D5).
- **Permissions:** `inventory.view`, `inventory.override_negative`, `settings.manage` (policy).
- **API:** `reports.oversells`, `inventory.oversellPolicy.get/set`.
- **Data fields:** skuId, locationId, saleId, deltaBase, policy (allow-flag | hard-block).
- **Events:** consumes `inventory.stock_discrepancy` (source=oversell).
- **Edge cases:** policy resolution tenant/category/product; negative-on-hand valuation at last-known cost (D5).
- **UI source:** shadcn Data Table + Switch (policy toggles) + confirm Dialog.
- **GAP CHECK:** oversell policy config API (per tenant/category/product).

## 11. Warehouse / bin-ready future screens (Phase 3 — placeholders)
- **Persona:** Warehouse worker. **Screens (FUTURE, P3):** bin/zone setup, putaway, pick/pack, transfers, bonded vs released view.
- **Why here:** Phase-2 schema reserves seams (location, movement types incl. transfer/bonded statuses) so P3 screens drop in without redesign; **not built in Phase 2**.
- **UI source (future):** ReUI Data Grid / Kanban (warehouse), bin/zone scan UI = custom (`ui-inventory/gaps-and-custom.md`), tablet-first.
- **GAP CHECK (for P3, noted not built):** bin/zone model, transfer two-sided workflow, bonded/released ledger statuses.

## Consolidated API gaps surfaced (the point of this doc)
1. `product.list` faceted/paginated contract + resolved-vs-override costing display.
2. Barcode parser config + UoM role enum as **extensible `text`** (schema rule below).
3. `inventory.receive` payload = qty+uom + unitCost + lot + serials? + idempotency key.
4. Expiry/FEFO **policy config API** + configurable horizon + FEFO allocation preview.
5. Reason-code taxonomy + approval-threshold config (adjustments).
6. Blind-count flag + variance→discrepancy threshold.
7. Reorder rule contract + suggestion report (no PO fields in P2).
8. Valuation report must expose `totalValueMinor` truth (not stored average); read-model seam (P12).
9. Discrepancy + oversell feeds with `source`/`saleId` traceability + policy-config APIs.
10. P3 seams (bin/zone, transfer, bonded) reserved in P2 schema, not built.

> **Schema rule (carried from the approved plan):** fields like `tracking_mode`, `costing_method`, oversell policy, expiry policy, barcode parser type, reason codes, and UoM roles are **intentionally extensible** — implement as Drizzle `text({ enum: [...] })` + check constraints / Zod validation, **never native Postgres `pgEnum`** (which is painful to `ALTER`).
