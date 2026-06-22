import { auth } from "@RetailOS/auth";
import type { TenantTransaction } from "@RetailOS/db";
import { db, schema, services, withTenant } from "@RetailOS/db";
import { ORPCError } from "@orpc/server";
import {
  and,
  count,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  type SQL,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, tenantProcedure } from "../index";
import type { RequestContext } from "../request-context";

// Enforce a VS#1 permission for the caller's tenant role (charter §7), fail-closed.
async function assertPermission(
  tx: TenantTransaction,
  ctx: RequestContext,
  permission: string
): Promise<void> {
  const role = await services.resolveTenantRole(tx, ctx.actorUserId);
  if (!services.roleHasPermission(role, permission)) {
    throw new ORPCError("FORBIDDEN", {
      message: `Missing permission: ${permission}`,
    });
  }
}

function firstOrThrow<T>(row: T | undefined): T {
  if (!row) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Expected a row to be returned",
    });
  }
  return row;
}

type ProductRow = typeof schema.product.$inferSelect;
interface SaleLineInput {
  productId: string;
  qty: number;
}

// Prices each line off its product (exact integer money) and sums the grand
// total. All lines must share a currency/scale (addMoney enforces it).
function priceSaleLines(products: ProductRow[], lines: SaleLineInput[]) {
  const byId = new Map(products.map((p) => [p.id, p]));
  let total: ReturnType<typeof services.money> | null = null;
  const lineValues: {
    productId: string;
    qty: number;
    unitPriceMinor: number;
  }[] = [];
  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product) {
      throw new ORPCError("NOT_FOUND", {
        message: `Product ${line.productId} not found in this tenant`,
      });
    }
    const unit = services.money(
      product.priceMinor,
      product.currency,
      product.scale
    );
    const lineTotal = services.multiplyMoney(unit, line.qty);
    total = total ? services.addMoney(total, lineTotal) : lineTotal;
    lineValues.push({
      productId: product.id,
      qty: line.qty,
      unitPriceMinor: unit.minor,
    });
  }
  if (!total) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Sale must have at least one line",
    });
  }
  return { total, lineValues };
}

interface CatalogImportPreviewRow {
  baseUomCode?: string;
  lotNumber?: string;
  productSku: string;
  rowNumber: number;
  skuCode?: string;
  unitCostMinor?: number;
}

interface CatalogImportPreviewState {
  existingProductSkus: Set<string>;
  existingSkuCodes: Set<string>;
  existingUomCodes: Set<string>;
  seenProductSkus: Set<string>;
  seenSkuCodes: Set<string>;
}

function catalogImportPreviewRow(
  row: CatalogImportPreviewRow,
  state: CatalogImportPreviewState
) {
  const errors = [
    state.seenProductSkus.has(row.productSku)
      ? "duplicate productSku in import file"
      : null,
    state.existingProductSkus.has(row.productSku)
      ? "productSku already exists"
      : null,
    row.skuCode && state.seenSkuCodes.has(row.skuCode)
      ? "duplicate skuCode in import file"
      : null,
    row.skuCode && state.existingSkuCodes.has(row.skuCode)
      ? "skuCode already exists"
      : null,
    row.baseUomCode && !state.existingUomCodes.has(row.baseUomCode)
      ? "baseUomCode not found in this tenant"
      : null,
    row.lotNumber && !row.skuCode ? "lotNumber requires skuCode" : null,
    row.unitCostMinor != null && !row.skuCode
      ? "unitCostMinor requires skuCode"
      : null,
  ].filter((error): error is string => Boolean(error));
  state.seenProductSkus.add(row.productSku);
  if (row.skuCode) {
    state.seenSkuCodes.add(row.skuCode);
  }
  return {
    rowNumber: row.rowNumber,
    productSku: row.productSku,
    skuCode: row.skuCode ?? null,
    status: errors.length ? "error" : "valid",
    errors,
  };
}

export const tenantRouter = {
  // Sets the active organization (tenant) on the session via Better Auth. Not a
  // tenantProcedure — it runs before a tenant is active.
  setActive: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      await auth.api.setActiveOrganization({
        headers: context.headers,
        body: { organizationId: input.organizationId },
      });
      return { activeOrganizationId: input.organizationId };
    }),
};

export const companyRouter = {
  create: tenantProcedure
    .input(z.object({ name: z.string().min(1) }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "company.create");
        const row = firstOrThrow(
          (
            await tx
              .insert(schema.company)
              .values({
                tenantId: ctx.tenantId,
                name: input.name,
                createdBy: ctx.actorUserId,
              })
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "company.create",
          entityType: "company",
          entityId: row.id,
          after: row,
        });
        return row;
      });
    }),
};

export const locationRouter = {
  create: tenantProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        name: z.string().min(1),
        type: z
          .enum([
            "store",
            "warehouse",
            "bonded",
            "distribution_center",
            "fulfillment_center",
          ])
          .default("store"),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "location.create");
        // FK checks bypass RLS, so an attacker could reference another tenant's
        // company. Validate referenced ids with an RLS-scoped read first.
        const companyExists = (
          await tx
            .select({ id: schema.company.id })
            .from(schema.company)
            .where(eq(schema.company.id, input.companyId))
            .limit(1)
        ).at(0);
        if (!companyExists) {
          throw new ORPCError("NOT_FOUND", {
            message: "Company not found in this tenant",
          });
        }
        const row = firstOrThrow(
          (
            await tx
              .insert(schema.location)
              .values({
                tenantId: ctx.tenantId,
                companyId: input.companyId,
                name: input.name,
                type: input.type,
                createdBy: ctx.actorUserId,
              })
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "location.create",
          entityType: "location",
          entityId: row.id,
          after: row,
        });
        return row;
      });
    }),
};

