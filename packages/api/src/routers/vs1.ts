import { auth } from "@RetailOS/auth";
import type { TenantTransaction } from "@RetailOS/db";
import { db, schema, services, withTenant } from "@RetailOS/db";
import { ORPCError } from "@orpc/server";
import {
  and,
  count,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
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
  // Cashier product lookup (MSP): match by name, product SKU code, or barcode
  // value; tenant-scoped (RLS) and excludes archived products. The cashier only
  // needs read access tied to ringing a sale, so it gates on pos.create_sale.
  search: tenantProcedure
    .input(
      z.object({
        q: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.create_sale");
        const term = `%${input.q}%`;
        const byBarcode = tx
          .select({ productId: schema.sku.productId })
          .from(schema.barcode)
          .innerJoin(schema.sku, eq(schema.barcode.skuId, schema.sku.id))
          .where(eq(schema.barcode.value, input.q));
        return tx
          .select()
          .from(schema.product)
          .where(
            and(
              isNull(schema.product.deletedAt),
              or(
                ilike(schema.product.name, term),
                ilike(schema.product.sku, term),
                inArray(schema.product.id, byBarcode)
              )
            )
          )
          .limit(input.limit);
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

// Codex F2: a router that accepts a caller-supplied companyId must validate it
// with an RLS-scoped read before passing it to a service/insert. The DB-level
// composite company FK already rejects a cross-TENANT company id, but this
// surfaces a clean NOT_FOUND instead of a raw FK violation (and matches the
// belt-and-braces guard pattern used across this router).
async function assertCompanyVisible(
  tx: TenantTransaction,
  companyId: string
): Promise<void> {
  const row = (
    await tx
      .select({ id: schema.company.id })
      .from(schema.company)
      .where(eq(schema.company.id, companyId))
      .limit(1)
  ).at(0);
  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: "Company not found in this tenant",
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

// Codex F3: a line that carries both a skuId and a lotId must prove the lot
// BELONGS to that sku — otherwise a same-tenant lot from a different sku could
// be attached, corrupting which sku's costing the lot is tied to. Lot has no
// (tenant_id, sku_id, id) unique to FK against, so this is a guard (mirrors
// assertSkuBelongsToProduct). The (tenant_id, lot_id) composite FK separately
// guarantees the lot is in this tenant.
async function assertLotBelongsToSku(
  tx: TenantTransaction,
  lotId: string,
  skuId: string
): Promise<void> {
  const item = (
    await tx
      .select({ id: schema.lot.id })
      .from(schema.lot)
      .where(and(eq(schema.lot.id, lotId), eq(schema.lot.skuId, skuId)))
      .limit(1)
  ).at(0);
  if (!item) {
    throw new ORPCError("NOT_FOUND", {
      message: "Lot not found in this tenant/SKU",
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

// ── POS — Minimum Sellable POS (Phase 4 commit 2) ───────────────────────────
// The cashier workflow: ring up products → tender → stock deduction +
// applyValuation (#8, records COGS) → invoice + receipt-number, idempotent
// end-to-end. Returns/refunds, shift/cash, split/multi-currency, offline queue
// are later commits — the seams are reserved (event-map-phase4.md).

// skuId is REQUIRED on every sale line (Codex CRITICAL — the #8 fix): valuation
// cells (avg_cost / valuation_layer) are SKU×location, so a product-only line
// has no cell to value and would silently skip applyValuation. The event-map
// also lists skuId as a required per-line ID.
interface MspLineInput {
  productId: string;
  qty: number;
  skuId: string;
  unitPriceMinor?: number;
}
interface PricedLine {
  productId: string;
  qty: number;
  skuId: string;
  unitPriceMinor: number;
}
type TenderMethod = (typeof schema.TENDER_METHODS)[number];
interface TenderInput {
  amountMinor: number;
  currency: string;
  method: TenderMethod;
}
interface SettledTender extends TenderInput {
  changeMinor: number | null;
  settledAmountMinor: number;
}

// Location must exist in the tenant (RLS-scoped read — FK checks bypass RLS) AND
// be sellable (INV-P4-7): a sale cannot ring against a non-sellable location
// (bonded / in-transit / quarantine / damaged).
async function assertSaleLocation(tx: TenantTransaction, locationId: string) {
  const row = (
    await tx
      .select({
        id: schema.location.id,
        companyId: schema.location.companyId,
        isSellable: schema.location.isSellable,
      })
      .from(schema.location)
      .where(eq(schema.location.id, locationId))
      .limit(1)
  ).at(0);
  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: "Location not found in this tenant",
    });
  }
  if (!row.isSellable) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Location is not sellable (INV-P4-7)",
    });
  }
  return row;
}

// Validate + price each line. SKU is REQUIRED for inventory-tracked products
// (INV-P4-8) — valuation/COGS is SKU-level, so applyValuation needs a sku. All
// lines must share one currency/scale (addMoney enforces it).
async function priceMspLines(
  tx: TenantTransaction,
  products: ProductRow[],
  lines: MspLineInput[]
): Promise<{
  priced: PricedLine[];
  subtotal: ReturnType<typeof services.money>;
}> {
  const byId = new Map(products.map((p) => [p.id, p]));
  const priced: PricedLine[] = [];
  let subtotal: ReturnType<typeof services.money> | null = null;
  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product) {
      throw new ORPCError("NOT_FOUND", {
        message: `Product ${line.productId} not found in this tenant`,
      });
    }
    // skuId is required on EVERY line (INV-P4-8 + the #8 fix). Validate it is in
    // this tenant (RLS-scoped) AND belongs to this product (the H1 tuple check).
    await assertSkuVisible(tx, line.skuId);
    await assertSkuBelongsToProduct(tx, line.skuId, line.productId);
    const unit = services.money(
      line.unitPriceMinor ?? product.priceMinor,
      product.currency,
      product.scale
    );
    const lineTotal = services.multiplyMoney(unit, line.qty);
    subtotal = subtotal ? services.addMoney(subtotal, lineTotal) : lineTotal;
    priced.push({
      productId: product.id,
      qty: line.qty,
      skuId: line.skuId,
      unitPriceMinor: unit.minor,
    });
  }
  if (!subtotal) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Sale must have at least one line",
    });
  }
  return { priced, subtotal };
}

// Settle tenders against the sale total (single-currency MSP). Underpayment is
// rejected; overpayment is returned as cash change (so a cash tender must exist
// to give it from — you cannot give change on a card).
function settleTenders(
  tenders: TenderInput[],
  total: ReturnType<typeof services.money>
): SettledTender[] {
  for (const t of tenders) {
    if (t.currency !== total.currency) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Multi-currency tenders are not supported yet (MSP single-currency)",
      });
    }
  }
  const tendered = tenders.reduce((sum, t) => sum + t.amountMinor, 0);
  if (tendered < total.minor) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Underpayment: tendered amount is less than the sale total",
    });
  }
  const settled: SettledTender[] = tenders.map((t) => ({
    ...t,
    changeMinor: null,
    settledAmountMinor: t.amountMinor,
  }));
  // Overpayment is returned as cash change. Change may ONLY come from cash and
  // is bounded by the cash actually tendered (Codex HIGH) — you cannot give
  // change on a card, and settled = amount − change can never go negative. The
  // change is drawn down across the cash tenders in order.
  let change = tendered - total.minor;
  if (change > 0) {
    const cashTendered = settled
      .filter((t) => t.method === "cash")
      .reduce((sum, t) => sum + t.amountMinor, 0);
    if (change > cashTendered) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Change due exceeds the cash tendered — non-cash overpayment cannot be refunded as change",
      });
    }
    for (const t of settled) {
      if (change === 0) {
        break;
      }
      if (t.method !== "cash") {
        continue;
      }
      const fromThis = Math.min(change, t.amountMinor);
      t.changeMinor = fromThis;
      t.settledAmountMinor = t.amountMinor - fromThis;
      change -= fromThis;
    }
  }
  return settled;
}

