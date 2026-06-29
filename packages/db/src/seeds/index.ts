import { and, eq } from "drizzle-orm";
import type { createDb } from "../index";
import {
  barcode,
  bom,
  bomLine,
  brand,
  bundle,
  category,
  company,
  invoice,
  type LOCATION_TYPES,
  location,
  lot,
  organization,
  product,
  reorderRule,
  sale,
  saleLine,
  serial,
  sku,
  stockCount,
  stockCountLine,
  stockLedger,
  stockTransfer,
  tender,
  unitOfMeasure,
  uomConversion,
  variant,
} from "../schema";
import {
  appendStockMovement,
  applyValuation,
  createBondReceipt,
  createTransfer,
  executeBondRelease,
  receiveTransfer,
  shipTransfer,
} from "../services";
import { withTenant } from "../tenant";

type Database = ReturnType<typeof createDb>;

export interface ProvisionedTenant {
  adminUserId: string;
  tenantId: string;
}

// Provisions the platform admin + a tenant organization THROUGH Better Auth
// (never a raw user/org insert) — injected so the seed package carries no auth
// bypass. Wired to the Better Auth server API in a later commit; kept as a
// dependency so the seeding discipline is established from day one (charter §32).
// Implementations must be idempotent by adminEmail/name because Phase-2 seed
// rows below are rerunnable and user/org provisioning is intentionally external.
export type ProvisionTenant = (input: {
  name: string;
  adminEmail: string;
}) => Promise<ProvisionedTenant>;

export interface SeedDeps {
  database: Database;
  provisionTenant: ProvisionTenant;
}

function required<T>(row: T | undefined, what: string): T {
  if (!row) {
    throw new Error(`seed: expected ${what} to be inserted`);
  }
  return row;
}

async function appendSeedMovement(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  tenant: ProvisionedTenant,
  input: Parameters<typeof appendStockMovement>[2]
) {
  if (!input.idempotencyKey) {
    throw new Error("seed movement requires an idempotency key");
  }
  const existing = await tx
    .select()
    .from(stockLedger)
    .where(
      and(
        eq(stockLedger.tenantId, tenant.tenantId),
        eq(stockLedger.idempotencyKey, input.idempotencyKey)
      )
    )
    .limit(1);
  const found = existing.at(0);
  if (found) {
    return { created: false, movement: found };
  }
  const movement = await appendStockMovement(
    tx,
    { tenantId: tenant.tenantId },
    input
  );
  return { created: true, movement };
}

// Reusable VS#1 seed for dev / CI / Playwright / demos (charter §32). Domain
// rows are written through `withTenant` — the tenant-scoped path — so the
// fail-closed RLS policies apply and the seed can never become an RLS bypass.
export async function seedVs1(deps: SeedDeps): Promise<ProvisionedTenant> {
  const tenant = await deps.provisionTenant({
    name: "Sample Retailer",
    adminEmail: "admin@example.com",
  });

  await withTenant(deps.database, tenant.tenantId, async (tx) => {
    const insertedCompany = await tx
      .insert(company)
      .values({
        tenantId: tenant.tenantId,
        name: "Sample Retailer HQ",
        createdBy: tenant.adminUserId,
      })
      .returning();
    const seededCompany = required(insertedCompany.at(0), "company");

    const insertedLocation = await tx
      .insert(location)
      .values({
        tenantId: tenant.tenantId,
        companyId: seededCompany.id,
        name: "Main Store",
        type: "store",
        createdBy: tenant.adminUserId,
      })
      .returning();
    required(insertedLocation.at(0), "location");

    await tx.insert(product).values({
      tenantId: tenant.tenantId,
      sku: "SKU-0001",
      name: "Sample Product",
      priceMinor: 1999,
      currency: "USD",
      scale: 2,
      createdBy: tenant.adminUserId,
    });
  });

  return tenant;
}

export interface Phase2SeedResult {
  mixed: ProvisionedTenant;
  pharmacy: ProvisionedTenant;
  supermarket: ProvisionedTenant;
}

function ensureCompany(
  deps: SeedDeps,
  tenant: ProvisionedTenant,
  name: string
) {
  return withTenant(deps.database, tenant.tenantId, async (tx) => {
    const existing = await tx
      .select()
      .from(company)
      .where(and(eq(company.tenantId, tenant.tenantId), eq(company.name, name)))
      .limit(1);
    const found = existing.at(0);
    if (found) {
      return found;
    }
    return required(
      (
        await tx
          .insert(company)
          .values({
            tenantId: tenant.tenantId,
            name,
            createdBy: tenant.adminUserId,
          })
          .returning()
      ).at(0),
      "company"
    );
  });
}

function ensureLocation(
  deps: SeedDeps,
  tenant: ProvisionedTenant,
  companyId: string,
  name: string,
  type: (typeof LOCATION_TYPES)[number]
) {
  return withTenant(deps.database, tenant.tenantId, async (tx) => {
    const existing = await tx
      .select()
      .from(location)
      .where(
        and(eq(location.tenantId, tenant.tenantId), eq(location.name, name))
      )
      .limit(1);
    const found = existing.at(0);
    if (found) {
      return found;
    }
    return required(
      (
        await tx
          .insert(location)
          .values({
            tenantId: tenant.tenantId,
            companyId,
            name,
            type,
            createdBy: tenant.adminUserId,
          })
          .returning()
      ).at(0),
      "location"
    );
  });
}