export const productRouter = {
  list: tenantProcedure
    .input(
      z.object({
        brandId: z.string().uuid().optional(),
        categoryId: z.string().uuid().optional(),
        includeArchived: z.boolean().default(false),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        if (input.categoryId) {
          await assertCategoryVisible(tx, input.categoryId);
        }
        if (input.brandId) {
          await assertBrandVisible(tx, input.brandId);
        }
        const conditions = [
          input.categoryId
            ? eq(schema.product.categoryId, input.categoryId)
            : null,
          input.brandId ? eq(schema.product.brandId, input.brandId) : null,
          input.includeArchived ? null : isNull(schema.product.deletedAt),
        ].filter((condition): condition is SQL => condition != null);
        return tx
          .select()
          .from(schema.product)
          .where(conditions.length ? and(...conditions) : undefined);
      });
    }),
  create: tenantProcedure
    .input(
      z.object({
        sku: z.string().min(1),
        name: z.string().min(1),
        categoryId: z.string().uuid().optional(),
        brandId: z.string().uuid().optional(),
        baseUomId: z.string().uuid().optional(),
        costingMethod: z.enum(["avco", "fifo"]).optional(),
        trackingMode: z.enum(["none", "lot", "serial"]).default("none"),
        priceMinor: z.number().int().min(0),
        currency: z.string().length(3),
        scale: z.number().int().min(0).default(2),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        if (input.categoryId) {
          await assertCategoryVisible(tx, input.categoryId);
        }
        if (input.brandId) {
          await assertBrandVisible(tx, input.brandId);
        }
        if (input.baseUomId) {
          await assertUomVisible(tx, input.baseUomId);
        }
        const m = services.money(input.priceMinor, input.currency, input.scale);
        const row = firstOrThrow(
          (
            await tx
              .insert(schema.product)
              .values({
                tenantId: ctx.tenantId,
                sku: input.sku,
                name: input.name,
                categoryId: input.categoryId ?? null,
                brandId: input.brandId ?? null,
                baseUomId: input.baseUomId ?? null,
                costingMethod: input.costingMethod ?? null,
                trackingMode: input.trackingMode,
                priceMinor: m.minor,
                currency: m.currency,
                scale: m.scale,
                createdBy: ctx.actorUserId,
              })
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "product.create",
          entityType: "product",
          entityId: row.id,
          after: row,
        });
        return row;
      });
    }),
  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        sku: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        categoryId: z.string().uuid().nullable().optional(),
        brandId: z.string().uuid().nullable().optional(),
        baseUomId: z.string().uuid().nullable().optional(),
        costingMethod: z.enum(["avco", "fifo"]).nullable().optional(),
        trackingMode: z.enum(["none", "lot", "serial"]).optional(),
        priceMinor: z.number().int().min(0).optional(),
        currency: z.string().length(3).optional(),
        scale: z.number().int().min(0).optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        await assertProductVisible(tx, input.id);
        if (input.categoryId) {
          await assertCategoryVisible(tx, input.categoryId);
        }
        if (input.brandId) {
          await assertBrandVisible(tx, input.brandId);
        }
        if (input.baseUomId) {
          await assertUomVisible(tx, input.baseUomId);
        }
        const before = firstOrThrow(
          (
            await tx
              .select()
              .from(schema.product)
              .where(eq(schema.product.id, input.id))
              .limit(1)
          ).at(0)
        );
        await assertCostingMethodSetOnce(tx, {
          currentMethod: before.costingMethod,
          nextMethod: input.costingMethod,
          productId: input.id,
        });
        const moneyFields: {
          currency?: string;
          minor?: number;
          scale?: number;
        } =
          input.priceMinor == null &&
          input.currency == null &&
          input.scale == null
            ? {}
            : services.money(
                input.priceMinor ?? before.priceMinor,
                input.currency ?? before.currency,
                input.scale ?? before.scale
              );
        const row = firstOrThrow(
          (
            await tx
              .update(schema.product)
              .set({
                sku: input.sku,
                name: input.name,
                categoryId: input.categoryId,
                brandId: input.brandId,
                baseUomId: input.baseUomId,
                costingMethod: input.costingMethod,
                trackingMode: input.trackingMode,
                priceMinor: moneyFields.minor,
                currency: moneyFields.currency,
                scale: moneyFields.scale,
                updatedBy: ctx.actorUserId,
              })
              .where(eq(schema.product.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "product.update",
          entityType: "product",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
  archive: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        await assertProductVisible(tx, input.id);
        const before = firstOrThrow(
          (
            await tx
              .select()
              .from(schema.product)
              .where(eq(schema.product.id, input.id))
              .limit(1)
          ).at(0)
        );
        const row = firstOrThrow(
          (
            await tx
              .update(schema.product)
              .set({ deletedAt: new Date(), updatedBy: ctx.actorUserId })
              .where(eq(schema.product.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "product.archive",
          entityType: "product",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
};

export const catalogRouter = {
  importPreview: tenantProcedure
    .input(
      z.object({
        rows: z
          .array(
            z.object({
              rowNumber: z.number().int().positive(),
              productSku: z.string().min(1),
              productName: z.string().min(1),
              priceMinor: z.number().int().min(0),
              currency: z.string().length(3),
              scale: z.number().int().min(0).default(2),
              skuCode: z.string().min(1).optional(),
              baseUomCode: z.string().min(1).optional(),
              costingMethod: z.enum(["avco", "fifo"]).optional(),
              trackingMode: z.enum(["none", "lot", "serial"]).default("none"),
              lotNumber: z.string().min(1).optional(),
              expiryDate: z.string().date().optional(),
              unitCostMinor: z.number().int().min(0).optional(),
            })
          )
          .min(1)
          .max(1000),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const seenProductSkus = new Set<string>();
        const seenSkuCodes = new Set<string>();
        const existingProducts = await tx
          .select({ sku: schema.product.sku })
          .from(schema.product)
          .where(
            inArray(
              schema.product.sku,
              input.rows.map((row) => row.productSku)
            )
          );
        const existingProductSkus = new Set(
          existingProducts.map((row) => row.sku)
        );
        const skuCodes = input.rows
          .map((row) => row.skuCode)
          .filter((code): code is string => Boolean(code));
        const existingSkus = skuCodes.length
          ? await tx
              .select({ code: schema.sku.code })
              .from(schema.sku)
              .where(inArray(schema.sku.code, skuCodes))
          : [];
        const existingSkuCodes = new Set(existingSkus.map((row) => row.code));
        const uomCodes = input.rows
          .map((row) => row.baseUomCode)
          .filter((code): code is string => Boolean(code));
        const uoms = uomCodes.length
          ? await tx
              .select({ code: schema.unitOfMeasure.code })
              .from(schema.unitOfMeasure)
              .where(inArray(schema.unitOfMeasure.code, uomCodes))
          : [];
        const existingUomCodes = new Set(uoms.map((row) => row.code));
        const rows = input.rows.map((row) =>
          catalogImportPreviewRow(row, {
            existingProductSkus,
            existingSkuCodes,
            existingUomCodes,
            seenProductSkus,
            seenSkuCodes,
          })
        );
        return {
          validCount: rows.filter((row) => row.status === "valid").length,
          errorCount: rows.filter((row) => row.status === "error").length,
          rows,
        };
      });
    }),
  categoryList: tenantProcedure
    .input(z.object({ includeArchived: z.boolean().default(false) }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        return tx
          .select()
          .from(schema.category)
          .where(
            input.includeArchived
              ? undefined
              : isNull(schema.category.deletedAt)
          );
      });
    }),
  categoryCreate: tenantProcedure
    .input(
      z.object({
        code: z.string().min(1).optional(),
        name: z.string().min(1),
        costingMethod: z.enum(["avco", "fifo"]).optional(),
        trackingMode: z.enum(["none", "lot", "serial"]).optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const row = firstOrThrow(
          (
            await tx
              .insert(schema.category)
              .values({
                tenantId: ctx.tenantId,
                code: input.code ?? null,
                name: input.name,
                costingMethod: input.costingMethod ?? null,
                trackingMode: input.trackingMode ?? null,
                createdBy: ctx.actorUserId,
              })
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "category.create",
          entityType: "category",
          entityId: row.id,
          after: row,
        });
        return row;
      });
    }),
  categoryUpdate: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        code: z.string().min(1).nullable().optional(),
        name: z.string().min(1).optional(),
        costingMethod: z.enum(["avco", "fifo"]).nullable().optional(),
        trackingMode: z.enum(["none", "lot", "serial"]).nullable().optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const before = await assertCategoryVisible(tx, input.id);
        const row = firstOrThrow(
          (
            await tx
              .update(schema.category)
              .set({
                code: input.code,
                name: input.name,
                costingMethod: input.costingMethod,
                trackingMode: input.trackingMode,
                updatedBy: ctx.actorUserId,
              })
              .where(eq(schema.category.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "category.update",
          entityType: "category",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
  categoryArchive: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const before = await assertCategoryVisible(tx, input.id);
        const row = firstOrThrow(
          (
            await tx
              .update(schema.category)
              .set({ deletedAt: new Date(), updatedBy: ctx.actorUserId })
              .where(eq(schema.category.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "category.archive",
          entityType: "category",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
  brandList: tenantProcedure
    .input(z.object({ includeArchived: z.boolean().default(false) }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        return tx
          .select()
          .from(schema.brand)
          .where(
            input.includeArchived ? undefined : isNull(schema.brand.deletedAt)
          );
      });
    }),
  brandCreate: tenantProcedure
    .input(
      z.object({ code: z.string().min(1).optional(), name: z.string().min(1) })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const row = firstOrThrow(
          (
            await tx
              .insert(schema.brand)
              .values({
                tenantId: ctx.tenantId,
                code: input.code ?? null,
                name: input.name,
                createdBy: ctx.actorUserId,
              })
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "brand.create",
          entityType: "brand",
          entityId: row.id,
          after: row,
        });
        return row;
      });
    }),
  brandUpdate: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        code: z.string().min(1).nullable().optional(),
        name: z.string().min(1).optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const before = await assertBrandVisible(tx, input.id);
        const row = firstOrThrow(
          (
            await tx
              .update(schema.brand)
              .set({
                code: input.code,
                name: input.name,
                updatedBy: ctx.actorUserId,
              })
              .where(eq(schema.brand.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "brand.update",
          entityType: "brand",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
  brandArchive: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const before = await assertBrandVisible(tx, input.id);
        const row = firstOrThrow(
          (
            await tx
              .update(schema.brand)
              .set({ deletedAt: new Date(), updatedBy: ctx.actorUserId })
              .where(eq(schema.brand.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "brand.archive",
          entityType: "brand",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
  uomList: tenantProcedure
    .input(z.object({ includeArchived: z.boolean().default(false) }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        return tx
          .select()
          .from(schema.unitOfMeasure)
          .where(
            input.includeArchived
              ? undefined
              : isNull(schema.unitOfMeasure.deletedAt)
          );
      });
    }),
  uomCreate: tenantProcedure
    .input(
      z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        kind: z.enum(["count", "weight", "volume", "length"]).default("count"),
        decimalScale: z.number().int().min(0).default(0),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const row = firstOrThrow(
          (
            await tx
              .insert(schema.unitOfMeasure)
              .values({
                tenantId: ctx.tenantId,
                code: input.code,
                name: input.name,
                kind: input.kind,
                decimalScale: input.decimalScale,
                createdBy: ctx.actorUserId,
              })
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "uom.create",
          entityType: "unit_of_measure",
          entityId: row.id,
          after: row,
        });
        return row;
      });
    }),
  uomUpdate: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        code: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        kind: z.enum(["count", "weight", "volume", "length"]).optional(),
        decimalScale: z.number().int().min(0).optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const before = await assertUomVisible(tx, input.id);
        const row = firstOrThrow(
          (
            await tx
              .update(schema.unitOfMeasure)
              .set({
                code: input.code,
                name: input.name,
                kind: input.kind,
                decimalScale: input.decimalScale,
                updatedBy: ctx.actorUserId,
              })
              .where(eq(schema.unitOfMeasure.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "uom.update",
          entityType: "unit_of_measure",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
  uomArchive: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const before = await assertUomVisible(tx, input.id);
        const row = firstOrThrow(
          (
            await tx
              .update(schema.unitOfMeasure)
              .set({ deletedAt: new Date(), updatedBy: ctx.actorUserId })
              .where(eq(schema.unitOfMeasure.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "uom.archive",
          entityType: "unit_of_measure",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
  variantList: tenantProcedure
    .input(
      z.object({
        includeArchived: z.boolean().default(false),
        productId: z.string().uuid().optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        if (input.productId) {
          await assertProductVisible(tx, input.productId);
        }
        const conditions = [
          input.productId
            ? eq(schema.variant.productId, input.productId)
            : null,
          input.includeArchived ? null : isNull(schema.variant.deletedAt),
        ].filter((condition): condition is SQL => condition != null);
        return tx
          .select()
          .from(schema.variant)
          .where(conditions.length ? and(...conditions) : undefined);
      });
    }),
  variantCreate: tenantProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        name: z.string().min(1),
        value: z.string().min(1),
        sortOrder: z.number().int().default(0),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        await assertProductVisible(tx, input.productId);
        const row = firstOrThrow(
          (
            await tx
              .insert(schema.variant)
              .values({
                tenantId: ctx.tenantId,
                productId: input.productId,
                name: input.name,
                value: input.value,
                sortOrder: input.sortOrder,
                createdBy: ctx.actorUserId,
              })
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "variant.create",
          entityType: "variant",
          entityId: row.id,
          after: row,
        });
        return row;
      });
    }),
  variantUpdate: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        value: z.string().min(1).optional(),
        sortOrder: z.number().int().optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const before = await assertVariantVisible(tx, input.id);
        const row = firstOrThrow(
          (
            await tx
              .update(schema.variant)
              .set({
                name: input.name,
                value: input.value,
                sortOrder: input.sortOrder,
                updatedBy: ctx.actorUserId,
              })
              .where(eq(schema.variant.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "variant.update",
          entityType: "variant",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
  variantArchive: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const before = await assertVariantVisible(tx, input.id);
        const row = firstOrThrow(
          (
            await tx
              .update(schema.variant)
              .set({ deletedAt: new Date(), updatedBy: ctx.actorUserId })
              .where(eq(schema.variant.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "variant.archive",
          entityType: "variant",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
  skuList: tenantProcedure
    .input(
      z.object({
        includeArchived: z.boolean().default(false),
        productId: z.string().uuid().optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        if (input.productId) {
          await assertProductVisible(tx, input.productId);
        }
        const conditions = [
          input.productId ? eq(schema.sku.productId, input.productId) : null,
          input.includeArchived ? null : isNull(schema.sku.deletedAt),
        ].filter((condition): condition is SQL => condition != null);
        return tx
          .select()
          .from(schema.sku)
          .where(conditions.length ? and(...conditions) : undefined);
      });
    }),
  skuCreate: tenantProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        code: z.string().min(1),
        name: z.string().min(1).optional(),
        baseUomId: z.string().uuid().optional(),
        costingMethod: z.enum(["avco", "fifo"]).optional(),
        trackingMode: z.enum(["none", "lot", "serial"]).default("none"),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        await assertProductVisible(tx, input.productId);
        if (input.baseUomId) {
          await assertUomVisible(tx, input.baseUomId);
        }
        const row = firstOrThrow(
          (
            await tx
              .insert(schema.sku)
              .values({
                tenantId: ctx.tenantId,
                productId: input.productId,
                code: input.code,
                name: input.name ?? null,
                baseUomId: input.baseUomId ?? null,
                costingMethod: input.costingMethod ?? null,
                trackingMode: input.trackingMode,
                createdBy: ctx.actorUserId,
              })
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "sku.create",
          entityType: "sku",
          entityId: row.id,
          after: row,
        });
        return row;
      });
    }),
  skuUpdate: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        code: z.string().min(1).optional(),
        name: z.string().min(1).nullable().optional(),
        baseUomId: z.string().uuid().nullable().optional(),
        costingMethod: z.enum(["avco", "fifo"]).nullable().optional(),
        trackingMode: z.enum(["none", "lot", "serial"]).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const before = await assertSkuVisible(tx, input.id);
        await assertCostingMethodSetOnce(tx, {
          currentMethod: before.costingMethod,
          nextMethod: input.costingMethod,
          skuId: input.id,
        });
        if (input.baseUomId) {
          await assertUomVisible(tx, input.baseUomId);
        }
        const row = firstOrThrow(
          (
            await tx
              .update(schema.sku)
              .set({
                code: input.code,
                name: input.name,
                baseUomId: input.baseUomId,
                costingMethod: input.costingMethod,
                trackingMode: input.trackingMode,
                isActive: input.isActive,
                updatedBy: ctx.actorUserId,
              })
              .where(eq(schema.sku.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "sku.update",
          entityType: "sku",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
  skuArchive: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const before = await assertSkuVisible(tx, input.id);
        const row = firstOrThrow(
          (
            await tx
              .update(schema.sku)
              .set({
                deletedAt: new Date(),
                isActive: false,
                updatedBy: ctx.actorUserId,
              })
              .where(eq(schema.sku.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "sku.archive",
          entityType: "sku",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
  barcodeList: tenantProcedure
    .input(
      z.object({
        includeArchived: z.boolean().default(false),
        skuId: z.string().uuid().optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        if (input.skuId) {
          await assertSkuVisible(tx, input.skuId);
        }
        const conditions = [
          input.skuId ? eq(schema.barcode.skuId, input.skuId) : null,
          input.includeArchived ? null : isNull(schema.barcode.deletedAt),
        ].filter((condition): condition is SQL => condition != null);
        return tx
          .select()
          .from(schema.barcode)
          .where(conditions.length ? and(...conditions) : undefined);
      });
    }),
  barcodeCreate: tenantProcedure
    .input(
      z.object({
        skuId: z.string().uuid(),
        value: z.string().min(1),
        symbology: z
          .enum(["ean13", "upca", "ean8", "code128", "gs1", "qr"])
          .default("ean13"),
        isPrimary: z.boolean().default(false),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        await assertSkuVisible(tx, input.skuId);
        const row = firstOrThrow(
          (
            await tx
              .insert(schema.barcode)
              .values({
                tenantId: ctx.tenantId,
                skuId: input.skuId,
                value: input.value,
                symbology: input.symbology,
                isPrimary: input.isPrimary,
                createdBy: ctx.actorUserId,
              })
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "barcode.create",
          entityType: "barcode",
          entityId: row.id,
          after: row,
        });
        return row;
      });
    }),
  barcodeUpdate: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        value: z.string().min(1).optional(),
        symbology: z
          .enum(["ean13", "upca", "ean8", "code128", "gs1", "qr"])
          .optional(),
        isPrimary: z.boolean().optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const before = await assertBarcodeVisible(tx, input.id);
        const row = firstOrThrow(
          (
            await tx
              .update(schema.barcode)
              .set({
                value: input.value,
                symbology: input.symbology,
                isPrimary: input.isPrimary,
                updatedBy: ctx.actorUserId,
              })
              .where(eq(schema.barcode.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "barcode.update",
          entityType: "barcode",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
  barcodeArchive: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const before = await assertBarcodeVisible(tx, input.id);
        const row = firstOrThrow(
          (
            await tx
              .update(schema.barcode)
              .set({ deletedAt: new Date(), updatedBy: ctx.actorUserId })
              .where(eq(schema.barcode.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "barcode.archive",
          entityType: "barcode",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
  uomConversionList: tenantProcedure
    .input(
      z.object({
        categoryId: z.string().uuid().optional(),
        includeArchived: z.boolean().default(false),
        productId: z.string().uuid().optional(),
        skuId: z.string().uuid().optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        if (input.categoryId) {
          await assertCategoryVisible(tx, input.categoryId);
        }
        if (input.productId) {
          await assertProductVisible(tx, input.productId);
        }
        if (input.skuId) {
          await assertSkuVisible(tx, input.skuId);
        }
        const conditions = [
          input.categoryId
            ? eq(schema.uomConversion.categoryId, input.categoryId)
            : null,
          input.productId
            ? eq(schema.uomConversion.productId, input.productId)
            : null,
          input.skuId ? eq(schema.uomConversion.skuId, input.skuId) : null,
          input.includeArchived ? null : isNull(schema.uomConversion.deletedAt),
        ].filter((condition): condition is SQL => condition != null);
        return tx
          .select()
          .from(schema.uomConversion)
          .where(conditions.length ? and(...conditions) : undefined);
      });
    }),
  uomConversionCreate: tenantProcedure
    .input(
      z.object({
        fromUomId: z.string().uuid(),
        toUomId: z.string().uuid(),
        role: z.enum(["purchase", "stock", "sale", "reporting"]),
        factor: z.number().int().positive(),
        factorScale: z.number().int().min(0).default(0),
        categoryId: z.string().uuid().optional(),
        productId: z.string().uuid().optional(),
        skuId: z.string().uuid().optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        await assertUomVisible(tx, input.fromUomId);
        await assertUomVisible(tx, input.toUomId);
        if (input.categoryId) {
          await assertCategoryVisible(tx, input.categoryId);
        }
        if (input.productId) {
          await assertProductVisible(tx, input.productId);
        }
        if (input.skuId) {
          await assertSkuVisible(tx, input.skuId);
        }
        const row = firstOrThrow(
          (
            await tx
              .insert(schema.uomConversion)
              .values({
                tenantId: ctx.tenantId,
                categoryId: input.categoryId ?? null,
                productId: input.productId ?? null,
                skuId: input.skuId ?? null,
                fromUomId: input.fromUomId,
                toUomId: input.toUomId,
                role: input.role,
                factor: input.factor,
                factorScale: input.factorScale,
                createdBy: ctx.actorUserId,
              })
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "uom_conversion.create",
          entityType: "uom_conversion",
          entityId: row.id,
          after: row,
        });
        return row;
      });
    }),
  uomConversionUpdate: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        categoryId: z.string().uuid().nullable().optional(),
        productId: z.string().uuid().nullable().optional(),
        skuId: z.string().uuid().nullable().optional(),
        fromUomId: z.string().uuid().optional(),
        toUomId: z.string().uuid().optional(),
        role: z.enum(["purchase", "stock", "sale", "reporting"]).optional(),
        factor: z.number().int().positive().optional(),
        factorScale: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const before = await assertUomConversionVisible(tx, input.id);
        if (input.categoryId) {
          await assertCategoryVisible(tx, input.categoryId);
        }
        if (input.productId) {
          await assertProductVisible(tx, input.productId);
        }
        if (input.skuId) {
          await assertSkuVisible(tx, input.skuId);
        }
        if (input.fromUomId) {
          await assertUomVisible(tx, input.fromUomId);
        }
        if (input.toUomId) {
          await assertUomVisible(tx, input.toUomId);
        }
        const row = firstOrThrow(
          (
            await tx
              .update(schema.uomConversion)
              .set({
                categoryId: input.categoryId,
                productId: input.productId,
                skuId: input.skuId,
                fromUomId: input.fromUomId,
                toUomId: input.toUomId,
                role: input.role,
                factor: input.factor,
                factorScale: input.factorScale,
                isActive: input.isActive,
                updatedBy: ctx.actorUserId,
              })
              .where(eq(schema.uomConversion.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "uom_conversion.update",
          entityType: "uom_conversion",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
  uomConversionArchive: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const before = await assertUomConversionVisible(tx, input.id);
        const row = firstOrThrow(
          (
            await tx
              .update(schema.uomConversion)
              .set({
                deletedAt: new Date(),
                isActive: false,
                updatedBy: ctx.actorUserId,
              })
              .where(eq(schema.uomConversion.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "uom_conversion.archive",
          entityType: "uom_conversion",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
};

async function assertProductVisible(
  tx: TenantTransaction,
  productId: string
): Promise<void> {
  const row = (
    await tx
      .select({ id: schema.product.id })
      .from(schema.product)
      .where(eq(schema.product.id, productId))
      .limit(1)
  ).at(0);
  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: "Product not found in this tenant",
    });
  }
}

async function assertLocationVisible(
  tx: TenantTransaction,
  locationId: string
): Promise<void> {
  const row = (
    await tx
      .select({ id: schema.location.id })
      .from(schema.location)
      .where(eq(schema.location.id, locationId))
      .limit(1)
  ).at(0);
  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: "Location not found in this tenant",
    });
  }
}

async function assertCategoryVisible(
  tx: TenantTransaction,
  categoryId: string
): Promise<typeof schema.category.$inferSelect> {
  const row = (
    await tx
      .select()
      .from(schema.category)
      .where(eq(schema.category.id, categoryId))
      .limit(1)
  ).at(0);
  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: "Category not found in this tenant",
    });
  }
  return row;
}

async function assertBrandVisible(
  tx: TenantTransaction,
  brandId: string
): Promise<typeof schema.brand.$inferSelect> {
  const row = (
    await tx
      .select()
      .from(schema.brand)
      .where(eq(schema.brand.id, brandId))
      .limit(1)
  ).at(0);
  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: "Brand not found in this tenant",
    });
  }
  return row;
}

async function assertSkuVisible(
  tx: TenantTransaction,
  skuId: string
): Promise<typeof schema.sku.$inferSelect> {
  const row = (
    await tx.select().from(schema.sku).where(eq(schema.sku.id, skuId)).limit(1)
  ).at(0);
  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: "SKU not found in this tenant",
    });
  }
  return row;
}

async function assertVariantVisible(
  tx: TenantTransaction,
  variantId: string
): Promise<typeof schema.variant.$inferSelect> {
  const row = (
    await tx
      .select()
      .from(schema.variant)
      .where(eq(schema.variant.id, variantId))
      .limit(1)
  ).at(0);
  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: "Variant not found in this tenant",
    });
  }
  return row;
}

async function assertLotVisible(
  tx: TenantTransaction,
  lotId: string
): Promise<typeof schema.lot.$inferSelect> {
  const row = (
    await tx.select().from(schema.lot).where(eq(schema.lot.id, lotId)).limit(1)
  ).at(0);
  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: "Lot not found in this tenant",
    });
  }
  return row;
}

// PART 2 — costing_method is SET-ONCE: immutable for a product/sku once that
// item has ANY stock_ledger movement (changing it would re-value history; the
// `costing_method_applied` stamp makes a violation detectable after the fact).
// A FIFO pharmacy SKU beside an AVCO grocery SKU in one tenant is valid — only
// CHANGING an item's method after movements exist is rejected. See ADR 0008 / D1.
async function assertCostingMethodSetOnce(
  tx: TenantTransaction,
  opts: {
    currentMethod: "avco" | "fifo" | null;
    nextMethod: "avco" | "fifo" | null | undefined;
    productId?: string;
    skuId?: string;
  }
): Promise<void> {
  // Field not supplied → not a change.
  if (opts.nextMethod === undefined) {
    return;
  }
  // Same effective value → not a change.
  if ((opts.nextMethod ?? null) === (opts.currentMethod ?? null)) {
    return;
  }
  let condition: ReturnType<typeof eq> | null = null;
  if (opts.skuId) {
    condition = eq(schema.stockLedger.skuId, opts.skuId);
  } else if (opts.productId) {
    condition = eq(schema.stockLedger.productId, opts.productId);
  }
  if (!condition) {
    return;
  }
  const existing = await tx
    .select({ id: schema.stockLedger.id })
    .from(schema.stockLedger)
    .where(condition)
    .limit(1);
  if (existing.length > 0) {
    throw new ORPCError("CONFLICT", {
      message:
        "costing_method is set-once: it cannot be changed after stock movements exist for this item",
    });
  }
}

async function assertReorderRuleVisible(
  tx: TenantTransaction,
  reorderRuleId: string
): Promise<typeof schema.reorderRule.$inferSelect> {
  const row = (
    await tx
      .select()
      .from(schema.reorderRule)
      .where(eq(schema.reorderRule.id, reorderRuleId))
      .limit(1)
  ).at(0);
  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: "Reorder rule not found in this tenant",
    });
  }
  return row;
}

async function assertUomVisible(
  tx: TenantTransaction,
  uomId: string
): Promise<typeof schema.unitOfMeasure.$inferSelect> {
  const row = (
    await tx
      .select()
      .from(schema.unitOfMeasure)
      .where(eq(schema.unitOfMeasure.id, uomId))
      .limit(1)
  ).at(0);
  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: "Unit of measure not found in this tenant",
    });
  }
  return row;
}

async function assertBarcodeVisible(
  tx: TenantTransaction,
  barcodeId: string
): Promise<typeof schema.barcode.$inferSelect> {
  const row = (
    await tx
      .select()
      .from(schema.barcode)
      .where(eq(schema.barcode.id, barcodeId))
      .limit(1)
  ).at(0);
  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: "Barcode not found in this tenant",
    });
  }
  return row;
}

async function assertUomConversionVisible(
  tx: TenantTransaction,
  conversionId: string
): Promise<typeof schema.uomConversion.$inferSelect> {
  const row = (
    await tx
      .select()
      .from(schema.uomConversion)
      .where(eq(schema.uomConversion.id, conversionId))
      .limit(1)
  ).at(0);
  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: "UoM conversion not found in this tenant",
    });
  }
  return row;
}

const inventoryReceiveInput = z.object({
  locationId: z.string().uuid(),
  lotId: z.string().uuid().optional(),
  productId: z.string().uuid(),
  skuId: z.string().uuid().optional(),
  qty: z.number().int().positive(),
  unitCostMinor: z.number().int().min(0).optional(),
  costCurrency: z.string().length(3).optional(),
  costScale: z.number().int().min(0).optional(),
  idempotencyKey: z.string().min(1).optional(),
});

type InventoryReceiveInput = z.infer<typeof inventoryReceiveInput>;

async function assertInventoryReceiveReferences(
  tx: TenantTransaction,
  input: InventoryReceiveInput
): Promise<void> {
  const loc = (
    await tx
      .select({ id: schema.location.id })
      .from(schema.location)
      .where(eq(schema.location.id, input.locationId))
      .limit(1)
  ).at(0);
  if (!loc) {
    throw new ORPCError("NOT_FOUND", {
      message: "Location not found in this tenant",
    });
  }
  const prod = (
    await tx
      .select({ id: schema.product.id })
      .from(schema.product)
      .where(eq(schema.product.id, input.productId))
      .limit(1)
  ).at(0);
  if (!prod) {
    throw new ORPCError("NOT_FOUND", {
      message: "Product not found in this tenant",
    });
  }
  if (input.skuId) {
    await assertSkuBelongsToProduct(tx, input.skuId, input.productId);
    assertReceiptCostTriplet(input);
  }
  if (input.lotId) {
    const lot = (
      await tx
        .select({ id: schema.lot.id })
        .from(schema.lot)
        .where(eq(schema.lot.id, input.lotId))
        .limit(1)
    ).at(0);
    if (!lot) {
      throw new ORPCError("NOT_FOUND", {
        message: "Lot not found in this tenant",
      });
    }
  }
}

async function assertSkuBelongsToProduct(
  tx: TenantTransaction,
  skuId: string,
  productId: string
): Promise<void> {
  const item = (
    await tx
      .select({ id: schema.sku.id })
      .from(schema.sku)
      .where(and(eq(schema.sku.id, skuId), eq(schema.sku.productId, productId)))
      .limit(1)
  ).at(0);
  if (!item) {
    throw new ORPCError("NOT_FOUND", {
      message: "SKU not found in this tenant/product",
    });
  }
}

function assertReceiptCostTriplet(input: InventoryReceiveInput): void {
  if (
    input.unitCostMinor == null ||
    input.costCurrency == null ||
    input.costScale == null
  ) {
    throw new ORPCError("BAD_REQUEST", {
      message:
        "SKU-valued receipt requires unitCostMinor/costCurrency/costScale",
    });
  }
}

export const inventoryRouter = {
  lotList: tenantProcedure
    .input(
      z.object({
        includeArchived: z.boolean().default(false),
        skuId: z.string().uuid().optional(),
        status: z
          .enum(["available", "quarantined", "expired", "depleted"])
          .optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.receive");
        if (input.skuId) {
          await assertSkuVisible(tx, input.skuId);
        }
        const conditions = [
          input.skuId ? eq(schema.lot.skuId, input.skuId) : null,
          input.status ? eq(schema.lot.status, input.status) : null,
          input.includeArchived ? null : isNull(schema.lot.deletedAt),
        ].filter((condition): condition is SQL => condition != null);
        return tx
          .select()
          .from(schema.lot)
          .where(conditions.length ? and(...conditions) : undefined);
      });
    }),
  lotCreate: tenantProcedure
    .input(
      z.object({
        skuId: z.string().uuid(),
        lotNumber: z.string().min(1),
        expiryDate: z.string().date().optional(),
        manufacturedDate: z.string().date().optional(),
        status: z
          .enum(["available", "quarantined", "expired", "depleted"])
          .default("available"),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.receive");
        await assertSkuVisible(tx, input.skuId);
        const row = firstOrThrow(
          (
            await tx
              .insert(schema.lot)
              .values({
                tenantId: ctx.tenantId,
                skuId: input.skuId,
                lotNumber: input.lotNumber,
                expiryDate: input.expiryDate ?? null,
                manufacturedDate: input.manufacturedDate ?? null,
                status: input.status,
                createdBy: ctx.actorUserId,
              })
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "lot.create",
          entityType: "lot",
          entityId: row.id,
          after: row,
        });
        return row;
      });
    }),
  lotUpdate: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        lotNumber: z.string().min(1).optional(),
        expiryDate: z.string().date().nullable().optional(),
        manufacturedDate: z.string().date().nullable().optional(),
        status: z
          .enum(["available", "quarantined", "expired", "depleted"])
          .optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.receive");
        const before = await assertLotVisible(tx, input.id);
        const row = firstOrThrow(
          (
            await tx
              .update(schema.lot)
              .set({
                lotNumber: input.lotNumber,
                expiryDate: input.expiryDate,
                manufacturedDate: input.manufacturedDate,
                status: input.status,
                updatedBy: ctx.actorUserId,
              })
              .where(eq(schema.lot.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "lot.update",
          entityType: "lot",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
  lotArchive: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.receive");
        const before = await assertLotVisible(tx, input.id);
        const row = firstOrThrow(
          (
            await tx
              .update(schema.lot)
              .set({ deletedAt: new Date(), updatedBy: ctx.actorUserId })
              .where(eq(schema.lot.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "lot.archive",
          entityType: "lot",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
  reorderRuleList: tenantProcedure
    .input(
      z.object({
        includeArchived: z.boolean().default(false),
        locationId: z.string().uuid().optional(),
        skuId: z.string().uuid().optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.reorder");
        if (input.locationId) {
          await assertLocationVisible(tx, input.locationId);
        }
        if (input.skuId) {
          await assertSkuVisible(tx, input.skuId);
        }
        const conditions = [
          input.locationId
            ? eq(schema.reorderRule.locationId, input.locationId)
            : null,
          input.skuId ? eq(schema.reorderRule.skuId, input.skuId) : null,
          input.includeArchived ? null : isNull(schema.reorderRule.deletedAt),
        ].filter((condition): condition is SQL => condition != null);
        return tx
          .select()
          .from(schema.reorderRule)
          .where(conditions.length ? and(...conditions) : undefined);
      });
    }),
  reorderRuleUpsert: tenantProcedure
    .input(
      z.object({
        skuId: z.string().uuid(),
        locationId: z.string().uuid(),
        minQty: z.number().int().min(0),
        maxQty: z.number().int().min(0),
        isActive: z.boolean().default(true),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.reorder");
        await assertSkuVisible(tx, input.skuId);
        await assertLocationVisible(tx, input.locationId);
        if (input.maxQty < input.minQty) {
          throw new ORPCError("BAD_REQUEST", {
            message: "maxQty must be greater than or equal to minQty",
          });
        }
        const before = (
          await tx
            .select()
            .from(schema.reorderRule)
            .where(
              and(
                eq(schema.reorderRule.skuId, input.skuId),
                eq(schema.reorderRule.locationId, input.locationId)
              )
            )
            .limit(1)
        ).at(0);
        const row = firstOrThrow(
          (
            await tx
              .insert(schema.reorderRule)
              .values({
                tenantId: ctx.tenantId,
                skuId: input.skuId,
                locationId: input.locationId,
                minQty: input.minQty,
                maxQty: input.maxQty,
                isActive: input.isActive,
                createdBy: ctx.actorUserId,
              })
              .onConflictDoUpdate({
                target: [
                  schema.reorderRule.tenantId,
                  schema.reorderRule.skuId,
                  schema.reorderRule.locationId,
                ],
                set: {
                  minQty: input.minQty,
                  maxQty: input.maxQty,
                  isActive: input.isActive,
                  deletedAt: null,
                  updatedBy: ctx.actorUserId,
                },
              })
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: before ? "reorder_rule.update" : "reorder_rule.create",
          entityType: "reorder_rule",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
  reorderRuleArchive: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.reorder");
        const before = await assertReorderRuleVisible(tx, input.id);
        const row = firstOrThrow(
          (
            await tx
              .update(schema.reorderRule)
              .set({
                deletedAt: new Date(),
                isActive: false,
                updatedBy: ctx.actorUserId,
              })
              .where(eq(schema.reorderRule.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "reorder_rule.archive",
          entityType: "reorder_rule",
          entityId: row.id,
          before,
          after: row,
        });
        return row;
      });
    }),
  stockDiscrepancyList: tenantProcedure
    .input(z.object({ locationId: z.string().uuid().optional() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.count");
        if (input.locationId) {
          await assertLocationVisible(tx, input.locationId);
        }
        const rows = await tx.execute(sql`
          WITH latest AS (
            SELECT DISTINCT ON (sku_id, location_id)
              id,
              product_id,
              sku_id,
              location_id,
              balance_after,
              server_ts
            FROM stock_ledger
            WHERE tenant_id = ${ctx.tenantId}
              AND sku_id IS NOT NULL
              AND (${input.locationId ?? null}::uuid IS NULL OR location_id = ${input.locationId ?? null})
            ORDER BY sku_id, location_id, server_ts DESC, id DESC
          )
          SELECT *
          FROM latest
          WHERE balance_after < 0
          ORDER BY server_ts DESC
        `);
        return rows.rows.map((row) => ({
          latestMovementId: row.id,
          productId: row.product_id,
          skuId: row.sku_id,
          locationId: row.location_id,
          balanceAfter: Number(row.balance_after),
          serverTs: row.server_ts,
        }));
      });
    }),
  stockDiscrepancyReview: tenantProcedure
    .input(
      z.object({
        skuId: z.string().uuid(),
        locationId: z.string().uuid(),
        resolution: z.enum(["count_requested", "accepted", "adjusted"]),
        notes: z.string().max(2000).optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.count");
        await assertSkuVisible(tx, input.skuId);
        await assertLocationVisible(tx, input.locationId);
        await services.emitEvent(tx, ctx, {
          type: services.DomainEventType.InventoryStockDiscrepancyReviewed,
          payload: {
            skuId: input.skuId,
            locationId: input.locationId,
            resolution: input.resolution,
            notes: input.notes ?? null,
            reviewedBy: ctx.actorUserId,
          },
        });
        await services.recordAudit(tx, ctx, {
          action: "inventory.stock_discrepancy.review",
          entityType: "stock_ledger",
          entityId: input.skuId,
          after: input,
        });
        return { reviewed: true };
      });
    }),
  revalue: tenantProcedure
    .input(
      z.object({
        skuId: z.string().uuid(),
        locationId: z.string().uuid(),
        reasonCode: z.string().min(1),
        totalValueMinor: z.number().int().min(0).optional(),
        fifoLayerId: z.string().uuid().optional(),
        unitCostMinor: z.number().int().min(0).optional(),
        currency: z.string().length(3).optional(),
        scale: z.number().int().min(0).optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.adjust");
        await assertSkuVisible(tx, input.skuId);
        await assertLocationVisible(tx, input.locationId);
        const method = await services.resolveCostingMethod(tx, ctx, {
          skuId: input.skuId,
        });
        if (method === "avco") {
          if (
            input.totalValueMinor == null ||
            input.currency == null ||
            input.scale == null
          ) {
            throw new ORPCError("BAD_REQUEST", {
              message:
                "AVCO revaluation requires totalValueMinor/currency/scale",
            });
          }
          const before = (
            await tx
              .select()
              .from(schema.avgCost)
              .where(
                and(
                  eq(schema.avgCost.skuId, input.skuId),
                  eq(schema.avgCost.locationId, input.locationId)
                )
              )
              .for("update")
              .limit(1)
          ).at(0);
          if (!before) {
            throw new ORPCError("NOT_FOUND", {
              message: "AVCO valuation row not found",
            });
          }
          if (before.qtyOnHand === 0 && input.totalValueMinor !== 0) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Zero on-hand AVCO row must have zero value",
            });
          }
          const after = firstOrThrow(
            (
              await tx
                .update(schema.avgCost)
                .set({
                  totalValueMinor: input.totalValueMinor,
                  currency: input.currency,
                  scale: input.scale,
                })
                .where(eq(schema.avgCost.id, before.id))
                .returning()
            ).at(0)
          );
          await services.recordAudit(tx, ctx, {
            action: "inventory.revalue",
            entityType: "avg_cost",
            entityId: after.id,
            before,
            after: { row: after, reasonCode: input.reasonCode },
          });
          await services.emitEvent(tx, ctx, {
            type: services.DomainEventType.InventoryRevalued,
            payload: {
              method,
              skuId: input.skuId,
              locationId: input.locationId,
              reasonCode: input.reasonCode,
              totalValueMinor: input.totalValueMinor,
              currency: input.currency,
              scale: input.scale,
            },
          });
          return { method, row: after };
        }
        if (input.fifoLayerId == null || input.unitCostMinor == null) {
          throw new ORPCError("BAD_REQUEST", {
            message: "FIFO revaluation requires fifoLayerId/unitCostMinor",
          });
        }
        const before = (
          await tx
            .select()
            .from(schema.valuationLayer)
            .where(
              and(
                eq(schema.valuationLayer.id, input.fifoLayerId),
                eq(schema.valuationLayer.skuId, input.skuId),
                eq(schema.valuationLayer.locationId, input.locationId)
              )
            )
            .for("update")
            .limit(1)
        ).at(0);
        if (!before) {
          throw new ORPCError("NOT_FOUND", {
            message: "FIFO valuation layer not found",
          });
        }
        const after = firstOrThrow(
          (
            await tx
              .update(schema.valuationLayer)
              .set({ unitCostMinor: input.unitCostMinor })
              .where(eq(schema.valuationLayer.id, before.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "inventory.revalue",
          entityType: "valuation_layer",
          entityId: after.id,
          before,
          after: { row: after, reasonCode: input.reasonCode },
        });
        await services.emitEvent(tx, ctx, {
          type: services.DomainEventType.InventoryRevalued,
          payload: {
            method,
            skuId: input.skuId,
            locationId: input.locationId,
            fifoLayerId: input.fifoLayerId,
            reasonCode: input.reasonCode,
            unitCostMinor: input.unitCostMinor,
            currency: after.currency,
            scale: after.scale,
          },
        });
        return { method, row: after };
      });
    }),
  receive: tenantProcedure
    .input(inventoryReceiveInput)
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.receive");
        await assertInventoryReceiveReferences(tx, input);
        const ledger = await services.appendStockMovement(tx, ctx, {
          costCurrency: input.costCurrency ?? null,
          costScale: input.costScale ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          locationId: input.locationId,
          lotId: input.lotId ?? null,
          productId: input.productId,
          movementType: "receipt",
          qtyDelta: input.qty,
          skuId: input.skuId ?? null,
          unitCostMinor: input.unitCostMinor ?? null,
        });
        const valuation = input.skuId
          ? await services.applyValuation(tx, ctx, ledger)
          : null;
        await services.emitEvent(tx, ctx, {
          type: services.DomainEventType.InventoryReceived,
          payload: {
            locationId: input.locationId,
            productId: input.productId,
            skuId: input.skuId ?? null,
            lotId: input.lotId ?? null,
            // serial capture is deferred (TRACKING_MODES has `serial`, but no
            // serial entity is wired yet) — reserved as null so the contract
            // shape is locked now and consumers tolerate it additively.
            serialIds: null,
            qtyBase: input.qty,
            unitCostMinor: input.unitCostMinor ?? null,
            currency: input.costCurrency ?? null,
            scale: input.costScale ?? null,
            sourceMovementId: ledger.id,
            costingMethod: valuation?.method ?? null,
          },
        });
        if (valuation) {
          await services.emitEvent(tx, ctx, {
            type: services.DomainEventType.InventoryValuationUpdated,
            payload: {
              locationId: input.locationId,
              skuId: input.skuId,
              sourceMovementId: ledger.id,
              costingMethod: valuation.method,
              cogsMinor: valuation.cogsMinor,
              currency: valuation.currency,
              scale: valuation.scale,
              unvaluedQty: valuation.unvaluedQty,
              // reserved; the qty==0 ⟺ value==0 integrity fields — populated
              // when ValuationResult is extended to expose post-movement
              // on-hand value (Phase 5). Reserved nullable now so binding them
              // later is additive, not a breaking change.
              totalValueMinor: null,
              qtyOnHandBase: null,
            },
          });
        }
        await services.recordAudit(tx, ctx, {
          action: "inventory.receive",
          entityType: "stock_ledger",
          entityId: ledger.id,
          after: ledger,
        });
        return ledger;
      });
    }),
  adjust: tenantProcedure
    .input(
      z.object({
        locationId: z.string().uuid(),
        productId: z.string().uuid(),
        skuId: z.string().uuid(),
        lotId: z.string().uuid().optional(),
        qtyDelta: z
          .number()
          .int()
          .refine((qty) => qty !== 0),
        reasonCode: z.string().min(1),
        unitCostMinor: z.number().int().min(0).optional(),
        costCurrency: z.string().length(3).optional(),
        costScale: z.number().int().min(0).optional(),
        idempotencyKey: z.string().min(1).optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.adjust");
        await assertLocationVisible(tx, input.locationId);
        if (input.lotId) {
          await assertLotVisible(tx, input.lotId);
        }
        const item = (
          await tx
            .select({ id: schema.sku.id })
            .from(schema.sku)
            .where(
              and(
                eq(schema.sku.id, input.skuId),
                eq(schema.sku.productId, input.productId)
              )
            )
            .limit(1)
        ).at(0);
        if (!item) {
          throw new ORPCError("NOT_FOUND", {
            message: "SKU not found in this tenant/product",
          });
        }
        if (
          input.qtyDelta > 0 &&
          (input.unitCostMinor == null ||
            input.costCurrency == null ||
            input.costScale == null)
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message:
              "Positive adjustment requires unitCostMinor/costCurrency/costScale",
          });
        }
        const ledger = await services.appendStockMovement(tx, ctx, {
          costCurrency: input.costCurrency ?? null,
          costScale: input.costScale ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          locationId: input.locationId,
          lotId: input.lotId ?? null,
          movementType: "adjustment",
          productId: input.productId,
          qtyDelta: input.qtyDelta,
          refType: "inventory.adjust",
          skuId: input.skuId,
          unitCostMinor: input.unitCostMinor ?? null,
        });
        const valuation = await services.applyValuation(tx, ctx, ledger);
        await services.emitEvent(tx, ctx, {
          type: services.DomainEventType.InventoryAdjusted,
          payload: {
            locationId: input.locationId,
            skuId: input.skuId,
            lotId: input.lotId ?? null,
            qtyDeltaBase: input.qtyDelta,
            reasonCode: input.reasonCode,
            sourceMovementId: ledger.id,
            cogsMinor: valuation.cogsMinor,
            currency: valuation.currency,
            scale: valuation.scale,
            // reserved; populated when the §22 adjustment-approval workflow
            // lands. Adjustments are audit-critical — who approved a manual
            // stock write-off/up is the field a Phase-5 audit consumer needs,
            // so the shape reserves it now (nullable) rather than breaking
            // later when it becomes a bound field.
            approvedBy: null,
          },
        });
        await services.recordAudit(tx, ctx, {
          action: "inventory.adjust",
          entityType: "stock_ledger",
          entityId: ledger.id,
          after: { ledger, valuation, reasonCode: input.reasonCode },
        });
        return { ledger, valuation };
      });
    }),
  countStart: tenantProcedure
    .input(
      z.object({
        locationId: z.string().uuid(),
        scope: z.enum(["full", "cycle", "zone"]).default("cycle"),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.count");
        await assertLocationVisible(tx, input.locationId);
        const row = firstOrThrow(
          (
            await tx
              .insert(schema.stockCount)
              .values({
                tenantId: ctx.tenantId,
                locationId: input.locationId,
                scope: input.scope,
                status: "started",
                createdBy: ctx.actorUserId,
              })
              .returning()
          ).at(0)
        );
        await services.emitEvent(tx, ctx, {
          type: services.DomainEventType.InventoryCountStarted,
          payload: {
            countId: row.id,
            locationId: input.locationId,
            scope: input.scope,
            startedBy: ctx.actorUserId,
          },
        });
        await services.recordAudit(tx, ctx, {
          action: "inventory.count.start",
          entityType: "stock_count",
          entityId: row.id,
          after: row,
        });
        return row;
      });
    }),
  countLineUpsert: tenantProcedure
    .input(
      z.object({
        stockCountId: z.string().uuid(),
        skuId: z.string().uuid(),
        lotId: z.string().uuid().optional(),
        countedQty: z.number().int().min(0),
        varianceValueMinor: z.number().int().optional(),
        currency: z.string().length(3).optional(),
        scale: z.number().int().min(0).optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.count");
        const countRow = (
          await tx
            .select({ id: schema.stockCount.id })
            .from(schema.stockCount)
            .where(eq(schema.stockCount.id, input.stockCountId))
            .limit(1)
        ).at(0);
        if (!countRow) {
          throw new ORPCError("NOT_FOUND", {
            message: "Stock count not found in this tenant",
          });
        }
        await assertSkuVisible(tx, input.skuId);
        if (input.lotId) {
          await assertLotVisible(tx, input.lotId);
        }
        const row = firstOrThrow(
          (
            await tx
              .insert(schema.stockCountLine)
              .values({
                tenantId: ctx.tenantId,
                stockCountId: input.stockCountId,
                skuId: input.skuId,
                lotId: input.lotId ?? null,
                countedQty: input.countedQty,
                varianceValueMinor: input.varianceValueMinor ?? null,
                currency: input.currency ?? null,
                scale: input.scale ?? null,
              })
              .onConflictDoUpdate({
                target: [
                  schema.stockCountLine.tenantId,
                  schema.stockCountLine.stockCountId,
                  schema.stockCountLine.skuId,
                  schema.stockCountLine.lotId,
                ],
                set: {
                  countedQty: input.countedQty,
                  varianceValueMinor: input.varianceValueMinor ?? null,
                  currency: input.currency ?? null,
                  scale: input.scale ?? null,
                },
              })
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "inventory.count.line.upsert",
          entityType: "stock_count_line",
          entityId: row.id,
          after: row,
        });
        return row;
      });
    }),
  countPost: tenantProcedure
    .input(z.object({ stockCountId: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.count");
        const result = await services.postStockCount(tx, ctx, input);
        await services.emitEvent(tx, ctx, {
          type: services.DomainEventType.InventoryCountPosted,
          payload: {
            countId: result.stockCountId,
            locationId: result.locationId,
            currency: result.currency,
            scale: result.scale,
            // Map the internal posting adjustments to the locked base/Minor
            // line contract (event-map-phase2.md). The service return keeps its
            // own field names; only the EVENT payload is normalized.
            lines: result.adjustments.map((a) => ({
              skuId: a.skuId,
              lotId: a.lotId,
              countedQtyBase: a.countedQty,
              systemQtyBase: a.systemQty,
              varianceBase: a.varianceQty,
              varianceValueMinor: a.valuationMinor,
            })),
            postedBy: ctx.actorUserId,
          },
        });
        await services.recordAudit(tx, ctx, {
          action: "inventory.count.post",
          entityType: "stock_count",
          entityId: result.stockCountId,
          after: result,
        });
        return result;
      });
    }),
  reorderEvaluate: tenantProcedure
    .input(
      z.object({
        locationId: z.string().uuid(),
        skuId: z.string().uuid(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.reorder");
        await assertLocationVisible(tx, input.locationId);
        await assertSkuVisible(tx, input.skuId);
        const result = await services.evaluateReorder(tx, input);
        if (result?.isBelowMin) {
          await services.emitEvent(tx, ctx, {
            type: services.DomainEventType.InventoryReorderTriggered,
            payload: {
              skuId: input.skuId,
              locationId: input.locationId,
              onHandBase: result.onHand,
              minQty: result.minQty,
              maxQty: result.maxQty,
              suggestedQtyBase: result.suggestedQty,
            },
          });
        }
        return result;
      });
    }),
};