type SaleRow = typeof schema.sale.$inferSelect;

// One sale line: insert it, deduct stock through the ledger (the only mutator),
// run applyValuation (#8 — consumes FIFO layers / reduces AVCO value, returns
// COGS), and STAMP the COGS back onto the line. The ledger stays policy-neutral
// (no hard oversell block — D5 default allow-oversell-with-flagging); a negative
// on-hand emits inventory.stock_discrepancy for manager review.
async function processSaleLine(
  tx: TenantTransaction,
  ctx: RequestContext,
  opts: {
    idempotencyKey: string;
    line: PricedLine;
    locationId: string;
    sale: SaleRow;
  }
) {
  const saleLine = firstOrThrow(
    (
      await tx
        .insert(schema.saleLine)
        .values({
          tenantId: ctx.tenantId,
          saleId: opts.sale.id,
          productId: opts.line.productId,
          skuId: opts.line.skuId,
          qty: opts.line.qty,
          qtyBase: opts.line.qty,
          unitPriceMinor: opts.line.unitPriceMinor,
        })
        .returning()
    ).at(0)
  );
  const movement = await services.appendStockMovement(tx, ctx, {
    idempotencyKey: opts.idempotencyKey,
    locationId: opts.locationId,
    movementType: "sale",
    productId: opts.line.productId,
    qtyDelta: -opts.line.qty,
    refId: opts.sale.id,
    refType: "sale",
    skuId: opts.line.skuId,
  });
  // #8 — the write path MUST invoke valuation, UNCONDITIONALLY (skuId is always
  // present): consume FIFO layers / reduce AVCO value and STAMP the COGS back
  // onto the line. A line is never written without its valuation.
  const valuation = await services.applyValuation(tx, ctx, movement);
  const cogsMinor = valuation.cogsMinor;
  const cogsCurrency = valuation.currency;
  const cogsScale = valuation.scale;
  const costingMethodApplied = valuation.method;
  await tx
    .update(schema.saleLine)
    .set({ cogsMinor, cogsCurrency, cogsScale, costingMethodApplied })
    .where(eq(schema.saleLine.id, saleLine.id));
  if (movement.balanceAfter < 0) {
    await services.emitEvent(tx, ctx, {
      type: services.DomainEventType.InventoryStockDiscrepancy,
      payload: {
        deltaBase: movement.balanceAfter,
        idempotencyKey: opts.idempotencyKey,
        locationId: opts.locationId,
        productId: opts.line.productId,
        qtySold: opts.line.qty,
        reason: "oversell",
        resultingOnHand: movement.balanceAfter,
        saleId: opts.sale.id,
        source: "oversell",
        sourceMovementId: movement.id,
      },
    });
  }
  // Event-line shaped for the Phase-5 GL consumer (event-map-phase4.md). The
  // functional-currency + commission fields are reserved present-but-null
  // (single-currency MSP; populated when those models land — additive).
  return {
    eventLine: {
      cogsCurrency,
      cogsFunctionalMinor: null,
      cogsMinor,
      cogsScale,
      costingMethodApplied,
      lineCommissionFunctionalMinor: null,
      lineCommissionMinor: null,
      lineDiscountMinor: 0,
      lineTaxMinor: 0,
      lotId: null,
      productId: opts.line.productId,
      qtyBase: opts.line.qty,
      qtyScale: null,
      saleLineId: saleLine.id,
      skuId: opts.line.skuId,
      taxRateId: null,
      unitPriceMinor: opts.line.unitPriceMinor,
    },
  };
}

