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

### `product.list`
- **Input:** `{ categoryId?, brandId?, includeArchived? }`
- **Permission:** `products.create` (temporary catalog-management permission; finer read permission later)
- **Reads:** `product`
- **Guards:** referenced category/brand filters must be visible through tenant RLS.

### `product.update`
- **Input:** `{ id, sku?, name?, categoryId?, brandId?, baseUomId?, costingMethod?, trackingMode?, priceMinor?, currency?, scale? }`
- **Permission:** `products.create`
- **Writes:** `product`
- **Guards:** referenced category/brand/base UoM must be visible through tenant RLS.
- **Audit:** `product.update`

### `product.archive`
- **Input:** `{ id }`
- **Permission:** `products.create`
- **Writes:** `product.deleted_at`
- **Audit:** `product.archive`

## Inventory routes

## Catalog routes

All catalog routes require `products.create` for now; finer-grained catalog permissions can split later without changing route contracts.

### `catalog.importPreview`
- **Input:** `{ rows: [...] }` where each row carries product SKU/name/price/currency plus optional SKU code, base UoM code, costing/tracking, lot/expiry, and unit-cost fields.
- **Permission:** `products.create`
- **Reads:** existing products, SKUs, and UoMs through tenant RLS.
- **Behavior:** validates duplicates, existing SKU conflicts, missing base UoM codes, and lot/cost rows without SKU codes. Returns per-row `valid|error` status and errors. Does **not** write data; bulk apply/rollback is intentionally a later reviewed operation.

### `catalog.categoryList`
- **Input:** `{ includeArchived? }`
- **Reads:** `category`

### `catalog.categoryCreate`
- **Input:** `{ name, code?, costingMethod?, trackingMode? }`
- **Writes:** `category`
- **Audit:** `category.create`

### `catalog.categoryUpdate` / `catalog.categoryArchive`
- **Input:** update `{ id, name?, code?, costingMethod?, trackingMode? }`; archive `{ id }`
- **Writes:** `category`
- **Audit:** `category.update` / `category.archive`

### `catalog.brandList`
- **Input:** `{ includeArchived? }`
- **Reads:** `brand`

### `catalog.brandCreate`
- **Input:** `{ name, code? }`
- **Writes:** `brand`
- **Audit:** `brand.create`

### `catalog.brandUpdate` / `catalog.brandArchive`
- **Input:** update `{ id, name?, code? }`; archive `{ id }`
- **Writes:** `brand`
- **Audit:** `brand.update` / `brand.archive`

### `catalog.uomList`
- **Input:** `{ includeArchived? }`
- **Reads:** `unit_of_measure`

### `catalog.uomCreate`
- **Input:** `{ code, name, kind?, decimalScale? }`
- **Writes:** `unit_of_measure`
- **Audit:** `uom.create`

### `catalog.uomUpdate` / `catalog.uomArchive`
- **Input:** update `{ id, code?, name?, kind?, decimalScale? }`; archive `{ id }`
- **Writes:** `unit_of_measure`
- **Audit:** `uom.update` / `uom.archive`

### `catalog.variantList`
- **Input:** `{ productId?, includeArchived? }`
- **Reads:** `variant`
- **Guards:** referenced product filter must be visible through tenant RLS.

### `catalog.variantCreate`
- **Input:** `{ productId, name, value, sortOrder? }`
- **Writes:** `variant`
- **Guards:** `productId` must be visible through tenant RLS.
- **Audit:** `variant.create`

### `catalog.variantUpdate`
- **Input:** `{ id, name?, value?, sortOrder? }`
- **Writes:** `variant`
- **Audit:** `variant.update`

### `catalog.variantArchive`
- **Input:** `{ id }`
- **Writes:** `variant.deleted_at`
- **Audit:** `variant.archive`

### `catalog.skuList`
- **Input:** `{ productId?, includeArchived? }`
- **Reads:** `sku`
- **Guards:** referenced product filter must be visible through tenant RLS.

### `catalog.skuCreate`
- **Input:** `{ productId, code, name?, baseUomId?, costingMethod?, trackingMode? }`
- **Writes:** `sku`
- **Guards:** `productId` and `baseUomId` must be visible through tenant RLS.
- **Audit:** `sku.create`

### `catalog.skuUpdate` / `catalog.skuArchive`
- **Input:** update `{ id, code?, name?, baseUomId?, costingMethod?, trackingMode?, isActive? }`; archive `{ id }`
- **Writes:** `sku`
- **Guards:** referenced base UoM must be visible through tenant RLS.
- **Audit:** `sku.update` / `sku.archive`

### `catalog.barcodeList`
- **Input:** `{ skuId?, includeArchived? }`
- **Reads:** `barcode`
- **Guards:** referenced SKU filter must be visible through tenant RLS.

### `catalog.barcodeCreate`
- **Input:** `{ skuId, value, symbology?, isPrimary? }`
- **Writes:** `barcode`
- **Guards:** `skuId` must be visible through tenant RLS.
- **Audit:** `barcode.create`