export const posRouter = {
  createSale: tenantProcedure
    .input(
      z.object({
        locationId: z.string().uuid(),
        idempotencyKey: z.string().min(1),
        lines: z
          .array(
            z.object({
              productId: z.string().uuid(),
              qty: z.number().int().positive(),
            })
          )
          .min(1),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.create_sale");
        // Idempotent end-to-end: a replayed offline sale collapses to one.
        return services.runIdempotent(
          tx,
          ctx,
          input.idempotencyKey,
          input,
          async () => {
            // RLS-scoped existence check (FK checks bypass RLS).
            const saleLocation = (
              await tx
                .select({ id: schema.location.id })
                .from(schema.location)
                .where(eq(schema.location.id, input.locationId))
                .limit(1)
            ).at(0);
            if (!saleLocation) {
              throw new ORPCError("NOT_FOUND", {
                message: "Location not found in this tenant",
              });
            }
            const products = await tx
              .select()
              .from(schema.product)
              .where(
                inArray(
                  schema.product.id,
                  input.lines.map((line) => line.productId)
                )
              );
            const { total: grandTotal, lineValues } = priceSaleLines(
              products,
              input.lines
            );

            // Sequential, gapless document numbers per tenant (single-node
            // allocator; distributed reservation deferred). Advisory-locked.
            await tx.execute(
              sql`SELECT pg_advisory_xact_lock(hashtextextended(${`docnum:${ctx.tenantId}`}, 0))`
            );
            const saleSeq =
              ((await tx.select({ c: count() }).from(schema.sale)).at(0)?.c ??
                0) + 1;
            const saleNumber = `SALE-${saleSeq}`;

            const sale = firstOrThrow(
              (
                await tx
                  .insert(schema.sale)
                  .values({
                    tenantId: ctx.tenantId,
                    locationId: input.locationId,
                    number: saleNumber,
                    totalMinor: grandTotal.minor,
                    currency: grandTotal.currency,
                    scale: grandTotal.scale,
                    status: "completed",
                    idempotencyKey: input.idempotencyKey,
                    createdBy: ctx.actorUserId,
                  })
                  .returning()
              ).at(0)
            );

            for (const lv of lineValues) {
              await tx.insert(schema.saleLine).values({
                tenantId: ctx.tenantId,
                saleId: sale.id,
                productId: lv.productId,
                qty: lv.qty,
                unitPriceMinor: lv.unitPriceMinor,
              });
              // Stock deduction goes through the ledger (the only mutator). The
              // ledger stays POLICY-NEUTRAL: we do NOT hard-block oversell here
              // (charter §14; decided D5 default = allow-oversell-with-flagging).
              const movement = await services.appendStockMovement(tx, ctx, {
                locationId: input.locationId,
                productId: lv.productId,
                movementType: "sale",
                qtyDelta: -lv.qty,
                refType: "sale",
                refId: sale.id,
                idempotencyKey: input.idempotencyKey,
              });
              // D5 flag (event only, applied ABOVE the neutral ledger): when the
              // sale drives on-hand negative, emit a stock-discrepancy event for
              // manager review / cycle count. Hard-block remains a per
              // tenant/category/product config (not wired in this hotfix).
              if (movement.balanceAfter < 0) {
                await services.emitEvent(tx, ctx, {
                  type: services.DomainEventType.InventoryStockDiscrepancy,
                  payload: {
                    locationId: input.locationId,
                    productId: lv.productId,
                    saleId: sale.id,
                    qtySold: lv.qty,
                    resultingOnHand: movement.balanceAfter,
                    deltaBase: movement.balanceAfter,
                    source: "oversell",
                    reason: "oversell",
                    sourceMovementId: movement.id,
                    idempotencyKey: input.idempotencyKey,
                  },
                });
              }
            }

            const invoiceSeq =
              ((await tx.select({ c: count() }).from(schema.invoice)).at(0)
                ?.c ?? 0) + 1;
            const invoice = firstOrThrow(
              (
                await tx
                  .insert(schema.invoice)
                  .values({
                    tenantId: ctx.tenantId,
                    saleId: sale.id,
                    number: `INV-${invoiceSeq}`,
                    totalMinor: grandTotal.minor,
                    currency: grandTotal.currency,
                    scale: grandTotal.scale,
                  })
                  .returning()
              ).at(0)
            );

            // Accounting posting is deferred (Phase 5): the sale.created outbox
            // event below is the seam a future GL consumer subscribes to.
            await services.recordAudit(tx, ctx, {
              action: "pos.create_sale",
              entityType: "sale",
              entityId: sale.id,
              after: sale,
            });
            await services.emitEvent(tx, ctx, {
              type: services.DomainEventType.SaleCreated,
              payload: {
                saleId: sale.id,
                number: saleNumber,
                totalMinor: grandTotal.minor,
                currency: grandTotal.currency,
              },
            });

            return {
              saleId: sale.id,
              number: saleNumber,
              invoiceId: invoice.id,
              totalMinor: grandTotal.minor,
              currency: grandTotal.currency,
              scale: grandTotal.scale,
            };
          }
        );
      });
    }),
};