// Sequential, gapless document numbers per tenant (single-node allocator; the
// distributed/offline lease allocator is a later commit). Advisory-locked.
async function allocateSaleNumber(tx: TenantTransaction, tenantId: string) {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`docnum:${tenantId}`}, 0))`
  );
  const saleSeq =
    ((await tx.select({ c: count() }).from(schema.sale)).at(0)?.c ?? 0) + 1;
  const invoiceSeq =
    ((await tx.select({ c: count() }).from(schema.invoice)).at(0)?.c ?? 0) + 1;
  return { saleNumber: `SALE-${saleSeq}`, invoiceNumber: `INV-${invoiceSeq}` };
}

async function runCreateSaleMsp(
  tx: TenantTransaction,
  ctx: RequestContext,
  input: {
    customerId?: string;
    // Set only when this sale is the outbound leg of an exchange (shared with the
    // paired return — event-map "Exchange flow"); null for a standalone sale.
    exchangeGroupId?: string;
    idempotencyKey: string;
    lines: MspLineInput[];
    locationId: string;
    salesRepId?: string;
    shiftId?: string;
    tenders: TenderInput[];
  }
) {
  const location = await assertSaleLocation(tx, input.locationId);
  const products = await tx
    .select()
    .from(schema.product)
    .where(
      inArray(
        schema.product.id,
        input.lines.map((line) => line.productId)
      )
    );
  const { priced, subtotal } = await priceMspLines(tx, products, input.lines);
  const settled = settleTenders(input.tenders, subtotal);
  const { saleNumber, invoiceNumber } = await allocateSaleNumber(
    tx,
    ctx.tenantId
  );

  const sale = firstOrThrow(
    (
      await tx
        .insert(schema.sale)
        .values({
          createdBy: ctx.actorUserId,
          currency: subtotal.currency,
          customerId: input.customerId ?? null,
          discountMinor: 0,
          exchangeGroupId: input.exchangeGroupId ?? null,
          idempotencyKey: input.idempotencyKey,
          locationId: input.locationId,
          number: saleNumber,
          saleType: "sale",
          salesRepId: input.salesRepId ?? null,
          scale: subtotal.scale,
          shiftId: input.shiftId ?? null,
          status: "completed",
          subtotalMinor: subtotal.minor,
          taxMinor: 0,
          tenantId: ctx.tenantId,
          totalMinor: subtotal.minor,
        })
        .returning()
    ).at(0)
  );

  const eventLines: unknown[] = [];
  for (const line of priced) {
    const { eventLine } = await processSaleLine(tx, ctx, {
      idempotencyKey: input.idempotencyKey,
      line,
      locationId: input.locationId,
      sale,
    });
    eventLines.push(eventLine);
  }

  const eventTenders: unknown[] = [];
  for (const t of settled) {
    const tenderRow = firstOrThrow(
      (
        await tx
          .insert(schema.tender)
          .values({
            amountMinor: t.amountMinor,
            changeMinor: t.changeMinor,
            createdBy: ctx.actorUserId,
            currency: t.currency,
            method: t.method,
            saleId: sale.id,
            scale: subtotal.scale,
            settledAmountMinor: t.settledAmountMinor,
            tenantId: ctx.tenantId,
          })
          .returning()
      ).at(0)
    );
    eventTenders.push({
      amountMinor: t.amountMinor,
      fxRateToSale: null,
      method: t.method,
      settledAmountMinor: t.settledAmountMinor,
      settledFunctionalMinor: null,
      tenderCurrency: t.currency,
      tenderId: tenderRow.id,
      tenderScale: subtotal.scale,
    });
    // payment.received — the tender settling against the sale (event-map-phase4).
    await services.emitEvent(tx, ctx, {
      type: services.DomainEventType.PaymentReceived,
      payload: {
        amountFunctionalMinor: null,
        amountMinor: t.amountMinor,
        changeFunctionalMinor: null,
        changeMinor: t.changeMinor,
        commissionAccrualPolicy: null,
        commissionFunctionalMinor: null,
        commissionMinor: null,
        companyId: location.companyId,
        fxRateToSale: null,
        functionalCurrency: null,
        functionalScale: null,
        locationId: input.locationId,
        method: t.method,
        paymentId: tenderRow.id,
        realizedFxGainLossFunctionalMinor: null,
        receivedBy: ctx.actorUserId,
        saleCurrency: subtotal.currency,
        saleId: sale.id,
        saleScale: subtotal.scale,
        settledAmountMinor: t.settledAmountMinor,
        settledFunctionalMinor: null,
        shiftId: input.shiftId ?? null,
        tenderCurrency: t.currency,
        tenderFxRateToFunctional: null,
        tenderId: tenderRow.id,
        tenderScale: subtotal.scale,
      },
    });
  }

  const invoice = firstOrThrow(
    (
      await tx
        .insert(schema.invoice)
        .values({
          currency: subtotal.currency,
          number: invoiceNumber,
          saleId: sale.id,
          scale: subtotal.scale,
          tenantId: ctx.tenantId,
          totalMinor: subtotal.minor,
        })
        .returning()
    ).at(0)
  );

  await services.recordAudit(tx, ctx, {
    action: "pos.create_sale",
    entityType: "sale",
    entityId: sale.id,
    after: sale,
  });
  // sale.created — extended payload shaped for the Phase-5 GL consumer
  // (event-map-phase4.md). Functional-currency + commission fields reserved
  // present-but-null (single-currency MSP; additive when those models land).
  await services.emitEvent(tx, ctx, {
    type: services.DomainEventType.SaleCreated,
    payload: {
      commissionAccrualPolicy: null,
      commissionFunctionalMinor: null,
      commissionMinor: null,
      companyId: location.companyId,
      createdBy: ctx.actorUserId,
      currency: subtotal.currency,
      customerId: input.customerId ?? null,
      discountFunctionalMinor: null,
      discountMinor: 0,
      exchangeGroupId: input.exchangeGroupId ?? null,
      functionalCurrency: null,
      functionalScale: null,
      fxRateToFunctional: null,
      lines: eventLines,
      locationId: input.locationId,
      number: saleNumber,
      // Offline-origin envelope (event-map-phase4.md, locked) — reserved
      // present-but-null for the online MSP; populated when the offline queue
      // (a later commit) carries device/terminal/counter/clock metadata. Absent
      // → present later would be a breaking contract change (Codex HIGH).
      offline: {
        deviceId: null,
        terminalId: null,
        monotonicCounter: null,
        localTs: null,
        payloadVersion: null,
      },
      saleId: sale.id,
      saleType: "sale",
      salesRepId: input.salesRepId ?? null,
      scale: subtotal.scale,
      shiftId: input.shiftId ?? null,
      subtotalFunctionalMinor: null,
      subtotalMinor: subtotal.minor,
      taxBreakdown: [],
      taxFunctionalMinor: null,
      taxMinor: 0,
      tenders: eventTenders,
      totalFunctionalMinor: null,
      totalMinor: subtotal.minor,
    },
  });

  return {
    changeMinor: settled.reduce((sum, t) => sum + (t.changeMinor ?? 0), 0),
    currency: subtotal.currency,
    invoiceId: invoice.id,
    number: saleNumber,
    saleId: sale.id,
    scale: subtotal.scale,
    tenders: eventTenders,
    totalMinor: subtotal.minor,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Commit 3 — Returns / Refunds / Voids / Exchanges (event-map-phase4.md).
// A return is a FIRST-CLASS sale variant (saleType="return", originalSaleId),
// stored with NEGATIVE money (a credit, so reports net automatically). It reuses
// every MSP primitive; the ONLY costing touch is the value-exact restock below.
// ─────────────────────────────────────────────────────────────────────────────
type SaleLineRow = typeof schema.saleLine.$inferSelect;

interface RefundLineInput {
  originalSaleLineId: string;
  qty: number;
}

// Lock the original sale row (SELECT … FOR UPDATE) BEFORE any status / refunded-
// qty guard, so two concurrent refunds/voids serialize and the already-refunded
// check can't be raced (Phase-3 commit-3 HIGH-1 + the over-refund TOCTOU). RLS
// scopes the read to the tenant, so another tenant's sale returns nothing.
async function loadSaleForUpdate(tx: TenantTransaction, saleId: string) {
  return (
    await tx
      .select()
      .from(schema.sale)
      .where(eq(schema.sale.id, saleId))
      .for("update")
  ).at(0);
}

// Company of a location, RLS-scoped, WITHOUT the sellable gate — a refund/void
// reverses a historical sale and must succeed even if the location later became
// non-sellable (the forward sale already proved it sellable). A new sale leg
// still goes through assertSaleLocation.
async function loadLocationCompany(tx: TenantTransaction, locationId: string) {
  const row = (
    await tx
      .select({
        companyId: schema.location.companyId,
        id: schema.location.id,
      })
      .from(schema.location)
      .where(eq(schema.location.id, locationId))
      .limit(1)
  ).at(0);
  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: "Location not found in this tenant",
    });
  }
  return row;
}

function requireCogsStamp(originalLine: SaleLineRow) {
  const { cogsMinor, cogsCurrency, cogsScale, costingMethodApplied } =
    originalLine;
  if (cogsMinor == null || cogsCurrency == null || cogsScale == null) {
    throw new ORPCError("BAD_REQUEST", {
      message:
        "Original sale line has no COGS stamp — only #8-valued sale lines can be returned",
    });
  }
  // Own guard so TS narrows the text column to the CostingMethod union.
  if (costingMethodApplied !== "avco" && costingMethodApplied !== "fifo") {
    throw new ORPCError("BAD_REQUEST", {
      message: `Original sale line has an unknown costing method: ${costingMethodApplied}`,
    });
  }
  // The text column is `string`; the runtime guard above proves it is the union.
  return {
    cogsCurrency,
    cogsMinor,
    cogsScale,
    method: costingMethodApplied as "avco" | "fifo",
  };
}

// Restock one returned line's quantity, landing EXACTLY the value the original
// sale removed back into the SKU's valuation cell. #8 discipline: the write path
// MUST invoke valuation — but a positive (restock) movement would be a *receipt*
// to applyValuation (needs a fresh cost); instead we reuse the value-EXACT lander
// `applyTransferInValuation` (the frozen transfer primitive), which lands EXACTLY
// V with the movement's qty and stamps costing_method_applied. `restockedValue`
// is DERIVED from the ORIGINAL line's stamped COGS (event-map HIGH-4),
// proportional to refundQty via mulDivRound — NEVER from applyValuation on the
// restock leg (it returns cogsMinor:0 there). Returns the derived value triple.
async function restockReturnedLine(
  tx: TenantTransaction,
  ctx: RequestContext,
  opts: {
    alreadyRefunded: number;
    docId: string;
    idempotencyKey: string;
    locationId: string;
    originalLine: SaleLineRow;
    refType: string;
    refundQty: number;
  }
) {
  const { alreadyRefunded, originalLine, refundQty } = opts;
  const { cogsCurrency, cogsMinor, cogsScale, method } =
    requireCogsStamp(originalLine);
  // Cumulative-difference proportional split (Codex HIGH-2): value THIS refund as
  // the cumulative target for (alreadyRefunded + refundQty) units MINUS the target
  // for alreadyRefunded units. Summed across all partial refunds of a line this
  // equals EXACTLY the original stamped cogsMinor — no per-refund rounding drift
  // (three qty-1 refunds of cogsMinor=101/qty=3 restock 34+33+34=101, not 3×34).
  // The refund that completes the line restores the exact remainder. (Same exact-
  // conservation pattern as the Phase-3 bond-release F3 proportional split.)
  const before = Number(
    services.mulDivRound(
      cogsMinor,
      alreadyRefunded,
      originalLine.qty,
      "half_even"
    )
  );
  const after = Number(
    services.mulDivRound(
      cogsMinor,
      alreadyRefunded + refundQty,
      originalLine.qty,
      "half_even"
    )
  );
  const restockedValueMinor = after - before;
  const movement = await services.appendStockMovement(tx, ctx, {
    idempotencyKey: opts.idempotencyKey,
    locationId: opts.locationId,
    lotId: originalLine.lotId,
    movementType: "return",
    productId: originalLine.productId,
    qtyDelta: refundQty,
    refId: opts.docId,
    refType: opts.refType,
    skuId: originalLine.skuId,
  });
  // FIFO value-exact split may need a SECOND distinct anchor movement when the
  // value isn't divisible by qty — UNIQUE(tenant_id, source_movement_id) on the
  // valuation layer forbids two layers sharing one movement id (the same trick
  // the transfer uses with its paired leg). A qtyDelta:0 companion gives a
  // collision-free, return-specific anchor. Created only when actually needed.
  let remainderAnchorMovementId: string | null = null;
  if (method === "fifo" && restockedValueMinor % refundQty !== 0) {
    const anchor = await services.appendStockMovement(tx, ctx, {
      idempotencyKey: opts.idempotencyKey,
      locationId: opts.locationId,
      lotId: originalLine.lotId,
      movementType: "return",
      productId: originalLine.productId,
      qtyDelta: 0,
      refId: opts.docId,
      refType: `${opts.refType}_remainder_anchor`,
      skuId: originalLine.skuId,
    });
    remainderAnchorMovementId = anchor.id;
  }
  await services.applyTransferInValuation(tx, ctx, movement, {
    currency: cogsCurrency,
    method,
    remainderAnchorMovementId,
    scale: cogsScale,
    valueMinor: restockedValueMinor,
  });
  return {
    cogsCurrency,
    cogsScale,
    costingMethodApplied: method,
    restockedValueMinor,
  };
}

// Sequential return/credit-note doc number (RET-N), serialized on the same
// per-tenant advisory lock as sale numbering. The fiscal credit-note document is
// a later fiscal seam; this is the operational doc number.
async function allocateReturnNumber(tx: TenantTransaction, tenantId: string) {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`docnum:${tenantId}`}, 0))`
  );
  const n =
    ((
      await tx
        .select({ c: count() })
        .from(schema.sale)
        .where(eq(schema.sale.saleType, "return"))
    ).at(0)?.c ?? 0) + 1;
  return `RET-${n}`;
}

