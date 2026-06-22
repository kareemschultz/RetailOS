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
  location,
  lot,
  organization,
  product,
  reorderRule,
  serial,
  sku,
  stockCount,
  stockCountLine,
  stockLedger,
  unitOfMeasure,
  uomConversion,
  variant,
} from "../schema";
import { appendStockMovement, applyValuation } from "../services";
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
  type: string
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
    locationType: string;
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