export const reportsRouter = {
  salesBasic: tenantProcedure
    .input(
      z.object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        locationId: z.string().uuid().optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "reports.view");
        const conditions = [eq(schema.sale.status, "completed")];
        if (input.locationId) {
          conditions.push(eq(schema.sale.locationId, input.locationId));
        }
        if (input.from) {
          conditions.push(gte(schema.sale.createdAt, new Date(input.from)));
        }
        if (input.to) {
          conditions.push(lte(schema.sale.createdAt, new Date(input.to)));
        }
        // Group by currency + scale — summing minor units across currencies
        // would be meaningless (charter §12 multi-currency).
        const rows = await tx
          .select({
            currency: schema.sale.currency,
            scale: schema.sale.scale,
            saleCount: count(),
            totalMinor: sql<number>`COALESCE(SUM(${schema.sale.totalMinor}), 0)::bigint`,
          })
          .from(schema.sale)
          .where(and(...conditions))
          .groupBy(schema.sale.currency, schema.sale.scale);
        return {
          byCurrency: rows.map((r) => ({
            currency: r.currency,
            scale: r.scale,
            saleCount: Number(r.saleCount),
            totalMinor: Number(r.totalMinor),
          })),
        };
      });
    }),
  valuation: tenantProcedure
    .input(
      z.object({
        locationId: z.string().uuid().optional(),
        skuId: z.string().uuid().optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "reports.view");
        const conditions: SQL[] = [];
        if (input.locationId) {
          conditions.push(eq(schema.avgCost.locationId, input.locationId));
        }
        if (input.skuId) {
          conditions.push(eq(schema.avgCost.skuId, input.skuId));
        }
        const avcoRows = await tx
          .select()
          .from(schema.avgCost)
          .where(conditions.length ? and(...conditions) : undefined);
        const fifoRows = await tx.execute(sql`
          SELECT
            sku_id,
            location_id,
            currency,
            scale,
            COALESCE(SUM(qty_remaining), 0)::bigint AS qty_on_hand,
            COALESCE(SUM(qty_remaining * unit_cost_minor), 0)::bigint AS total_value_minor
          FROM valuation_layer
          WHERE qty_remaining > 0
            AND (${input.locationId ?? null}::uuid IS NULL OR location_id = ${input.locationId ?? null})
            AND (${input.skuId ?? null}::uuid IS NULL OR sku_id = ${input.skuId ?? null})
          GROUP BY sku_id, location_id, currency, scale
        `);
        return {
          avco: avcoRows,
          fifo: fifoRows.rows.map((row) => ({
            skuId: row.sku_id,
            locationId: row.location_id,
            currency: row.currency,
            scale: Number(row.scale),
            qtyOnHand: Number(row.qty_on_hand),
            totalValueMinor: Number(row.total_value_minor),
          })),
        };
      });
    }),
  lowStock: tenantProcedure
    .input(z.object({ locationId: z.string().uuid().optional() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "reports.view");
        const rows = await tx.execute(sql`
          SELECT
            rr.sku_id,
            rr.location_id,
            rr.min_qty,
            rr.max_qty,
            COALESCE(SUM(sl.qty_delta), 0)::bigint AS on_hand
          FROM reorder_rule rr
          LEFT JOIN stock_ledger sl
            ON sl.sku_id = rr.sku_id
           AND sl.location_id = rr.location_id
          WHERE rr.is_active = true
            AND rr.deleted_at IS NULL
            AND (${input.locationId ?? null}::uuid IS NULL OR rr.location_id = ${input.locationId ?? null})
          GROUP BY rr.sku_id, rr.location_id, rr.min_qty, rr.max_qty
          HAVING COALESCE(SUM(sl.qty_delta), 0) < rr.min_qty
        `);
        return rows.rows.map((row) => ({
          skuId: row.sku_id,
          locationId: row.location_id,
          minQty: Number(row.min_qty),
          maxQty: Number(row.max_qty),
          onHand: Number(row.on_hand),
          suggestedQty: Math.max(0, Number(row.max_qty) - Number(row.on_hand)),
        }));
      });
    }),
};