// Raw refund runner (the router wraps it in permission + idempotency; the
// exchange calls it directly inside ONE idempotency boundary). exchangeGroupId is
// set only for an exchange's inbound leg (then no disbursement tenders — the
// credit offsets the new purchase; net settlement is P5's via the shared group).
async function runRefund(
  tx: TenantTransaction,
  ctx: RequestContext,
  input: {
    doNotRestock?: boolean;
    idempotencyKey: string;
    lines: RefundLineInput[];
    originalSaleId: string;
    refundReason?: string;
    tenders: TenderInput[];
  },
  exchangeGroupId: string | null
) {
  const original = await loadSaleForUpdate(tx, input.originalSaleId);
  if (!original) {
    throw new ORPCError("NOT_FOUND", {
      message: "Original sale not found in this tenant",
    });
  }
  if (original.saleType !== "sale") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Only a sale can be refunded (not a return/exchange doc)",
    });
  }
  if (original.status !== "completed") {
    throw new ORPCError("BAD_REQUEST", {
      message: `Sale is not refundable (status: ${original.status})`,
    });
  }
  const location = await loadLocationCompany(tx, original.locationId);

  const originalLines = await tx
    .select()
    .from(schema.saleLine)
    .where(eq(schema.saleLine.saleId, original.id));
  const lineById = new Map(originalLines.map((l) => [l.id, l]));

  // Already-refunded qty per original line (under the FOR UPDATE lock above).
  const refundedRows = await tx
    .select({
      olid: schema.saleLine.originalSaleLineId,
      refunded: sql<number>`COALESCE(SUM(${schema.saleLine.qty}), 0)::int`,
    })
    .from(schema.saleLine)
    .where(
      inArray(
        schema.saleLine.originalSaleLineId,
        originalLines.map((l) => l.id)
      )
    )
    .groupBy(schema.saleLine.originalSaleLineId);
  const refundedByLine = new Map(
    refundedRows.map((r) => [r.olid, Number(r.refunded)])
  );

  // Aggregate requested qty per original line FIRST (Codex HIGH-1): two entries
  // with the same originalSaleLineId in ONE request must be summed before the
  // over-refund check — otherwise each independently sees the same `already` and
  // both pass, double-restocking. One return line + one restock per original line.
  const requestedByLine = new Map<string, number>();
  for (const rl of input.lines) {
    requestedByLine.set(
      rl.originalSaleLineId,
      (requestedByLine.get(rl.originalSaleLineId) ?? 0) + rl.qty
    );
  }

  // Validate every (aggregated) refund line BEFORE writing anything. `already`
  // (refunded before this request) is carried through for the HIGH-2 cumulative-
  // difference restock split.
  const validated = Array.from(requestedByLine.entries()).map(
    ([originalSaleLineId, refundQty]) => {
      const originalLine = lineById.get(originalSaleLineId);
      if (!originalLine) {
        throw new ORPCError("NOT_FOUND", {
          message: `Original sale line ${originalSaleLineId} does not belong to this sale`,
        });
      }
      const already = refundedByLine.get(originalLine.id) ?? 0;
      if (refundQty > originalLine.qty - already) {
        throw new ORPCError("BAD_REQUEST", {
          message: `Over-refund: line ${originalLine.id} has ${originalLine.qty - already} of ${originalLine.qty} refundable`,
        });
      }
      return { already, originalLine, refundQty };
    }
  );

  const currency = original.currency;
  const scale = original.scale;
  const refundTotalMagnitude = validated.reduce(
    (sum, v) => sum + v.originalLine.unitPriceMinor * v.refundQty,
    0
  );

  // Refund tenders = money returned to the customer. A standalone refund MUST be
  // fully tendered back; an exchange's inbound leg carries NO disbursement (the
  // credit offsets the outbound sale — net settlement is P5's, via the group).
  const tenderedBack = input.tenders.reduce((s, t) => s + t.amountMinor, 0);
  if (exchangeGroupId) {
    if (input.tenders.length > 0) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Exchange return leg carries no disbursement tenders (credit offsets the new sale)",
      });
    }
  } else if (tenderedBack !== refundTotalMagnitude) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Refund tenders must equal the refunded amount",
    });
  }
  for (const t of input.tenders) {
    if (t.currency !== currency) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Multi-currency refund tenders are not supported yet",
      });
    }
  }

  const number = await allocateReturnNumber(tx, ctx.tenantId);
  // Return doc — NEGATIVE money (a credit; reports net automatically).
  const returnSale = firstOrThrow(
    (
      await tx
        .insert(schema.sale)
        .values({
          createdBy: ctx.actorUserId,
          currency,
          discountMinor: 0,
          exchangeGroupId,
          idempotencyKey: input.idempotencyKey,
          locationId: original.locationId,
          number,
          originalSaleId: original.id,
          saleType: "return",
          scale,
          status: "completed",
          subtotalMinor: -refundTotalMagnitude,
          taxMinor: 0,
          tenantId: ctx.tenantId,
          totalMinor: -refundTotalMagnitude,
        })
        .returning()
    ).at(0)
  );

  const eventLines: unknown[] = [];
  for (const { already, originalLine, refundQty } of validated) {
    let restocked = {
      cogsCurrency: originalLine.cogsCurrency,
      cogsScale: originalLine.cogsScale,
      costingMethodApplied: originalLine.costingMethodApplied,
      restockedValueMinor: 0,
    };
    if (!input.doNotRestock) {
      restocked = await restockReturnedLine(tx, ctx, {
        alreadyRefunded: already,
        docId: returnSale.id,
        idempotencyKey: input.idempotencyKey,
        locationId: original.locationId,
        originalLine,
        refType: "return",
        refundQty,
      });
    }
    const returnLine = firstOrThrow(
      (
        await tx
          .insert(schema.saleLine)
          .values({
            cogsCurrency: restocked.cogsCurrency,
            cogsMinor: restocked.restockedValueMinor,
            cogsScale: restocked.cogsScale,
            costingMethodApplied: restocked.costingMethodApplied,
            lotId: originalLine.lotId,
            originalSaleLineId: originalLine.id,
            productId: originalLine.productId,
            qty: refundQty,
            qtyBase: refundQty,
            saleId: returnSale.id,
            skuId: originalLine.skuId,
            tenantId: ctx.tenantId,
            unitPriceMinor: originalLine.unitPriceMinor,
          })
          .returning()
      ).at(0)
    );
    eventLines.push({
      costingMethodApplied: restocked.costingMethodApplied,
      cogsCurrency: restocked.cogsCurrency,
      cogsScale: restocked.cogsScale,
      lineCommissionClawbackFunctionalMinor: null,
      lineCommissionClawbackMinor: null,
      lotId: originalLine.lotId,
      originalSaleLineId: originalLine.id,
      productId: originalLine.productId,
      qtyBase: refundQty,
      restockedValueFunctionalMinor: null,
      restockedValueMinor: restocked.restockedValueMinor,
      restockLocationId: input.doNotRestock ? null : original.locationId,
      saleLineId: returnLine.id,
      skuId: originalLine.skuId,
      lineTaxMinor: 0,
      taxRateId: null,
      unitPriceMinor: originalLine.unitPriceMinor,
    });
  }

  const eventTenders: unknown[] = [];
  for (const t of input.tenders) {
    const tenderRow = firstOrThrow(
      (
        await tx
          .insert(schema.tender)
          .values({
            amountMinor: t.amountMinor,
            changeMinor: null,
            createdBy: ctx.actorUserId,
            currency: t.currency,
            method: t.method,
            saleId: returnSale.id,
            scale,
            settledAmountMinor: t.amountMinor,
            tenantId: ctx.tenantId,
          })
          .returning()
      ).at(0)
    );
    eventTenders.push({
      amountMinor: t.amountMinor,
      fxRateToSale: null,
      method: t.method,
      settledAmountMinor: t.amountMinor,
      settledFunctionalMinor: null,
      tenderCurrency: t.currency,
      tenderId: tenderRow.id,
      tenderScale: scale,
    });
  }

  await services.recordAudit(tx, ctx, {
    action: "pos.refund",
    after: returnSale,
    entityId: returnSale.id,
    entityType: "sale",
  });
  await services.emitEvent(tx, ctx, {
    type: services.DomainEventType.SaleRefunded,
    payload: {
      commissionAccrualPolicy: null,
      commissionClawbackFunctionalMinor: null,
      commissionClawbackMinor: null,
      companyId: location.companyId,
      currency,
      discountMinor: 0,
      discountFunctionalMinor: null,
      exchangeGroupId,
      functionalCurrency: null,
      functionalScale: null,
      fxRateToFunctional: null,
      lines: eventLines,
      locationId: original.locationId,
      number,
      originalSaleId: original.id,
      refundReason: input.refundReason ?? null,
      refundedBy: ctx.actorUserId,
      saleId: returnSale.id,
      saleType: "return",
      scale,
      shiftId: original.shiftId,
      subtotalFunctionalMinor: null,
      subtotalMinor: refundTotalMagnitude,
      taxBreakdown: [],
      taxFunctionalMinor: null,
      taxMinor: 0,
      tenders: eventTenders,
      totalFunctionalMinor: null,
      totalMinor: refundTotalMagnitude,
    },
  });

  return {
    currency,
    locationId: original.locationId,
    number,
    saleId: returnSale.id,
    scale,
    totalMinor: -refundTotalMagnitude,
  };
}

