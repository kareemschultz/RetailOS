# Phase 2 API Contracts — Products & Inventory Ledger

- **Status:** backend contract snapshot for branch `phase-2-implementation`.
- **Scope:** oRPC routers exposed through `appRouter`; all routes are tenant-scoped via `tenantProcedure` and must run inside `withTenant`.
- **Security:** every mutation checks RBAC, validates referenced IDs through RLS-scoped reads before insert/update, records audit rows where state changes, and emits transactional outbox events where downstream phases need a seam.
- **Not UI:** no screen/component decisions here.

## Existing VS#1 routes retained

### `company.create`
- **Input:** `{ name }`
- **Permission:** `company.create`
- **Writes:** `company`
- **Audit:** `company.create`

### `location.create`
- **Input:** `{ companyId, name, type }`
- **Permission:** `location.create`
- **Writes:** `location`
- **Guard:** `companyId` must be visible through tenant RLS.
- **Audit:** `location.create`

### `product.create`
- **Input:** `{ sku, name, priceMinor, currency, scale?, categoryId?, brandId?, baseUomId?, costingMethod?, trackingMode? }`
- **Permission:** `products.create`
- **Writes:** `product`
- **Guards:** referenced category/brand/base UoM must be visible through tenant RLS.
- **Audit:** `product.create`

## Inventory routes

## Catalog routes

All catalog routes require `products.create` for now; finer-grained catalog permissions can split later without changing route contracts.

### `catalog.categoryCreate`
- **Input:** `{ name, code?, costingMethod?, trackingMode? }`
- **Writes:** `category`
- **Audit:** `category.create`

### `catalog.brandCreate`
- **Input:** `{ name, code? }`
- **Writes:** `brand`
- **Audit:** `brand.create`

### `catalog.uomCreate`
- **Input:** `{ code, name, kind?, decimalScale? }`
- **Writes:** `unit_of_measure`
- **Audit:** `uom.create`

### `catalog.skuCreate`
- **Input:** `{ productId, code, name?, baseUomId?, costingMethod?, trackingMode? }`
- **Writes:** `sku`
- **Guards:** `productId` and `baseUomId` must be visible through tenant RLS.
- **Audit:** `sku.create`

### `catalog.barcodeCreate`
- **Input:** `{ skuId, value, symbology?, isPrimary? }`
- **Writes:** `barcode`
- **Guards:** `skuId` must be visible through tenant RLS.
- **Audit:** `barcode.create`

### `catalog.uomConversionCreate`
- **Input:** `{ fromUomId, toUomId, role, factor, factorScale?, categoryId?, productId?, skuId? }`
- **Writes:** `uom_conversion`
- **Guards:** referenced UoMs/category/product/SKU must be visible through tenant RLS.
- **Audit:** `uom_conversion.create`

## Inventory routes

### `inventory.receive`
- **Input:** `{ locationId, productId, qty, skuId?, lotId?, unitCostMinor?, costCurrency?, costScale?, idempotencyKey? }`
- **Permission:** `inventory.receive`
- **Behavior:** appends a receipt ledger row. If `skuId` is supplied, requires full cost triplet and runs `applyValuation`.
- **Events:** `inventory.received`; `inventory.valuation_updated` when SKU-valued.
- **Audit:** `inventory.receive`

### `inventory.adjust`
- **Input:** `{ locationId, productId, skuId, qtyDelta, reasonCode, lotId?, unitCostMinor?, costCurrency?, costScale?, idempotencyKey? }`
- **Permission:** `inventory.adjust`
- **Behavior:** appends an adjustment ledger row and runs valuation. Positive adjustments require a full cost triplet.
- **Events:** `inventory.adjusted`
- **Audit:** `inventory.adjust`

### `inventory.countStart`
- **Input:** `{ locationId, scope? }` where `scope` is `full | cycle | zone`
- **Permission:** `inventory.count`
- **Writes:** `stock_count(status=started)`
- **Events:** `inventory.count_started`
- **Audit:** `inventory.count.start`

### `inventory.countLineUpsert`
- **Input:** `{ stockCountId, skuId, countedQty, lotId?, varianceValueMinor?, currency?, scale? }`
- **Permission:** `inventory.count`
- **Behavior:** inserts/updates one count line. Positive count variance later requires value triplet so found stock is valued.

### `inventory.countPost`
- **Input:** `{ stockCountId }`
- **Permission:** `inventory.count`
- **Behavior:** locks count + lines, calculates system/variance quantities, appends adjustment movements for non-zero variances, runs valuation, updates count lines, marks count posted.
- **Events:** `inventory.count_posted`
- **Audit:** `inventory.count.post`

### `inventory.reorderEvaluate`
- **Input:** `{ locationId, skuId }`
- **Permission:** `inventory.reorder`
- **Behavior:** evaluates fixed min/max reorder rule against SKU on-hand.
- **Events:** `inventory.reorder_triggered` only when below min.

## Reports

### `reports.salesBasic`
- **Input:** `{ from?, to?, locationId? }`
- **Permission:** `reports.view`
- **Output:** totals grouped by currency/scale.

### `reports.valuation`
- **Input:** `{ locationId?, skuId? }`
- **Permission:** `reports.view`
- **Output:** AVCO rows from `avg_cost` and FIFO rollups from `valuation_layer`.

### `reports.lowStock`
- **Input:** `{ locationId? }`
- **Permission:** `reports.view`
- **Output:** reorder rules where on-hand is below min, with suggested quantity to max.

## Known gaps / next backend work

- Catalog create endpoints exist for `category`, `brand`, `sku`, `barcode`, `unit_of_measure`, and `uom_conversion`; update/list/delete and `variant` endpoints are still pending.
- `product.create` accepts Phase-2 category/brand/base UoM/costing/tracking fields; product list/update/archive are still pending.
- Phase-2 router e2e covers a mixed AVCO+FIFO valued receipt/report flow; broader lot/count/reorder/list-update e2e remains pending.
- Event payloads are implemented for the new router seams, but the outbox dispatcher/consumer remains a later phase.
- UI remains intentionally absent.