### `catalog.barcodeUpdate` / `catalog.barcodeArchive`
- **Input:** update `{ id, value?, symbology?, isPrimary? }`; archive `{ id }`
- **Writes:** `barcode`
- **Audit:** `barcode.update` / `barcode.archive`

### `catalog.uomConversionList`
- **Input:** `{ categoryId?, productId?, skuId?, includeArchived? }`
- **Reads:** `uom_conversion`
- **Guards:** referenced category/product/SKU filters must be visible through tenant RLS.

### `catalog.uomConversionCreate`
- **Input:** `{ fromUomId, toUomId, role, factor, factorScale?, categoryId?, productId?, skuId? }`
- **Writes:** `uom_conversion`
- **Guards:** referenced UoMs/category/product/SKU must be visible through tenant RLS.
- **Audit:** `uom_conversion.create`

### `catalog.uomConversionUpdate` / `catalog.uomConversionArchive`
- **Input:** update `{ id, fromUomId?, toUomId?, role?, factor?, factorScale?, categoryId?, productId?, skuId?, isActive? }`; archive `{ id }`
- **Writes:** `uom_conversion`
- **Guards:** referenced UoMs/category/product/SKU must be visible through tenant RLS.
- **Audit:** `uom_conversion.update` / `uom_conversion.archive`

## Inventory routes

### `inventory.lotList`
- **Input:** `{ skuId?, status?, includeArchived? }`
- **Permission:** `inventory.receive`
- **Reads:** `lot`
- **Guards:** referenced SKU filter must be visible through tenant RLS.

### `inventory.lotCreate`
- **Input:** `{ skuId, lotNumber, expiryDate?, manufacturedDate?, status? }`
- **Permission:** `inventory.receive`
- **Writes:** `lot`
- **Guard:** `skuId` must be visible through tenant RLS.
- **Audit:** `lot.create`

### `inventory.lotUpdate`
- **Input:** `{ id, lotNumber?, expiryDate?, manufacturedDate?, status? }`
- **Permission:** `inventory.receive`
- **Writes:** `lot`
- **Audit:** `lot.update`

### `inventory.lotArchive`
- **Input:** `{ id }`
- **Permission:** `inventory.receive`
- **Writes:** `lot.deleted_at`
- **Audit:** `lot.archive`

### `inventory.reorderRuleList`
- **Input:** `{ skuId?, locationId?, includeArchived? }`
- **Permission:** `inventory.reorder`
- **Reads:** `reorder_rule`
- **Guards:** referenced SKU/location filters must be visible through tenant RLS.

### `inventory.reorderRuleUpsert`
- **Input:** `{ skuId, locationId, minQty, maxQty, isActive? }`
- **Permission:** `inventory.reorder`
- **Writes:** `reorder_rule`
- **Guards:** referenced SKU/location must be visible through tenant RLS; `maxQty >= minQty`.
- **Audit:** `reorder_rule.create` or `reorder_rule.update`

### `inventory.reorderRuleArchive`
- **Input:** `{ id }`
- **Permission:** `inventory.reorder`
- **Writes:** `reorder_rule.deleted_at`, `is_active=false`
- **Audit:** `reorder_rule.archive`

### `inventory.stockDiscrepancyList`
- **Input:** `{ locationId? }`
- **Permission:** `inventory.count`
- **Reads:** latest SKU×location ledger balances where `balance_after < 0`.

### `inventory.stockDiscrepancyReview`
- **Input:** `{ skuId, locationId, resolution, notes? }` where `resolution` is `count_requested | accepted | adjusted`
- **Permission:** `inventory.count`
- **Behavior:** validates SKU/location visibility, emits `inventory.stock_discrepancy_reviewed`, and records audit. Persistent workflow state is deferred until the manager-review UI/work queue exists.
- **Audit:** `inventory.stock_discrepancy.review`

### `inventory.revalue`
- **Input:** AVCO `{ skuId, locationId, reasonCode, totalValueMinor, currency, scale }`; FIFO `{ skuId, locationId, reasonCode, fifoLayerId, unitCostMinor }`
- **Permission:** `inventory.adjust`
- **Behavior:** resolves effective costing method. AVCO locks and updates the SKU×location `avg_cost` row; FIFO locks and updates a specific `valuation_layer` unit cost. Emits `inventory.revalued` and records before/after audit. Zero-on-hand AVCO rows cannot carry non-zero value.
- **Audit:** `inventory.revalue`

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

- Catalog create + list + update + archive endpoints exist for `category`, `brand`, `sku`, `barcode`, `unit_of_measure`, and `uom_conversion`.
- Product create/list/update/archive exist with Phase-2 category/brand/base UoM/costing/tracking fields.
- Variant create/list/update/archive exist.
- Lot create/list/update/archive and reorder-rule list/upsert/archive exist.
- Phase-2 router e2e covers mixed AVCO+FIFO valued receipt/report flow plus catalog/product/variant/lot/reorder lifecycle routes, revaluation, stock discrepancy review, and import preview validation. Bulk import apply/rollback remains a later reviewed operation.
- Event payloads are implemented for the new router seams, but the outbox dispatcher/consumer remains a later phase.
- UI remains intentionally absent.