// Raw void runner — full reversal of a whole, UN-refunded sale. Restocks every
// line, flips status to "void" (excluded from sales reports), emits sale.voided
// (parks on originalSaleId, no amounts). Distinct from a refund (partial/credit).
async function runVoid(
  tx: TenantTransaction,
  ctx: RequestContext,
  input: { idempotencyKey: string; saleId: string; voidReason?: string }
) {
  const sale = await loadSaleForUpdate(tx, input.saleId);
  if (!sale) {
    throw new ORPCError("NOT_FOUND", {
      message: "Sale not found in this tenant",
    });
  }
  if (sale.saleType !== "sale") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Only a sale can be voided (not a return/exchange doc)",
    });
  }
  if (sale.status === "void") {
    throw new ORPCError("BAD_REQUEST", { message: "Sale is already void" });
  }
  if (sale.status !== "completed") {
    throw new ORPCError("BAD_REQUEST", {
      message: `Sale is not voidable (status: ${sale.status})`,
    });
  }
  const location = await loadLocationCompany(tx, sale.locationId);
  const saleLines = await tx
    .select()
    .from(schema.saleLine)
    .where(eq(schema.saleLine.saleId, sale.id));
  // A sale that already has returns cannot be voided — voiding would restock the
  // already-restocked lines twice. Refund-then-void is rejected (use refunds).
  const priorReturns = (
    await tx
      .select({ c: count() })
      .from(schema.saleLine)
      .where(
        inArray(
          schema.saleLine.originalSaleLineId,
          saleLines.map((l) => l.id)
        )
      )
  ).at(0)?.c;
  if (Number(priorReturns ?? 0) > 0) {
    throw new ORPCError("BAD_REQUEST", {
      message:
        "Cannot void a sale that has returns — void is for un-refunded sales",
    });
  }

  for (const line of saleLines) {
    // A void targets an UN-refunded sale (rejected above if it has returns), so
    // alreadyRefunded is 0 and the full original cogsMinor restores exactly.
    await restockReturnedLine(tx, ctx, {
      alreadyRefunded: 0,
      docId: sale.id,
      idempotencyKey: input.idempotencyKey,
      locationId: sale.locationId,
      originalLine: line,
      refType: "void",
      refundQty: line.qty,
    });
  }

  await tx
    .update(schema.sale)
    .set({ status: "void" })
    .where(eq(schema.sale.id, sale.id));

  await services.recordAudit(tx, ctx, {
    action: "pos.void_sale",
    after: { status: "void", voidReason: input.voidReason ?? null },
    before: sale,
    entityId: sale.id,
    entityType: "sale",
  });
  await services.emitEvent(tx, ctx, {
    type: services.DomainEventType.SaleVoided,
    payload: {
      companyId: location.companyId,
      currency: sale.currency,
      locationId: sale.locationId,
      number: sale.number,
      originalSaleId: sale.id,
      saleId: sale.id,
      scale: sale.scale,
      shiftId: sale.shiftId,
      totalMinor: sale.totalMinor,
      voidReason: input.voidReason ?? null,
      voidedBy: ctx.actorUserId,
    },
  });

  return { saleId: sale.id, status: "void" as const };
}