async function seedPhase2Tenant(
  deps: SeedDeps,
  tenant: ProvisionedTenant,
  input: {
    companyName: string;
    locationName: string;
    locationType: (typeof LOCATION_TYPES)[number];
    costingMethod: "avco" | "fifo";
    includeMixedOverrides?: boolean;
  }
) {
  await deps.database
    .update(organization)
    .set({
      costingMethod: input.costingMethod,
      barcodeParserConfig: {
        symbologies: ["ean13", "upca", "ean8", "code128", "gs1"],
        variableMeasure: { prefix: "21", embedded: "weight_g" },
      },
    })
    .where(eq(organization.id, tenant.tenantId));

  const seededCompany = await ensureCompany(deps, tenant, input.companyName);
  const seededLocation = await ensureLocation(
    deps,
    tenant,
    seededCompany.id,
    input.locationName,
    input.locationType
  );

  await withTenant(deps.database, tenant.tenantId, async (tx) => {
    const [each, carton, kilogram, gram] = await Promise.all([
      tx
        .insert(unitOfMeasure)
        .values({
          tenantId: tenant.tenantId,
          code: "EA",
          name: "Each",
          kind: "count",
          decimalScale: 0,
          createdBy: tenant.adminUserId,
        })
        .onConflictDoUpdate({
          target: [unitOfMeasure.tenantId, unitOfMeasure.code],
          set: { name: "Each", kind: "count", decimalScale: 0 },
        })
        .returning(),
      tx
        .insert(unitOfMeasure)
        .values({
          tenantId: tenant.tenantId,
          code: "CTN24",
          name: "Carton of 24",
          kind: "count",
          decimalScale: 0,
          createdBy: tenant.adminUserId,
        })
        .onConflictDoUpdate({
          target: [unitOfMeasure.tenantId, unitOfMeasure.code],
          set: { name: "Carton of 24", kind: "count", decimalScale: 0 },
        })
        .returning(),
      tx
        .insert(unitOfMeasure)
        .values({
          tenantId: tenant.tenantId,
          code: "KG",
          name: "Kilogram",
          kind: "weight",
          decimalScale: 3,
          createdBy: tenant.adminUserId,
        })
        .onConflictDoUpdate({
          target: [unitOfMeasure.tenantId, unitOfMeasure.code],
          set: { name: "Kilogram", kind: "weight", decimalScale: 3 },
        })
        .returning(),
      tx
        .insert(unitOfMeasure)
        .values({
          tenantId: tenant.tenantId,
          code: "G",
          name: "Gram",
          kind: "weight",
          decimalScale: 0,
          createdBy: tenant.adminUserId,
        })
        .onConflictDoUpdate({
          target: [unitOfMeasure.tenantId, unitOfMeasure.code],
          set: { name: "Gram", kind: "weight", decimalScale: 0 },
        })
        .returning(),
    ]);

    const eachUom = required(each.at(0), "EA unit");
    const cartonUom = required(carton.at(0), "CTN24 unit");
    const kgUom = required(kilogram.at(0), "KG unit");
    const gramUom = required(gram.at(0), "G unit");

    const groceryCategory = required(
      (
        await tx
          .insert(category)
          .values({
            tenantId: tenant.tenantId,
            name: "Grocery",
            code: "GROCERY",
            costingMethod: input.includeMixedOverrides ? "avco" : null,
            trackingMode: "lot",
            createdBy: tenant.adminUserId,
          })
          .onConflictDoUpdate({
            target: [category.tenantId, category.code],
            set: {
              name: "Grocery",
              costingMethod: input.includeMixedOverrides ? "avco" : null,
              trackingMode: "lot",
            },
          })
          .returning()
      ).at(0),
      "grocery category"
    );
    const pharmacyCategory = required(
      (
        await tx
          .insert(category)
          .values({
            tenantId: tenant.tenantId,
            name: "Pharmacy",
            code: "PHARMACY",
            costingMethod: "fifo",
            trackingMode: "lot",
            createdBy: tenant.adminUserId,
          })
          .onConflictDoUpdate({
            target: [category.tenantId, category.code],
            set: {
              name: "Pharmacy",
              costingMethod: "fifo",
              trackingMode: "lot",
            },
          })
          .returning()
      ).at(0),
      "pharmacy category"
    );
    const bundleCategory = required(
      (
        await tx
          .insert(category)
          .values({
            tenantId: tenant.tenantId,
            name: "Bundles",
            code: "BUNDLES",
            costingMethod: "avco",
            trackingMode: "none",
            createdBy: tenant.adminUserId,
          })
          .onConflictDoUpdate({
            target: [category.tenantId, category.code],
            set: {
              name: "Bundles",
              costingMethod: "avco",
              trackingMode: "none",
            },
          })
          .returning()
      ).at(0),
      "bundle category"
    );

    const houseBrand = required(
      (
        await tx
          .insert(brand)
          .values({
            tenantId: tenant.tenantId,
            name: "RetailOS House",
            code: "HOUSE",
            createdBy: tenant.adminUserId,
          })
          .onConflictDoUpdate({
            target: [brand.tenantId, brand.code],
            set: { name: "RetailOS House" },
          })
          .returning()
      ).at(0),
      "house brand"
    );

    const riceProduct = required(
      (
        await tx
          .insert(product)
          .values({
            tenantId: tenant.tenantId,
            sku: "RICE-5KG",
            name: "Long Grain Rice 5kg",
            categoryId: groceryCategory.id,
            brandId: houseBrand.id,
            baseUomId: eachUom.id,
            costingMethod: null,
            trackingMode: "lot",
            priceMinor: 1299,
            currency: "USD",
            scale: 2,
            createdBy: tenant.adminUserId,
          })
          .onConflictDoUpdate({
            target: [product.tenantId, product.sku],
            set: {
              name: "Long Grain Rice 5kg",
              categoryId: groceryCategory.id,
              brandId: houseBrand.id,
              baseUomId: eachUom.id,
              trackingMode: "lot",
              priceMinor: 1299,
              currency: "USD",
              scale: 2,
            },
          })
          .returning()
      ).at(0),
      "rice product"
    );
    const syrupProduct = required(
      (
        await tx
          .insert(product)
          .values({
            tenantId: tenant.tenantId,
            sku: "COUGH-SYRUP-100ML",
            name: "Cough Syrup 100ml",
            categoryId: pharmacyCategory.id,
            brandId: houseBrand.id,
            baseUomId: eachUom.id,
            costingMethod: input.includeMixedOverrides ? "fifo" : null,
            trackingMode: "lot",
            priceMinor: 899,
            currency: "USD",
            scale: 2,
            createdBy: tenant.adminUserId,
          })
          .onConflictDoUpdate({
            target: [product.tenantId, product.sku],
            set: {
              name: "Cough Syrup 100ml",
              categoryId: pharmacyCategory.id,
              brandId: houseBrand.id,
              baseUomId: eachUom.id,
              costingMethod: input.includeMixedOverrides ? "fifo" : null,
              trackingMode: "lot",
              priceMinor: 899,
              currency: "USD",
              scale: 2,
            },
          })
          .returning()
      ).at(0),
      "syrup product"
    );
    const bananasProduct = required(
      (
        await tx
          .insert(product)
          .values({
            tenantId: tenant.tenantId,
            sku: "BANANA-WEIGHED",
            name: "Loose Bananas",
            categoryId: groceryCategory.id,
            brandId: houseBrand.id,
            baseUomId: gramUom.id,
            costingMethod: "avco",
            trackingMode: "none",
            priceMinor: 399,
            currency: "USD",
            scale: 2,
            createdBy: tenant.adminUserId,
          })
          .onConflictDoUpdate({
            target: [product.tenantId, product.sku],
            set: {
              name: "Loose Bananas",
              categoryId: groceryCategory.id,
              brandId: houseBrand.id,
              baseUomId: gramUom.id,
              costingMethod: "avco",
              trackingMode: "none",
              priceMinor: 399,
              currency: "USD",
              scale: 2,
            },
          })
          .returning()
      ).at(0),
      "bananas product"
    );
    const mealDealProduct = required(
      (
        await tx
          .insert(product)
          .values({
            tenantId: tenant.tenantId,
            sku: "MEAL-DEAL",
            name: "Rice and Syrup Care Pack",
            categoryId: bundleCategory.id,
            brandId: houseBrand.id,
            baseUomId: eachUom.id,
            costingMethod: "avco",
            trackingMode: "none",
            priceMinor: 1999,
            currency: "USD",
            scale: 2,
            createdBy: tenant.adminUserId,
          })
          .onConflictDoUpdate({
            target: [product.tenantId, product.sku],
            set: {
              name: "Rice and Syrup Care Pack",
              categoryId: bundleCategory.id,
              brandId: houseBrand.id,
              baseUomId: eachUom.id,
              costingMethod: "avco",
              trackingMode: "none",
              priceMinor: 1999,
              currency: "USD",
              scale: 2,
            },
          })
          .returning()
      ).at(0),
      "meal deal product"
    );

    await tx
      .insert(variant)
      .values([
        {
          tenantId: tenant.tenantId,
          productId: riceProduct.id,
          name: "Size",
          value: "5kg",
          sortOrder: 1,
          createdBy: tenant.adminUserId,
        },
        {
          tenantId: tenant.tenantId,
          productId: syrupProduct.id,
          name: "Pack",
          value: "100ml",
          sortOrder: 1,
          createdBy: tenant.adminUserId,
        },
      ])
      .onConflictDoNothing();

    const riceSku = required(
      (
        await tx
          .insert(sku)
          .values({
            tenantId: tenant.tenantId,
            productId: riceProduct.id,
            code: "RICE-5KG-EA",
            name: "Long Grain Rice 5kg Each",
            baseUomId: eachUom.id,
            costingMethod: null,
            trackingMode: "lot",
            createdBy: tenant.adminUserId,
          })
          .onConflictDoUpdate({
            target: [sku.tenantId, sku.code],
            set: {
              productId: riceProduct.id,
              name: "Long Grain Rice 5kg Each",
              baseUomId: eachUom.id,
              trackingMode: "lot",
              isActive: true,
            },
          })
          .returning()
      ).at(0),
      "rice sku"
    );
    const syrupSku = required(
      (
        await tx
          .insert(sku)
          .values({
            tenantId: tenant.tenantId,
            productId: syrupProduct.id,
            code: "COUGH-SYRUP-100ML-EA",
            name: "Cough Syrup 100ml Each",
            baseUomId: eachUom.id,
            costingMethod: input.includeMixedOverrides ? "fifo" : null,
            trackingMode: "lot",
            createdBy: tenant.adminUserId,
          })
          .onConflictDoUpdate({
            target: [sku.tenantId, sku.code],
            set: {
              productId: syrupProduct.id,
              name: "Cough Syrup 100ml Each",
              baseUomId: eachUom.id,
              costingMethod: input.includeMixedOverrides ? "fifo" : null,
              trackingMode: "lot",
              isActive: true,
            },
          })
          .returning()
      ).at(0),
      "syrup sku"
    );
    const bananaSku = required(
      (
        await tx
          .insert(sku)
          .values({
            tenantId: tenant.tenantId,
            productId: bananasProduct.id,
            code: "BANANA-G",
            name: "Loose Bananas by Gram",
            baseUomId: gramUom.id,
            costingMethod: "avco",
            trackingMode: "none",
            createdBy: tenant.adminUserId,
          })
          .onConflictDoUpdate({
            target: [sku.tenantId, sku.code],
            set: {
              productId: bananasProduct.id,
              name: "Loose Bananas by Gram",
              baseUomId: gramUom.id,
              costingMethod: "avco",
              trackingMode: "none",
              isActive: true,
            },
          })
          .returning()
      ).at(0),
      "banana sku"
    );

    await tx
      .insert(barcode)
      .values([
        {
          tenantId: tenant.tenantId,
          skuId: riceSku.id,
          value: `7501000${tenant.tenantId.slice(0, 4)}01`,
          symbology: "ean13",
          isPrimary: true,
          createdBy: tenant.adminUserId,
        },
        {
          tenantId: tenant.tenantId,
          skuId: syrupSku.id,
          value: `7502000${tenant.tenantId.slice(0, 4)}01`,
          symbology: "gs1",
          isPrimary: true,
          createdBy: tenant.adminUserId,
        },
        {
          tenantId: tenant.tenantId,
          skuId: bananaSku.id,
          value: `2100000${tenant.tenantId.slice(0, 4)}01`,
          symbology: "ean13",
          isPrimary: true,
          createdBy: tenant.adminUserId,
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(uomConversion)
      .values([
        {
          tenantId: tenant.tenantId,
          skuId: riceSku.id,
          fromUomId: cartonUom.id,
          toUomId: eachUom.id,
          role: "purchase",
          factor: 24,
          factorScale: 0,
          createdBy: tenant.adminUserId,
        },
        {
          tenantId: tenant.tenantId,
          productId: bananasProduct.id,
          fromUomId: kgUom.id,
          toUomId: gramUom.id,
          role: "sale",
          factor: 1000,
          factorScale: 0,
          createdBy: tenant.adminUserId,
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(lot)
      .values([
        {
          tenantId: tenant.tenantId,
          skuId: riceSku.id,
          lotNumber: "RICE-EXPIRED-2026-05",
          expiryDate: "2026-05-31",
          manufacturedDate: "2025-05-31",
          status: "expired",
          createdBy: tenant.adminUserId,
        },
        {
          tenantId: tenant.tenantId,
          skuId: riceSku.id,
          lotNumber: "RICE-NEAR-2026-07",
          expiryDate: "2026-07-15",
          manufacturedDate: "2025-07-15",
          status: "available",
          createdBy: tenant.adminUserId,
        },
        {
          tenantId: tenant.tenantId,
          skuId: syrupSku.id,
          lotNumber: "SYRUP-FAR-2028-01",
          expiryDate: "2028-01-31",
          manufacturedDate: "2026-01-31",
          status: "available",
          createdBy: tenant.adminUserId,
        },
      ])
      .onConflictDoNothing();

    const syrupLot = required(
      (
        await tx
          .select()
          .from(lot)
          .where(
            and(
              eq(lot.tenantId, tenant.tenantId),
              eq(lot.skuId, syrupSku.id),
              eq(lot.lotNumber, "SYRUP-FAR-2028-01")
            )
          )
          .limit(1)
      ).at(0),
      "syrup lot"
    );
    const riceLot = required(
      (
        await tx
          .select()
          .from(lot)
          .where(
            and(
              eq(lot.tenantId, tenant.tenantId),
              eq(lot.skuId, riceSku.id),
              eq(lot.lotNumber, "RICE-NEAR-2026-07")
            )
          )
          .limit(1)
      ).at(0),
      "rice lot"
    );

    await tx
      .insert(serial)
      .values({
        tenantId: tenant.tenantId,
        skuId: syrupSku.id,
        lotId: syrupLot.id,
        serialNumber: `SYRUP-STUB-${tenant.tenantId}`,
        status: "available",
        createdBy: tenant.adminUserId,
      })
      .onConflictDoNothing();

    const valuationMovements = [
      {
        costCurrency: "USD",
        costScale: 2,
        idempotencyKey: `seed:${tenant.tenantId}:rice:receipt:1`,
        locationId: seededLocation.id,
        lotId: riceLot.id,
        movementType: "receipt" as const,
        productId: riceProduct.id,
        qtyDelta: 5,
        refType: "seed",
        skuId: riceSku.id,
        unitCostMinor: 120,
      },
      {
        costCurrency: "USD",
        costScale: 2,
        idempotencyKey: `seed:${tenant.tenantId}:rice:receipt:2`,
        locationId: seededLocation.id,
        lotId: riceLot.id,
        movementType: "receipt" as const,
        productId: riceProduct.id,
        qtyDelta: 2,
        refType: "seed",
        skuId: riceSku.id,
        unitCostMinor: 121,
      },
      {
        idempotencyKey: `seed:${tenant.tenantId}:rice:issue:1`,
        locationId: seededLocation.id,
        lotId: riceLot.id,
        movementType: "sale" as const,
        productId: riceProduct.id,
        qtyDelta: -3,
        refType: "seed",
        skuId: riceSku.id,
      },
      {
        costCurrency: "USD",
        costScale: 2,
        idempotencyKey: `seed:${tenant.tenantId}:syrup:receipt:1`,
        locationId: seededLocation.id,
        lotId: syrupLot.id,
        movementType: "receipt" as const,
        productId: syrupProduct.id,
        qtyDelta: 3,
        refType: "seed",
        skuId: syrupSku.id,
        unitCostMinor: 500,
      },
      {
        costCurrency: "USD",
        costScale: 2,
        idempotencyKey: `seed:${tenant.tenantId}:syrup:receipt:2`,
        locationId: seededLocation.id,
        lotId: syrupLot.id,
        movementType: "receipt" as const,
        productId: syrupProduct.id,
        qtyDelta: 2,
        refType: "seed",
        skuId: syrupSku.id,
        unitCostMinor: 700,
      },
      {
        idempotencyKey: `seed:${tenant.tenantId}:syrup:issue:1`,
        locationId: seededLocation.id,
        lotId: syrupLot.id,
        movementType: "sale" as const,
        productId: syrupProduct.id,
        qtyDelta: -4,
        refType: "seed",
        skuId: syrupSku.id,
      },
      {
        idempotencyKey: `seed:${tenant.tenantId}:banana:oversell:1`,
        locationId: seededLocation.id,
        movementType: "sale" as const,
        productId: bananasProduct.id,
        qtyDelta: -5,
        refType: "seed-oversell",
        skuId: bananaSku.id,
      },
    ];
    for (const movementInput of valuationMovements) {
      const { created, movement } = await appendSeedMovement(
        tx,
        tenant,
        movementInput
      );
      if (created) {
        await applyValuation(tx, { tenantId: tenant.tenantId }, movement);
      }
    }

    await tx
      .insert(reorderRule)
      .values([
        {
          tenantId: tenant.tenantId,
          skuId: riceSku.id,
          locationId: seededLocation.id,
          minQty: 25,
          maxQty: 100,
          createdBy: tenant.adminUserId,
        },
        {
          tenantId: tenant.tenantId,
          skuId: syrupSku.id,
          locationId: seededLocation.id,
          minQty: 10,
          maxQty: 40,
          createdBy: tenant.adminUserId,
        },
      ])
      .onConflictDoNothing();

    const existingCount = await tx
      .select()
      .from(stockCount)
      .where(
        and(
          eq(stockCount.tenantId, tenant.tenantId),
          eq(stockCount.locationId, seededLocation.id),
          eq(stockCount.scope, "cycle"),
          eq(stockCount.status, "started")
        )
      )
      .limit(1);
    const countHeader =
      existingCount.at(0) ??
      required(
        (
          await tx
            .insert(stockCount)
            .values({
              tenantId: tenant.tenantId,
              locationId: seededLocation.id,
              scope: "cycle",
              status: "started",
              createdBy: tenant.adminUserId,
            })
            .returning()
        ).at(0),
        "stock count"
      );

    await tx
      .insert(stockCountLine)
      .values([
        {
          tenantId: tenant.tenantId,
          stockCountId: countHeader.id,
          skuId: riceSku.id,
          countedQty: 18,
          systemQty: 20,
          varianceQty: -2,
          varianceValueMinor: -240,
          currency: "USD",
          scale: 2,
        },
        {
          tenantId: tenant.tenantId,
          stockCountId: countHeader.id,
          skuId: syrupSku.id,
          countedQty: 12,
          systemQty: 12,
          varianceQty: 0,
          varianceValueMinor: 0,
          currency: "USD",
          scale: 2,
        },
      ])
      .onConflictDoNothing();

    await tx
      .insert(bundle)
      .values({
        tenantId: tenant.tenantId,
        productId: mealDealProduct.id,
        name: "Care Pack Bundle",
        createdBy: tenant.adminUserId,
      })
      .onConflictDoNothing();

    const mealDealBom = required(
      (
        await tx
          .insert(bom)
          .values({
            tenantId: tenant.tenantId,
            productId: mealDealProduct.id,
            name: "Default",
            status: "active",
            createdBy: tenant.adminUserId,
          })
          .onConflictDoUpdate({
            target: [bom.tenantId, bom.productId, bom.name],
            set: { status: "active" },
          })
          .returning()
      ).at(0),
      "meal deal BOM"
    );

    await tx
      .insert(bomLine)
      .values([
        {
          tenantId: tenant.tenantId,
          bomId: mealDealBom.id,
          componentSkuId: riceSku.id,
          qtyBase: 1,
          sortOrder: 1,
        },
        {
          tenantId: tenant.tenantId,
          bomId: mealDealBom.id,
          componentSkuId: syrupSku.id,
          qtyBase: 1,
          sortOrder: 2,
        },
      ])
      .onConflictDoNothing();
  });
}

// Rich Phase-2 seed foundation: multi-tenant catalog/config state only.
// Valuation-bearing stock movements are intentionally seeded later through the
// costing resolver so AVCO/FIFO projections are computed, never hand-faked.
export async function seedPhase2(deps: SeedDeps): Promise<Phase2SeedResult> {
  const supermarket = await deps.provisionTenant({
    name: "Phase 2 Supermarket AVCO",
    adminEmail: "inventory.avco@example.com",
  });
  const pharmacy = await deps.provisionTenant({
    name: "Phase 2 Pharmacy FIFO",
    adminEmail: "inventory.fifo@example.com",
  });
  const mixed = await deps.provisionTenant({
    name: "Phase 2 Mixed Catalog",
    adminEmail: "inventory.mixed@example.com",
  });

  await seedPhase2Tenant(deps, supermarket, {
    companyName: "AVCO Supermarket Ltd",
    locationName: "AVCO Main Store",
    locationType: "store",
    costingMethod: "avco",
  });
  await seedPhase2Tenant(deps, pharmacy, {
    companyName: "FIFO Pharmacy Ltd",
    locationName: "Pharmacy Counter",
    locationType: "store",
    costingMethod: "fifo",
  });
  await seedPhase2Tenant(deps, mixed, {
    companyName: "Mixed Retail Group",
    locationName: "Mixed Flagship",
    locationType: "store",
    costingMethod: "avco",
    includeMixedOverrides: true,
  });

  return { supermarket, pharmacy, mixed };
}

// ── Phase 3 seed (locations tree / transfers / bonded receive + release) ──────
// Self-contained on a fresh tenant (charter §32 demo data). Exercises the
// Phase-3 surfaces end-to-end through the SERVICES (never raw movement inserts
// for valued stock): a unified location TREE (warehouse → zone → bins with the
// capacity seam), an in-flight transfer (shipped, not received) AND a completed
// one, and a bonded receipt followed by a bond release WITH duty. Run-once on a
// fresh tenant: transfers/releases carry gapless sequence numbers and consume
// stock, so it is intentionally NOT idempotent on rerun (unlike the Phase-2
// catalog seed) — provision a fresh tenant (or clean first) to re-seed.
export interface Phase3SeedResult {
  binIds: string[];
  bondedLocationId: string;
  bondReleaseId: string;
  completedTransferId: string;
  inFlightTransferId: string;
  storeLocationId: string;
  tenant: ProvisionedTenant;
  warehouseId: string;
}

export async function seedPhase3(deps: SeedDeps): Promise<Phase3SeedResult> {
  const tenant = await deps.provisionTenant({
    name: "Phase 3 Distribution Co",
    adminEmail: "phase3.bonds@example.com",
  });
  const ctx = { actorUserId: tenant.adminUserId, tenantId: tenant.tenantId };

  // Bonded stock is AVCO-only (§I.4); set the tenant default so the bonded
  // receipt's SKUs resolve to AVCO.
  await deps.database
    .update(organization)
    .set({ costingMethod: "avco" })
    .where(eq(organization.id, tenant.tenantId));

  return await withTenant(deps.database, tenant.tenantId, async (tx) => {
    const co = required(
      (
        await tx
          .insert(company)
          .values({
            tenantId: tenant.tenantId,
            name: "Phase 3 Distribution Ltd",
            createdBy: tenant.adminUserId,
          })
          .returning()
      ).at(0),
      "company"
    );
    const uom = required(
      (
        await tx
          .insert(unitOfMeasure)
          .values({ tenantId: tenant.tenantId, code: "EA", name: "Each" })
          .returning()
      ).at(0),
      "uom"
    );

    const insertLoc = async (vals: {
      name: string;
      type: (typeof LOCATION_TYPES)[number];
      parentLocationId?: string;
      isSellable?: boolean;
      isBonded?: boolean;
      maxWeight?: number;
      maxVolume?: number;
    }) =>
      required(
        (
          await tx
            .insert(location)
            .values({
              tenantId: tenant.tenantId,
              companyId: co.id,
              createdBy: tenant.adminUserId,
              ...vals,
            })
            .returning()
        ).at(0),
        `location ${vals.name}`
      );

    const store = await insertLoc({
      name: "P3 Store",
      type: "store",
      isSellable: true,
    });
    // Unified tree: warehouse → zone → bins (the zone/bin nodes are non-sellable
    // structural nodes; bins carry the capacity seam).
    const warehouse = await insertLoc({
      name: "P3 Central Warehouse",
      type: "warehouse",
      isSellable: false,
    });
    const zone = await insertLoc({
      name: "P3 Zone A",
      type: "zone",
      parentLocationId: warehouse.id,
      isSellable: false,
    });
    const binA = await insertLoc({
      name: "P3 Bin A-01",
      type: "bin",
      parentLocationId: zone.id,
      isSellable: false,
      maxWeight: 100_000,
      maxVolume: 5000,
    });
    const binB = await insertLoc({
      name: "P3 Bin A-02",
      type: "bin",
      parentLocationId: zone.id,
      isSellable: false,
      maxWeight: 100_000,
      maxVolume: 5000,
    });
    const bonded = await insertLoc({
      name: "P3 Bonded WH",
      type: "bonded",
      isBonded: true,
      isSellable: false,
    });

    const makeProductSku = async (code: string, name: string) => {
      const p = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: tenant.tenantId,
              sku: code,
              name,
              baseUomId: uom.id,
              priceMinor: 5000,
              currency: "USD",
              createdBy: tenant.adminUserId,
            })
            .returning()
        ).at(0),
        `product ${code}`
      );
      const s = required(
        (
          await tx
            .insert(sku)
            .values({
              tenantId: tenant.tenantId,
              productId: p.id,
              code: `${code}-EA`,
              baseUomId: uom.id,
            })
            .returning()
        ).at(0),
        `sku ${code}`
      );
      return { productId: p.id, skuId: s.id };
    };
    const widget = await makeProductSku("P3-WIDGET", "Phase 3 Widget");
    const gadget = await makeProductSku("P3-GADGET", "Phase 3 Gadget");

    // Stock the warehouse with valued receipts so transfers conserve VALUE.
    const stockWarehouse = async (
      skuId: string,
      productId: string,
      qty: number,
      unitCostMinor: number,
      key: string
    ) => {
      const { movement } = await appendSeedMovement(tx, tenant, {
        locationId: warehouse.id,
        productId,
        skuId,
        movementType: "receipt",
        qtyDelta: qty,
        unitCostMinor,
        costCurrency: "USD",
        costScale: 2,
        idempotencyKey: key,
      });
      await applyValuation(tx, ctx, movement);
    };
    await stockWarehouse(
      widget.skuId,
      widget.productId,
      100,
      1200,
      "p3-wh-widget"
    );
    await stockWarehouse(
      gadget.skuId,
      gadget.productId,
      50,
      3400,
      "p3-wh-gadget"
    );

    // Transfer 1 — COMPLETED (warehouse → store): create → ship → receive.
    const { transfer: completed } = await createTransfer(tx, ctx, {
      sourceLocationId: warehouse.id,
      destLocationId: store.id,
      lines: [{ productId: widget.productId, skuId: widget.skuId, qty: 30 }],
    });
    await shipTransfer(tx, ctx, completed.id);
    await receiveTransfer(tx, ctx, completed.id);

    // Transfer 2 — IN-FLIGHT (shipped, awaiting receipt; stock sits in the
    // per-transfer in-transit node).
    const { transfer: inFlight } = await createTransfer(tx, ctx, {
      sourceLocationId: warehouse.id,
      destLocationId: store.id,
      lines: [{ productId: gadget.productId, skuId: gadget.skuId, qty: 10 }],
    });
    await shipTransfer(tx, ctx, inFlight.id);

    // Bonded receipt (import batch) into the bonded location, then a bond
    // release bonded → store WITH duty + tax (value-only cost-basis add).
    const { receipt, lines } = await createBondReceipt(tx, ctx, {
      companyId: co.id,
      locationId: bonded.id,
      supplierRef: "P3-IMP-001",
      customsReference: "P3-CUST-001",
      lines: [
        {
          productId: widget.productId,
          skuId: widget.skuId,
          qty: 40,
          unitCostMinor: 1500,
          costCurrency: "USD",
          costScale: 2,
        },
      ],
    });
    const { release } = await executeBondRelease(tx, ctx, {
      bondReceiptId: receipt.id,
      destLocationId: store.id,
      lines: [
        {
          bondReceiptLineId: required(lines[0], "bond receipt line").id,
          qty: 25,
          dutyMinor: 1875,
          taxMinor: 625,
        },
      ],
    });

    return {
      bondReleaseId: release.id,
      bondedLocationId: bonded.id,
      binIds: [binA.id, binB.id],
      completedTransferId: completed.id,
      inFlightTransferId: inFlight.id,
      storeLocationId: store.id,
      tenant,
      warehouseId: warehouse.id,
    };
  });
}

// ── Demo seed (marketing/demo tenant) ────────────────────────────────────────
// ONE rich, multi-scenario tenant suitable for a product demo: a small company
// with two stores + a central warehouse + a bonded warehouse, a ~24-product
// catalog across several categories (mostly AVCO/untracked, a couple lot-tracked
// FIFO), opening stock, completed POS sales across both stores over time, two
// completed inter-store transfers, and a bonded receipt + release with duty.
//
// Re-runnable: catalog/locations/opening-stock/sales are guarded by
// existence/onConflict, and the inherently-non-idempotent service flows
// (transfers + bond release use gapless sequence numbers and consume stock) run
// ONCE — guarded by a "does any transfer/bond receipt already exist?" check — so
// re-running adds nothing and never corrupts. All valued stock is written ONLY
// through the real services (appendStockMovement + applyValuation, createTransfer
// /shipTransfer/receiveTransfer, createBondReceipt/executeBondRelease); only
// sale/tender/invoice DOCUMENT rows are inserted directly (never ledger/valuation).

interface DemoProductSpec {
  brandCode: string;
  categoryCode: string;
  // fifo + lot-tracked (a couple of perishables); the rest resolve to the
  // tenant AVCO default with no tracking.
  fifo?: boolean;
  // Stock into the two stores (so it can be sold). All products are stocked in
  // the warehouse regardless (so transfers have something to move).
  inStores?: boolean;
  name: string;
  priceMinor: number;
  sku: string;
}

const DEMO_CATEGORIES = [
  { code: "GROCERY", name: "Grocery" },
  { code: "BEVERAGE", name: "Beverages" },
  { code: "ELECTRONICS", name: "Electronics" },
  { code: "HOUSEHOLD", name: "Household" },
  { code: "SNACK", name: "Snacks" },
] as const;

const DEMO_BRANDS = [
  { code: "DEMO_HOUSE", name: "Demo House" },
  { code: "DEMO_PREMIUM", name: "Demo Premium" },
] as const;

const DEMO_PRODUCTS: DemoProductSpec[] = [
  // Grocery
  {
    sku: "DM-RICE-5KG",
    name: "Long Grain Rice 5kg",
    categoryCode: "GROCERY",
    brandCode: "DEMO_HOUSE",
    priceMinor: 1299,
    inStores: true,
  },
  {
    sku: "DM-FLOUR-2KG",
    name: "All-Purpose Flour 2kg",
    categoryCode: "GROCERY",
    brandCode: "DEMO_HOUSE",
    priceMinor: 549,
    inStores: true,
  },
  {
    sku: "DM-SUGAR-1KG",
    name: "White Sugar 1kg",
    categoryCode: "GROCERY",
    brandCode: "DEMO_HOUSE",
    priceMinor: 399,
    inStores: true,
  },
  {
    sku: "DM-OIL-1L",
    name: "Cooking Oil 1L",
    categoryCode: "GROCERY",
    brandCode: "DEMO_HOUSE",
    priceMinor: 799,
    inStores: true,
  },
  {
    sku: "DM-MILK-1L",
    name: "Fresh Milk 1L",
    categoryCode: "GROCERY",
    brandCode: "DEMO_PREMIUM",
    priceMinor: 459,
    fifo: true,
    inStores: true,
  },
  {
    sku: "DM-YOGURT-500G",
    name: "Greek Yogurt 500g",
    categoryCode: "GROCERY",
    brandCode: "DEMO_PREMIUM",
    priceMinor: 689,
    fifo: true,
    inStores: true,
  },
  // Beverages
  {
    sku: "DM-COLA-2L",
    name: "Cola 2L",
    categoryCode: "BEVERAGE",
    brandCode: "DEMO_HOUSE",
    priceMinor: 299,
    inStores: true,
  },
  {
    sku: "DM-WATER-6PK",
    name: "Spring Water 6-Pack",
    categoryCode: "BEVERAGE",
    brandCode: "DEMO_HOUSE",
    priceMinor: 549,
    inStores: true,
  },
  {
    sku: "DM-JUICE-1L",
    name: "Orange Juice 1L",
    categoryCode: "BEVERAGE",
    brandCode: "DEMO_PREMIUM",
    priceMinor: 629,
    inStores: true,
  },
  {
    sku: "DM-COFFEE-250G",
    name: "Ground Coffee 250g",
    categoryCode: "BEVERAGE",
    brandCode: "DEMO_PREMIUM",
    priceMinor: 1199,
    inStores: true,
  },
  {
    sku: "DM-TEA-100CT",
    name: "Black Tea 100ct",
    categoryCode: "BEVERAGE",
    brandCode: "DEMO_HOUSE",
    priceMinor: 499,
    inStores: true,
  },
  // Electronics
  {
    sku: "DM-AA-BATT-8PK",
    name: "AA Batteries 8-Pack",
    categoryCode: "ELECTRONICS",
    brandCode: "DEMO_HOUSE",
    priceMinor: 899,
    inStores: true,
  },
  {
    sku: "DM-USBC-CABLE",
    name: "USB-C Cable 1m",
    categoryCode: "ELECTRONICS",
    brandCode: "DEMO_PREMIUM",
    priceMinor: 1499,
    inStores: true,
  },
  {
    sku: "DM-EARBUDS",
    name: "Wireless Earbuds",
    categoryCode: "ELECTRONICS",
    brandCode: "DEMO_PREMIUM",
    priceMinor: 4999,
    inStores: true,
  },
  {
    sku: "DM-PWRBANK-10K",
    name: "Power Bank 10000mAh",
    categoryCode: "ELECTRONICS",
    brandCode: "DEMO_PREMIUM",
    priceMinor: 3499,
  },
  {
    sku: "DM-LED-BULB",
    name: "LED Bulb 9W",
    categoryCode: "ELECTRONICS",
    brandCode: "DEMO_HOUSE",
    priceMinor: 399,
    inStores: true,
  },
  // Household
  {
    sku: "DM-DISH-SOAP",
    name: "Dish Soap 750ml",
    categoryCode: "HOUSEHOLD",
    brandCode: "DEMO_HOUSE",
    priceMinor: 349,
    inStores: true,
  },
  {
    sku: "DM-PAPER-TOWEL",
    name: "Paper Towels 6-Roll",
    categoryCode: "HOUSEHOLD",
    brandCode: "DEMO_HOUSE",
    priceMinor: 799,
    inStores: true,
  },
  {
    sku: "DM-TRASH-BAGS",
    name: "Trash Bags 50ct",
    categoryCode: "HOUSEHOLD",
    brandCode: "DEMO_HOUSE",
    priceMinor: 649,
    inStores: true,
  },
  {
    sku: "DM-LAUNDRY-2L",
    name: "Laundry Detergent 2L",
    categoryCode: "HOUSEHOLD",
    brandCode: "DEMO_PREMIUM",
    priceMinor: 1099,
  },
  // Snacks
  {
    sku: "DM-CHIPS-200G",
    name: "Potato Chips 200g",
    categoryCode: "SNACK",
    brandCode: "DEMO_HOUSE",
    priceMinor: 449,
    inStores: true,
  },
  {
    sku: "DM-CHOC-BAR",
    name: "Chocolate Bar 100g",
    categoryCode: "SNACK",
    brandCode: "DEMO_PREMIUM",
    priceMinor: 299,
    inStores: true,
  },
  {
    sku: "DM-COOKIES-300G",
    name: "Cookies 300g",
    categoryCode: "SNACK",
    brandCode: "DEMO_HOUSE",
    priceMinor: 379,
    inStores: true,
  },
  {
    sku: "DM-NUTS-250G",
    name: "Mixed Nuts 250g",
    categoryCode: "SNACK",
    brandCode: "DEMO_PREMIUM",
    priceMinor: 899,
    inStores: true,
  },
];

interface SeededDemoSku {
  inStores: boolean;
  name: string;
  priceMinor: number;
  productId: string;
  sku: string;
  skuId: string;
}

export interface DemoSeedResult {
  bondedLocationId: string;
  bondReceiptId: string | null;
  companyId: string;
  mainStoreId: string;
  secondStoreId: string;
  tenant: ProvisionedTenant;
  transferIds: string[];
  warehouseId: string;
}

type SeedTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

interface DemoCtx {
  actorUserId: string;
  tenantId: string;
}

interface DemoLocationIds {
  bondedId: string;
  mainStoreId: string;
  secondStoreId: string;
  warehouseId: string;
}

async function ensureDemoCompany(tx: SeedTx, tenant: ProvisionedTenant) {
  const inserted = (
    await tx
      .insert(company)
      .values({
        tenantId: tenant.tenantId,
        name: "RetailOS Demo Co",
        createdBy: tenant.adminUserId,
      })
      .onConflictDoNothing()
      .returning()
  ).at(0);
  if (inserted) {
    return inserted;
  }
  return required(
    (
      await tx
        .select()
        .from(company)
        .where(
          and(
            eq(company.tenantId, tenant.tenantId),
            eq(company.name, "RetailOS Demo Co")
          )
        )
        .limit(1)
    ).at(0),
    "demo company"
  );
}

async function ensureDemoLocation(
  tx: SeedTx,
  tenant: ProvisionedTenant,
  companyId: string,
  vals: {
    name: string;
    type: (typeof LOCATION_TYPES)[number];
    isSellable?: boolean;
    isBonded?: boolean;
  }
) {
  const existing = (
    await tx
      .select()
      .from(location)
      .where(
        and(
          eq(location.tenantId, tenant.tenantId),
          eq(location.name, vals.name)
        )
      )
      .limit(1)
  ).at(0);
  if (existing) {
    return existing;
  }
  return required(
    (
      await tx
        .insert(location)
        .values({
          tenantId: tenant.tenantId,
          companyId,
          createdBy: tenant.adminUserId,
          ...vals,
        })
        .returning()
    ).at(0),
    `demo location ${vals.name}`
  );
}

async function ensureDemoLocations(
  tx: SeedTx,
  tenant: ProvisionedTenant,
  companyId: string
): Promise<DemoLocationIds> {
  const mainStore = await ensureDemoLocation(tx, tenant, companyId, {
    name: "Demo Main Store",
    type: "store",
    isSellable: true,
  });
  const secondStore = await ensureDemoLocation(tx, tenant, companyId, {
    name: "Demo City Store",
    type: "store",
    isSellable: true,
  });
  const warehouse = await ensureDemoLocation(tx, tenant, companyId, {
    name: "Demo Central Warehouse",
    type: "warehouse",
    isSellable: false,
  });
  const bonded = await ensureDemoLocation(tx, tenant, companyId, {
    name: "Demo Bonded Warehouse",
    type: "bonded",
    isBonded: true,
    isSellable: false,
  });
  return {
    bondedId: bonded.id,
    mainStoreId: mainStore.id,
    secondStoreId: secondStore.id,
    warehouseId: warehouse.id,
  };
}

async function ensureDemoEachUom(tx: SeedTx, tenant: ProvisionedTenant) {
  return required(
    (
      await tx
        .insert(unitOfMeasure)
        .values({
          tenantId: tenant.tenantId,
          code: "EA",
          name: "Each",
          kind: "count",
          decimalScale: 0,
          createdBy: tenant.adminUserId,
        })
        .onConflictDoUpdate({
          target: [unitOfMeasure.tenantId, unitOfMeasure.code],
          set: { name: "Each", kind: "count", decimalScale: 0 },
        })
        .returning()
    ).at(0),
    "EA unit"
  );
}

async function seedDemoTaxonomy(tx: SeedTx, tenant: ProvisionedTenant) {
  const categoryByCode = new Map<string, string>();
  for (const c of DEMO_CATEGORIES) {
    const row = required(
      (
        await tx
          .insert(category)
          .values({
            tenantId: tenant.tenantId,
            name: c.name,
            code: c.code,
            trackingMode: "none",
            createdBy: tenant.adminUserId,
          })
          .onConflictDoUpdate({
            target: [category.tenantId, category.code],
            set: { name: c.name },
          })
          .returning()
      ).at(0),
      `category ${c.code}`
    );
    categoryByCode.set(c.code, row.id);
  }
  const brandByCode = new Map<string, string>();
  for (const b of DEMO_BRANDS) {
    const row = required(
      (
        await tx
          .insert(brand)
          .values({
            tenantId: tenant.tenantId,
            name: b.name,
            code: b.code,
            createdBy: tenant.adminUserId,
          })
          .onConflictDoUpdate({
            target: [brand.tenantId, brand.code],
            set: { name: b.name },
          })
          .returning()
      ).at(0),
      `brand ${b.code}`
    );
    brandByCode.set(b.code, row.id);
  }
  return { brandByCode, categoryByCode };
}

async function upsertDemoProductSku(
  tx: SeedTx,
  tenant: ProvisionedTenant,
  spec: DemoProductSpec,
  refs: {
    eachUomId: string;
    categoryId?: string;
    brandId?: string;
    barcodeSeq: number;
  }
): Promise<SeededDemoSku> {
  const trackingMode = spec.fifo ? "lot" : "none";
  const costingMethod = spec.fifo ? ("fifo" as const) : null;
  const p = required(
    (
      await tx
        .insert(product)
        .values({
          tenantId: tenant.tenantId,
          sku: spec.sku,
          name: spec.name,
          categoryId: refs.categoryId,
          brandId: refs.brandId,
          baseUomId: refs.eachUomId,
          costingMethod,
          trackingMode,
          priceMinor: spec.priceMinor,
          currency: "USD",
          scale: 2,
          createdBy: tenant.adminUserId,
        })
        .onConflictDoUpdate({
          target: [product.tenantId, product.sku],
          set: {
            name: spec.name,
            categoryId: refs.categoryId,
            brandId: refs.brandId,
            baseUomId: refs.eachUomId,
            costingMethod,
            trackingMode,
            priceMinor: spec.priceMinor,
          },
        })
        .returning()
    ).at(0),
    `product ${spec.sku}`
  );
  const s = required(
    (
      await tx
        .insert(sku)
        .values({
          tenantId: tenant.tenantId,
          productId: p.id,
          code: `${spec.sku}-EA`,
          name: spec.name,
          baseUomId: refs.eachUomId,
          trackingMode,
          createdBy: tenant.adminUserId,
        })
        .onConflictDoUpdate({
          target: [sku.tenantId, sku.code],
          set: {
            productId: p.id,
            name: spec.name,
            baseUomId: refs.eachUomId,
            trackingMode,
            isActive: true,
          },
        })
        .returning()
    ).at(0),
    `sku ${spec.sku}`
  );
  await tx
    .insert(barcode)
    .values({
      tenantId: tenant.tenantId,
      skuId: s.id,
      value: `220${tenant.tenantId.slice(0, 4)}${String(refs.barcodeSeq).padStart(5, "0")}`,
      symbology: "ean13",
      isPrimary: true,
      createdBy: tenant.adminUserId,
    })
    .onConflictDoNothing();
  return {
    productId: p.id,
    skuId: s.id,
    sku: spec.sku,
    name: spec.name,
    priceMinor: spec.priceMinor,
    inStores: Boolean(spec.inStores),
  };
}

async function seedDemoCatalog(
  tx: SeedTx,
  tenant: ProvisionedTenant,
  eachUomId: string,
  categoryByCode: Map<string, string>,
  brandByCode: Map<string, string>
): Promise<SeededDemoSku[]> {
  const seeded: SeededDemoSku[] = [];
  let barcodeSeq = 1;
  for (const spec of DEMO_PRODUCTS) {
    seeded.push(
      await upsertDemoProductSku(tx, tenant, spec, {
        eachUomId,
        categoryId: categoryByCode.get(spec.categoryCode),
        brandId: brandByCode.get(spec.brandCode),
        barcodeSeq,
      })
    );
    barcodeSeq += 1;
  }
  return seeded;
}

async function seedDemoLots(
  tx: SeedTx,
  tenant: ProvisionedTenant,
  seeded: SeededDemoSku[]
): Promise<Map<string, string>> {
  const lotBySku = new Map<string, string>();
  for (const spec of DEMO_PRODUCTS) {
    if (!spec.fifo) {
      continue;
    }
    const s = required(
      seeded.find((row) => row.sku === spec.sku),
      `seeded fifo sku ${spec.sku}`
    );
    const lotNumber = `${spec.sku}-LOT-01`;
    const inserted = (
      await tx
        .insert(lot)
        .values({
          tenantId: tenant.tenantId,
          skuId: s.skuId,
          lotNumber,
          expiryDate: "2027-12-31",
          status: "available",
          createdBy: tenant.adminUserId,
        })
        .onConflictDoNothing()
        .returning()
    ).at(0);
    const lotRow =
      inserted ??
      required(
        (
          await tx
            .select()
            .from(lot)
            .where(
              and(
                eq(lot.tenantId, tenant.tenantId),
                eq(lot.skuId, s.skuId),
                eq(lot.lotNumber, lotNumber)
              )
            )
            .limit(1)
        ).at(0),
        `lot ${spec.sku}`
      );
    lotBySku.set(s.skuId, lotRow.id);
  }
  return lotBySku;
}

async function receiveDemoStock(
  tx: SeedTx,
  ctx: DemoCtx,
  tenant: ProvisionedTenant,
  lotId: string | null,
  input: {
    row: SeededDemoSku;
    locationId: string;
    qty: number;
    cost: number;
    key: string;
  }
) {
  const { created, movement } = await appendSeedMovement(tx, tenant, {
    locationId: input.locationId,
    productId: input.row.productId,
    skuId: input.row.skuId,
    lotId,
    movementType: "receipt",
    qtyDelta: input.qty,
    unitCostMinor: input.cost,
    costCurrency: "USD",
    costScale: 2,
    refType: "seed-opening",
    idempotencyKey: input.key,
  });
  if (created) {
    await applyValuation(tx, ctx, movement);
  }
}

// Opening stock — valued RECEIPT movements through the services (AVCO/FIFO cells
// populate). All products into the warehouse; the in-store subset into both
// stores too, so they can be sold. (The StockMovementType has no separate
// "opening_balance"; a valued receipt is the opening-entry path.)
async function seedDemoOpeningStock(
  tx: SeedTx,
  ctx: DemoCtx,
  tenant: ProvisionedTenant,
  seeded: SeededDemoSku[],
  lotBySku: Map<string, string>,
  loc: DemoLocationIds
) {
  for (const [i, row] of seeded.entries()) {
    // Cost ≈ 60% of retail price (a realistic margin), min 50.
    const cost = Math.max(50, Math.round(row.priceMinor * 0.6));
    const lotId = lotBySku.get(row.skuId) ?? null;
    const base = `demo:${tenant.tenantId}`;
    await receiveDemoStock(tx, ctx, tenant, lotId, {
      row,
      locationId: loc.warehouseId,
      qty: 200,
      cost,
      key: `${base}:wh:${row.sku}`,
    });
    if (row.inStores) {
      await receiveDemoStock(tx, ctx, tenant, lotId, {
        row,
        locationId: loc.mainStoreId,
        qty: 40,
        cost,
        key: `${base}:main:${row.sku}`,
      });
      await receiveDemoStock(tx, ctx, tenant, lotId, {
        row,
        locationId: loc.secondStoreId,
        qty: 30,
        cost,
        key: `${base}:city:${row.sku}`,
      });
    }
    // Reorder rule on a few SKUs so the low-stock dashboard has signal.
    if (i % 5 === 0) {
      await tx
        .insert(reorderRule)
        .values({
          tenantId: tenant.tenantId,
          skuId: row.skuId,
          locationId: loc.mainStoreId,
          minQty: 50,
          maxQty: 150,
          createdBy: tenant.adminUserId,
        })
        .onConflictDoNothing();
    }
  }
}

// Completed POS sale — document rows (sale/sale_line/tender/invoice) inserted
// directly; the stock deduction + COGS go through appendStockMovement +
// applyValuation. Idempotent by the sale idempotency key.
async function createDemoSale(
  tx: SeedTx,
  ctx: DemoCtx,
  tenant: ProvisionedTenant,
  lotBySku: Map<string, string>,
  input: {
    key: string;
    number: string;
    locationId: string;
    daysAgo: number;
    lines: { row: SeededDemoSku; qty: number }[];
  }
) {
  const existing = (
    await tx
      .select({ id: sale.id })
      .from(sale)
      .where(
        and(
          eq(sale.tenantId, tenant.tenantId),
          eq(sale.idempotencyKey, input.key)
        )
      )
      .limit(1)
  ).at(0);
  if (existing) {
    return;
  }
  const createdAt = new Date(Date.now() - input.daysAgo * 24 * 60 * 60 * 1000);
  const subtotal = input.lines.reduce(
    (sum, l) => sum + l.row.priceMinor * l.qty,
    0
  );
  const saleRow = required(
    (
      await tx
        .insert(sale)
        .values({
          tenantId: tenant.tenantId,
          locationId: input.locationId,
          number: input.number,
          saleType: "sale",
          subtotalMinor: subtotal,
          discountMinor: 0,
          taxMinor: 0,
          totalMinor: subtotal,
          currency: "USD",
          scale: 2,
          status: "completed",
          idempotencyKey: input.key,
          createdBy: tenant.adminUserId,
          createdAt,
        })
        .returning()
    ).at(0),
    `demo sale ${input.number}`
  );
  for (const [li, l] of input.lines.entries()) {
    const lotId = lotBySku.get(l.row.skuId) ?? null;
    const { created, movement } = await appendSeedMovement(tx, tenant, {
      locationId: input.locationId,
      productId: l.row.productId,
      skuId: l.row.skuId,
      lotId,
      movementType: "sale",
      qtyDelta: -l.qty,
      refType: "sale",
      refId: saleRow.id,
      idempotencyKey: `${input.key}:line:${li}`,
    });
    const valuation = created ? await applyValuation(tx, ctx, movement) : null;
    await tx.insert(saleLine).values({
      tenantId: tenant.tenantId,
      saleId: saleRow.id,
      productId: l.row.productId,
      skuId: l.row.skuId,
      lotId,
      qty: l.qty,
      qtyBase: l.qty,
      unitPriceMinor: l.row.priceMinor,
      cogsMinor: valuation?.cogsMinor ?? null,
      cogsCurrency: valuation?.currency ?? null,
      cogsScale: valuation?.scale ?? null,
      costingMethodApplied: valuation?.method ?? null,
    });
  }
  await tx.insert(tender).values({
    tenantId: tenant.tenantId,
    saleId: saleRow.id,
    method: "cash",
    currency: "USD",
    scale: 2,
    amountMinor: subtotal,
    changeMinor: 0,
    settledAmountMinor: subtotal,
    createdBy: tenant.adminUserId,
  });
  await tx.insert(invoice).values({
    tenantId: tenant.tenantId,
    saleId: saleRow.id,
    number: `${input.number}-INV`,
    totalMinor: subtotal,
    currency: "USD",
    scale: 2,
  });
}

async function seedDemoSales(
  tx: SeedTx,
  ctx: DemoCtx,
  tenant: ProvisionedTenant,
  seeded: SeededDemoSku[],
  lotBySku: Map<string, string>,
  loc: DemoLocationIds
) {
  const storeStocked = seeded.filter((row) => row.inStores);
  if (storeStocked.length === 0) {
    return;
  }
  const pick = (offset: number, count: number) =>
    Array.from({ length: count }, (_, k) =>
      required(
        storeStocked[(offset + k) % storeStocked.length],
        "store-stocked sku"
      )
    );
  const demoSales = [
    {
      store: loc.mainStoreId,
      prefix: "DEMO-M",
      daysAgo: 12,
      picks: pick(0, 2),
    },
    { store: loc.mainStoreId, prefix: "DEMO-M", daysAgo: 9, picks: pick(3, 3) },
    { store: loc.mainStoreId, prefix: "DEMO-M", daysAgo: 5, picks: pick(7, 2) },
    {
      store: loc.mainStoreId,
      prefix: "DEMO-M",
      daysAgo: 2,
      picks: pick(10, 3),
    },
    {
      store: loc.secondStoreId,
      prefix: "DEMO-C",
      daysAgo: 11,
      picks: pick(1, 2),
    },
    {
      store: loc.secondStoreId,
      prefix: "DEMO-C",
      daysAgo: 7,
      picks: pick(5, 2),
    },
    {
      store: loc.secondStoreId,
      prefix: "DEMO-C",
      daysAgo: 4,
      picks: pick(8, 3),
    },
    {
      store: loc.secondStoreId,
      prefix: "DEMO-C",
      daysAgo: 1,
      picks: pick(12, 2),
    },
  ];
  for (const [si, s] of demoSales.entries()) {
    const number = `${s.prefix}-${String(si + 1).padStart(4, "0")}`;
    await createDemoSale(tx, ctx, tenant, lotBySku, {
      key: `demo:${tenant.tenantId}:sale:${number}`,
      number,
      locationId: s.store,
      daysAgo: s.daysAgo,
      lines: s.picks.map((row, idx) => ({ row, qty: (idx % 3) + 1 })),
    });
  }
}

// Inter-store transfers (warehouse → each store) — run ONCE (gapless numbers +
// stock consumption are not safely re-runnable). Guarded by "any transfer
// already exists?".
async function seedDemoTransfers(
  tx: SeedTx,
  ctx: DemoCtx,
  tenant: ProvisionedTenant,
  seeded: SeededDemoSku[],
  loc: DemoLocationIds
): Promise<string[]> {
  const anyTransfer = (
    await tx
      .select({ id: stockTransfer.id })
      .from(stockTransfer)
      .where(eq(stockTransfer.tenantId, tenant.tenantId))
      .limit(1)
  ).at(0);
  if (anyTransfer) {
    return [];
  }
  const widget = required(seeded.at(0), "transfer product 1");
  const gadget = required(seeded.at(1), "transfer product 2");
  const toMain = await createTransfer(tx, ctx, {
    sourceLocationId: loc.warehouseId,
    destLocationId: loc.mainStoreId,
    lines: [{ productId: widget.productId, skuId: widget.skuId, qty: 20 }],
  });
  await shipTransfer(tx, ctx, toMain.transfer.id);
  await receiveTransfer(tx, ctx, toMain.transfer.id);

  const toCity = await createTransfer(tx, ctx, {
    sourceLocationId: loc.warehouseId,
    destLocationId: loc.secondStoreId,
    lines: [{ productId: gadget.productId, skuId: gadget.skuId, qty: 15 }],
  });
  await shipTransfer(tx, ctx, toCity.transfer.id);
  await receiveTransfer(tx, ctx, toCity.transfer.id);
  return [toMain.transfer.id, toCity.transfer.id];
}

// Bonded receipt + release with duty — run ONCE (gapless numbers + stock
// consumption). Guarded by "any bonded movement already exists?".
async function seedDemoBond(
  tx: SeedTx,
  ctx: DemoCtx,
  tenant: ProvisionedTenant,
  seeded: SeededDemoSku[],
  companyId: string,
  loc: DemoLocationIds
): Promise<string | null> {
  const anyBond = (
    await tx
      .select({ id: stockLedger.id })
      .from(stockLedger)
      .where(
        and(
          eq(stockLedger.tenantId, tenant.tenantId),
          eq(stockLedger.locationId, loc.bondedId)
        )
      )
      .limit(1)
  ).at(0);
  if (anyBond) {
    return null;
  }
  const bondProduct = required(seeded.at(2), "bond product");
  const { receipt, lines } = await createBondReceipt(tx, ctx, {
    companyId,
    locationId: loc.bondedId,
    supplierRef: "DEMO-IMP-001",
    customsReference: "DEMO-CUST-001",
    lines: [
      {
        productId: bondProduct.productId,
        skuId: bondProduct.skuId,
        qty: 60,
        unitCostMinor: 1500,
        costCurrency: "USD",
        costScale: 2,
      },
    ],
  });
  await executeBondRelease(tx, ctx, {
    bondReceiptId: receipt.id,
    destLocationId: loc.mainStoreId,
    lines: [
      {
        bondReceiptLineId: required(lines[0], "bond receipt line").id,
        qty: 30,
        dutyMinor: 2250,
        taxMinor: 750,
      },
    ],
  });
  return receipt.id;
}

export async function seedDemo(deps: SeedDeps): Promise<DemoSeedResult> {
  const tenant = await deps.provisionTenant({
    name: "RetailOS Demo Co",
    adminEmail: "demo@example.com",
  });
  const ctx: DemoCtx = {
    actorUserId: tenant.adminUserId,
    tenantId: tenant.tenantId,
  };

  // Bonded stock is AVCO-only; set the tenant default so non-FIFO SKUs resolve
  // to AVCO (and the bonded receipt's SKU resolves to AVCO).
  await deps.database
    .update(organization)
    .set({ costingMethod: "avco" })
    .where(eq(organization.id, tenant.tenantId));

  return await withTenant(deps.database, tenant.tenantId, async (tx) => {
    const co = await ensureDemoCompany(tx, tenant);
    const loc = await ensureDemoLocations(tx, tenant, co.id);
    const eachUom = await ensureDemoEachUom(tx, tenant);
    const { categoryByCode, brandByCode } = await seedDemoTaxonomy(tx, tenant);
    const seeded = await seedDemoCatalog(
      tx,
      tenant,
      eachUom.id,
      categoryByCode,
      brandByCode
    );
    const lotBySku = await seedDemoLots(tx, tenant, seeded);
    await seedDemoOpeningStock(tx, ctx, tenant, seeded, lotBySku, loc);
    await seedDemoSales(tx, ctx, tenant, seeded, lotBySku, loc);
    const transferIds = await seedDemoTransfers(tx, ctx, tenant, seeded, loc);
    const bondReceiptId = await seedDemoBond(
      tx,
      ctx,
      tenant,
      seeded,
      co.id,
      loc
    );

    return {
      bondReceiptId,
      bondedLocationId: loc.bondedId,
      companyId: co.id,
      mainStoreId: loc.mainStoreId,
      secondStoreId: loc.secondStoreId,
      tenant,
      transferIds,
      warehouseId: loc.warehouseId,
    };
  });
}