// Raw exchange runner — decomposes into a linked return + sale sharing one
// exchangeGroupId (event-map "Exchange flow"; NOT a distinct event). The return
// leg credits + restocks the returned items (no disbursement); the sale leg
// charges the new items. Net cash settlement across the group is P5's concern.
async function runExchange(
  tx: TenantTransaction,
  ctx: RequestContext,
  input: {
    idempotencyKey: string;
    newLines: MspLineInput[];
    originalSaleId: string;
    refundReason?: string;
    returnLines: RefundLineInput[];
    tenders: TenderInput[];
  }
) {
  const exchangeGroupId = crypto.randomUUID();
  const refund = await runRefund(
    tx,
    ctx,
    {
      idempotencyKey: `${input.idempotencyKey}:return`,
      lines: input.returnLines,
      originalSaleId: input.originalSaleId,
      refundReason: input.refundReason,
      tenders: [],
    },
    exchangeGroupId
  );
  const sale = await runCreateSaleMsp(tx, ctx, {
    exchangeGroupId,
    idempotencyKey: `${input.idempotencyKey}:sale`,
    lines: input.newLines,
    locationId: refund.locationId,
    tenders: input.tenders,
  });
  await services.recordAudit(tx, ctx, {
    action: "pos.exchange",
    after: {
      exchangeGroupId,
      refundSaleId: refund.saleId,
      saleId: sale.saleId,
    },
    entityId: sale.saleId,
    entityType: "sale",
  });
  return { exchangeGroupId, refund, sale };
}

const refundLineSchema = z.object({
  originalSaleLineId: z.string().uuid(),
  qty: z.number().int().positive(),
});
const refundTenderSchema = z.object({
  amountMinor: z.number().int().min(0),
  currency: z.string().length(3),
  method: z.enum(schema.TENDER_METHODS),
});
const newLineSchema = z.object({
  productId: z.string().uuid(),
  skuId: z.string().uuid(),
  qty: z.number().int().positive(),
  unitPriceMinor: z.number().int().min(0).optional(),
});

export const posRouter = {
  createSale: tenantProcedure
    .input(
      z.object({
        locationId: z.string().uuid(),
        idempotencyKey: z.string().min(1),
        salesRepId: z.string().min(1).optional(),
        customerId: z.string().uuid().optional(),
        shiftId: z.string().uuid().optional(),
        lines: z
          .array(
            z.object({
              productId: z.string().uuid(),
              // skuId is REQUIRED (Codex CRITICAL / INV-P4-8): valuation is
              // SKU-level, so every sold line must carry a sku to be valued.
              skuId: z.string().uuid(),
              qty: z.number().int().positive(),
              unitPriceMinor: z.number().int().min(0).optional(),
            })
          )
          .min(1),
        tenders: z
          .array(
            z.object({
              method: z.enum(schema.TENDER_METHODS),
              currency: z.string().length(3),
              amountMinor: z.number().int().min(0),
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
          () => runCreateSaleMsp(tx, ctx, input)
        );
      });
    }),

  // First-class return (event-map sale.refunded). Partial allowed; restocks the
  // refunded value (derived from the original line's stamped COGS) — sensitive,
  // so it needs pos.refund (admin/manager), not the base cashier grant.
  refund: tenantProcedure
    .input(
      z.object({
        doNotRestock: z.boolean().optional(),
        idempotencyKey: z.string().min(1),
        lines: z.array(refundLineSchema).min(1),
        originalSaleId: z.string().uuid(),
        refundReason: z.string().optional(),
        tenders: z.array(refundTenderSchema),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.refund");
        return services.runIdempotent(
          tx,
          ctx,
          input.idempotencyKey,
          input,
          () => runRefund(tx, ctx, input, null)
        );
      });
    }),

  // Whole-sale void (event-map sale.voided) — full reversal of an un-refunded
  // sale; restocks every line and flips status to "void".
  void: tenantProcedure
    .input(
      z.object({
        idempotencyKey: z.string().min(1),
        saleId: z.string().uuid(),
        voidReason: z.string().optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.void_sale");
        return services.runIdempotent(
          tx,
          ctx,
          input.idempotencyKey,
          input,
          () => runVoid(tx, ctx, input)
        );
      });
    }),

  // Exchange = linked return + sale sharing an exchangeGroupId (event-map
  // "Exchange flow"). Needs BOTH refund + create-sale rights.
  exchange: tenantProcedure
    .input(
      z.object({
        idempotencyKey: z.string().min(1),
        newLines: z.array(newLineSchema).min(1),
        originalSaleId: z.string().uuid(),
        refundReason: z.string().optional(),
        returnLines: z.array(refundLineSchema).min(1),
        tenders: z.array(refundTenderSchema).min(1),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.refund");
        await assertPermission(tx, ctx, "pos.create_sale");
        return services.runIdempotent(
          tx,
          ctx,
          input.idempotencyKey,
          input,
          () => runExchange(tx, ctx, input)
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

// Phase 3 — stock transfers (quantity + value conservation, commits 2/3).
// Two-step intra-company transfer through the per-transfer in-transit node.

// Aggregate the per-line transfer value into a single top-level (value, currency,
// scale) — defined only when every valued line shares one currency/scale (a
// transfer is single-currency in practice; summing minor units across currencies
// is meaningless, §12). Returns nulls when there is no valued line or currencies
// differ. The per-line value is always carried losslessly on the event's `lines`.
function aggregateTransferValue(
  lineValues: {
    currency: string | null;
    scale: number | null;
    valueMinor: number | null;
  }[]
): {
  valueMinor: number | null;
  currency: string | null;
  scale: number | null;
} {
  const valued = lineValues.filter(
    (line) => line.currency != null && line.valueMinor != null
  );
  const first = valued.at(0);
  if (!first) {
    return { currency: null, scale: null, valueMinor: null };
  }
  const uniform = valued.every(
    (line) => line.currency === first.currency && line.scale === first.scale
  );
  if (!uniform) {
    return { currency: null, scale: null, valueMinor: null };
  }
  return {
    currency: first.currency,
    scale: first.scale,
    valueMinor: valued.reduce((sum, line) => sum + (line.valueMinor ?? 0), 0),
  };
}

export const transferRouter = {
  create: tenantProcedure
    .input(
      z.object({
        sourceLocationId: z.string().uuid(),
        destLocationId: z.string().uuid(),
        expectedReceiptDate: z.string().optional(),
        lines: z
          .array(
            z.object({
              productId: z.string().uuid(),
              skuId: z.string().uuid().optional(),
              lotId: z.string().uuid().optional(),
              qty: z.number().int().positive(),
            })
          )
          .min(1),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.transfer");
        // Belt-and-braces over the DB composite FKs (which already make a
        // cross-tenant / inter-company reference impossible).
        await assertLocationVisible(tx, input.sourceLocationId);
        await assertLocationVisible(tx, input.destLocationId);
        for (const line of input.lines) {
          await assertProductVisible(tx, line.productId);
          if (line.skuId) {
            // Not just visible — the SKU must belong to the line's product, or
            // the ledger would store productId=A while costing resolves from
            // SKU=B's cell (cross-cell value corruption). Mirrors
            // inventory.receive's assertSkuBelongsToProduct.
            await assertSkuBelongsToProduct(tx, line.skuId, line.productId);
          }
          if (line.lotId) {
            await assertLotVisible(tx, line.lotId);
          }
        }
        const { transfer, lines } = await services.createTransfer(tx, ctx, {
          sourceLocationId: input.sourceLocationId,
          destLocationId: input.destLocationId,
          expectedReceiptDate: input.expectedReceiptDate ?? null,
          lines: input.lines,
        });
        await services.emitEvent(tx, ctx, {
          type: services.DomainEventType.InventoryTransferCreated,
          payload: {
            transferId: transfer.id,
            companyId: transfer.companyId,
            number: transfer.number,
            sourceLocationId: transfer.sourceLocationId,
            destLocationId: transfer.destLocationId,
            inTransitLocationId: transfer.inTransitLocationId,
            expectedReceiptDate: transfer.expectedReceiptDate,
            lines: lines.map((l) => ({
              skuId: l.skuId,
              productId: l.productId,
              qtyBase: l.qty,
            })),
            createdBy: ctx.actorUserId,
          },
        });
        await services.recordAudit(tx, ctx, {
          action: "inventory.transfer.create",
          entityType: "stock_transfer",
          entityId: transfer.id,
          after: { transfer, lines },
        });
        return { transfer, lines };
      });
    }),
  ship: tenantProcedure
    .input(z.object({ transferId: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.transfer");
        const { transfer, lineValues } = await services.shipTransfer(
          tx,
          ctx,
          input.transferId
        );
        const released = aggregateTransferValue(lineValues);
        await services.emitEvent(tx, ctx, {
          type: services.DomainEventType.InventoryTransferDispatched,
          payload: {
            transferId: transfer.id,
            companyId: transfer.companyId,
            sourceLocationId: transfer.sourceLocationId,
            destLocationId: transfer.destLocationId,
            inTransitLocationId: transfer.inTransitLocationId,
            shippedAt: transfer.shippedAt,
            expectedReceiptDate: transfer.expectedReceiptDate,
            // Per-line exact released value V (the integer value that left
            // source) — value conservation contract (event-map INV-2).
            lines: lineValues.map((line) => ({
              skuId: line.skuId,
              productId: line.productId,
              qtyBase: line.qtyBase,
              releasedValueMinor: line.valueMinor,
              currency: line.currency,
              scale: line.scale,
              costingMethod: line.method,
            })),
            // Top-level aggregate (single-currency convenience; null if mixed).
            releasedValueMinor: released.valueMinor,
            currency: released.currency,
            scale: released.scale,
            dispatchedBy: ctx.actorUserId,
          },
        });
        await services.recordAudit(tx, ctx, {
          action: "inventory.transfer.ship",
          entityType: "stock_transfer",
          entityId: transfer.id,
          after: transfer,
        });
        return transfer;
      });
    }),
  receive: tenantProcedure
    .input(z.object({ transferId: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.transfer_receive");
        const { transfer, lineValues } = await services.receiveTransfer(
          tx,
          ctx,
          input.transferId
        );
        const received = aggregateTransferValue(lineValues);
        await services.emitEvent(tx, ctx, {
          type: services.DomainEventType.InventoryTransferReceived,
          payload: {
            transferId: transfer.id,
            companyId: transfer.companyId,
            sourceLocationId: transfer.sourceLocationId,
            destLocationId: transfer.destLocationId,
            actualReceiptDate: transfer.actualReceiptDate,
            // Per-line received value — MUST equal the dispatched releasedValue
            // per line (value conservation, event-map INV-2). varianceQtyBase is
            // reserved 0 (full-receive; receive-discrepancy is a deferred P1).
            lines: lineValues.map((line) => ({
              skuId: line.skuId,
              productId: line.productId,
              qtyBase: line.qtyBase,
              receivedValueMinor: line.valueMinor,
              currency: line.currency,
              scale: line.scale,
              costingMethod: line.method,
              varianceQtyBase: 0,
            })),
            receivedValueMinor: received.valueMinor,
            currency: received.currency,
            scale: received.scale,
            receivedBy: ctx.actorUserId,
          },
        });
        await services.recordAudit(tx, ctx, {
          action: "inventory.transfer.receive",
          entityType: "stock_transfer",
          entityId: transfer.id,
          after: transfer,
        });
        return transfer;
      });
    }),
  cancel: tenantProcedure
    .input(
      z.object({
        transferId: z.string().uuid(),
        reason: z.string().max(2000).optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.transfer");
        const { transfer, lineValues } = await services.cancelTransfer(
          tx,
          ctx,
          input.transferId
        );
        await services.emitEvent(tx, ctx, {
          type: services.DomainEventType.InventoryTransferCancelled,
          payload: {
            transferId: transfer.id,
            companyId: transfer.companyId,
            sourceLocationId: transfer.sourceLocationId,
            inTransitLocationId: transfer.inTransitLocationId,
            // Value returned to source when cancelling a SHIPPED transfer (empty
            // for a draft cancel, which moved nothing).
            lines: lineValues.map((line) => ({
              skuId: line.skuId,
              productId: line.productId,
              qtyBase: line.qtyBase,
              returnedValueMinor: line.valueMinor,
              currency: line.currency,
              scale: line.scale,
            })),
            reason: input.reason ?? null,
            cancelledBy: ctx.actorUserId,
          },
        });
        await services.recordAudit(tx, ctx, {
          action: "inventory.transfer.cancel",
          entityType: "stock_transfer",
          entityId: transfer.id,
          after: transfer,
        });
        return transfer;
      });
    }),
};

// Phase 3 commit 4 — bonded stock receiving (INV-3).
// Commit 5 adds bond release + duty. Both bond routers live here.
export const bondRouter = {
  receive: tenantProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        locationId: z.string().uuid(),
        supplierRef: z.string().max(500).optional(),
        customsReference: z.string().max(500).optional(),
        landedCostReference: z.string().max(500).optional(),
        receivedAt: z.string().datetime().optional(),
        lines: z
          .array(
            z.object({
              productId: z.string().uuid(),
              skuId: z.string().uuid(),
              lotId: z.string().uuid().optional(),
              qty: z.number().int().positive(),
              // Codex F5: bonded dutiable goods must carry a POSITIVE unit cost
              // (a 0 would create qty>0 with value=0 and zero the duty basis).
              unitCostMinor: z.number().int().positive(),
              costCurrency: z.string().length(3),
              costScale: z.number().int().min(0),
              customsReference: z.string().max(500).optional(),
              landedCostReference: z.string().max(500).optional(),
            })
          )
          .min(1),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "bond.receive");
        // Belt-and-braces guards over DB composite FKs (H1 cross-tenant class).
        await assertCompanyVisible(tx, input.companyId); // F2
        await assertLocationVisible(tx, input.locationId);
        for (const line of input.lines) {
          await assertProductVisible(tx, line.productId);
          await assertSkuBelongsToProduct(tx, line.skuId, line.productId);
          if (line.lotId) {
            // F3: lot must belong to this line's sku, not merely be visible.
            await assertLotBelongsToSku(tx, line.lotId, line.skuId);
          }
        }
        const { receipt, lines } = await services.createBondReceipt(tx, ctx, {
          companyId: input.companyId,
          locationId: input.locationId,
          supplierRef: input.supplierRef ?? null,
          customsReference: input.customsReference ?? null,
          landedCostReference: input.landedCostReference ?? null,
          receivedAt: input.receivedAt ? new Date(input.receivedAt) : null,
          lines: input.lines,
        });
        await services.emitEvent(tx, ctx, {
          type: services.DomainEventType.InventoryBondReceived,
          payload: {
            bondReceiptId: receipt.id,
            locationId: receipt.locationId,
            supplierRef: receipt.supplierRef,
            lines: lines.map((l) => ({
              skuId: l.skuId,
              productId: l.productId,
              qtyBase: l.qty,
              unitCostMinor: l.unitCostMinor,
              currency: l.costCurrency,
              scale: l.costScale,
              lotId: l.lotId,
              customsRef: l.customsReference,
              landedCostRef: l.landedCostReference,
            })),
            receivedBy: ctx.actorUserId,
          },
        });
        await services.recordAudit(tx, ctx, {
          action: "bond.receive",
          entityType: "bond_receipt",
          entityId: receipt.id,
          after: { receipt, lines },
        });
        return { receipt, lines };
      });
    }),

  // Phase 3 commit 5 — bond release + duty (INV-4/5). Release is RBAC-immediate:
  // it requires BOTH bond.release AND bond.approve_release (the deferred §22
  // request→approve workflow binds requestedBy/approvedBy additively later). The
  // release executes a bonded→released transfer (qty + value conserved, INV-2)
  // then a value-only duty/tax adjustment (intentional value-ADD, INV-5).
  release: tenantProcedure
    .input(
      z.object({
        bondReceiptId: z.string().uuid(),
        destLocationId: z.string().uuid(),
        lines: z
          .array(
            z.object({
              bondReceiptLineId: z.string().uuid(),
              qty: z.number().int().positive(),
              dutyMinor: z.number().int().min(0).optional(),
              taxMinor: z.number().int().min(0).optional(),
            })
          )
          .min(1),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        // RBAC-immediate: both permissions required for a one-call clearance.
        await assertPermission(tx, ctx, "bond.release");
        await assertPermission(tx, ctx, "bond.approve_release");
        // H1 cross-tenant class: validate every FK input with a tenant-scoped
        // read before the service inserts (FK checks bypass RLS). The composite
        // FKs on bond_release are the durable DB backstop; these give a clean
        // NOT_FOUND. bondReceiptId/bondReceiptLineId visibility is enforced by
        // the service's RLS-scoped loads + belong-to checks.
        await assertLocationVisible(tx, input.destLocationId);
        const { release, releaseLines, eventLines, transferId } =
          await services.executeBondRelease(tx, ctx, {
            bondReceiptId: input.bondReceiptId,
            destLocationId: input.destLocationId,
            lines: input.lines.map((l) => ({
              bondReceiptLineId: l.bondReceiptLineId,
              qty: l.qty,
              dutyMinor: l.dutyMinor ?? 0,
              taxMinor: l.taxMinor ?? 0,
            })),
          });
        await services.emitEvent(tx, ctx, {
          type: services.DomainEventType.InventoryBondReleased,
          payload: {
            bondReleaseId: release.id,
            bondReceiptId: release.bondReceiptId,
            transferId,
            sourceLocationId: release.sourceLocationId,
            destLocationId: release.destLocationId,
            lines: eventLines.map((l) => ({
              skuId: l.skuId,
              qtyBase: l.qtyBase,
              releasedValueMinor: l.releasedValueMinor,
              dutyMinor: l.dutyMinor,
              taxMinor: l.taxMinor,
              currency: l.currency,
              scale: l.scale,
            })),
            releasedBy: ctx.actorUserId,
            // RBAC-immediate: requestedBy/approvedBy default to the actor; the
            // §22 workflow binds distinct values additively later.
            requestedBy: ctx.actorUserId,
            approvedBy: ctx.actorUserId,
          },
        });
        await services.recordAudit(tx, ctx, {
          action: "bond.release",
          entityType: "bond_release",
          entityId: release.id,
          after: { release, releaseLines },
        });
        return { release, releaseLines, transferId };
      });
    }),
};
