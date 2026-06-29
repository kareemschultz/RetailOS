import { auth } from "@RetailOS/auth";
import type { TenantTransaction } from "@RetailOS/db";
import { db, schema, services, withTenant } from "@RetailOS/db";
import { ORPCError } from "@orpc/server";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  like,
  lte,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { aliasedTable } from "drizzle-orm/alias";
import { z } from "zod";
import { protectedProcedure, tenantProcedure } from "../index";
import type { RequestContext } from "../request-context";
import { slugify } from "../slug";

const fromUom = aliasedTable(schema.unitOfMeasure, "from_uom");
const toUom = aliasedTable(schema.unitOfMeasure, "to_uom");
const SEARCH_TERM_SEPARATOR = /\s+/;

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
  // Full admin location tree (NOT just POS-sellable nodes — stores, warehouses,
  // bonded, DCs, plus the structural zone/aisle/bin children and the in-transit
  // virtual nodes). Tenant-scoped (RLS); gated on reports.view (operational read,
  // every back-office role holds it; the cashier does not). Projects ONLY the
  // display-safe columns (DTO discipline — no cash-control toggles, removal
  // strategy, or capacity seams leave the API).
  list: tenantProcedure
    .input(
      z.object({
        companyId: z.string().uuid().optional(),
        includeArchived: z.boolean().default(false),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "reports.view");
        if (input.companyId) {
          await assertCompanyVisible(tx, input.companyId);
        }
        const conditions = [
          input.companyId
            ? eq(schema.location.companyId, input.companyId)
            : null,
          input.includeArchived ? null : isNull(schema.location.deletedAt),
        ].filter((condition): condition is SQL => condition != null);
        return tx
          .select({
            id: schema.location.id,
            companyId: schema.location.companyId,
            name: schema.location.name,
            type: schema.location.type,
            parentLocationId: schema.location.parentLocationId,
            isSellable: schema.location.isSellable,
            isQuarantine: schema.location.isQuarantine,
            isBonded: schema.location.isBonded,
            isTransit: schema.location.isTransit,
            createdAt: schema.location.createdAt,
          })
          .from(schema.location)
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(schema.location.name);
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
  // Catalog list for the admin/manager Products screen. Projects ONLY display-safe
  // columns (no costing_method / policies / internal config leave the API) — the
  // DTO discipline (render DTOs, not raw rows). Tenant-scoped (RLS); gated on the
  // same catalog-management permission as `list` (there is no separate
  // products.view in the VS#1 role model).
  catalog: tenantProcedure
    .input(z.object({ q: z.string().optional() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const conditions: SQL[] = [isNull(schema.product.deletedAt)];
        if (input.q) {
          const term = `%${input.q}%`;
          const search = or(
            ilike(schema.product.name, term),
            ilike(schema.product.sku, term)
          );
          if (search) {
            conditions.push(search);
          }
        }
        const rows = await tx
          .select({
            id: schema.product.id,
            sku: schema.product.sku,
            name: schema.product.name,
            trackingMode: schema.product.trackingMode,
            priceMinor: schema.product.priceMinor,
            currency: schema.product.currency,
            scale: schema.product.scale,
          })
          .from(schema.product)
          .where(and(...conditions));
        const productIds = rows.map((row) => row.id);
        const imageRows =
          productIds.length === 0
            ? []
            : await tx
                .select({
                  altText: schema.productImage.altText,
                  productId: schema.productImage.productId,
                  url: schema.productImage.url,
                })
                .from(schema.productImage)
                .where(
                  and(
                    inArray(schema.productImage.productId, productIds),
                    eq(schema.productImage.isPrimary, true),
                    isNull(schema.productImage.deletedAt)
                  )
                );
        const primaryImageByProduct = new Map(
          imageRows.map((image) => [image.productId, image])
        );
        return rows.map((row) => {
          const primaryImage = primaryImageByProduct.get(row.id);
          return {
            ...row,
            primaryImageAltText: primaryImage?.altText ?? null,
            primaryImageUrl: primaryImage?.url ?? null,
          };
        });
      });
    }),
  detail: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const row = (
          await tx
            .select({
              currency: schema.product.currency,
              id: schema.product.id,
              name: schema.product.name,
              priceMinor: schema.product.priceMinor,
              scale: schema.product.scale,
              sku: schema.product.sku,
              trackingMode: schema.product.trackingMode,
            })
            .from(schema.product)
            .where(
              and(
                eq(schema.product.id, input.id),
                isNull(schema.product.deletedAt)
              )
            )
            .limit(1)
        ).at(0);
        if (!row) {
          throw new ORPCError("NOT_FOUND", {
            message: "Product not found in this tenant",
          });
        }
        const images = await tx
          .select({
            altText: schema.productImage.altText,
            id: schema.productImage.id,
            isPrimary: schema.productImage.isPrimary,
            sortOrder: schema.productImage.sortOrder,
            url: schema.productImage.url,
          })
          .from(schema.productImage)
          .where(
            and(
              eq(schema.productImage.productId, input.id),
              isNull(schema.productImage.deletedAt)
            )
          )
          .orderBy(
            desc(schema.productImage.isPrimary),
            schema.productImage.sortOrder,
            schema.productImage.createdAt
          );
        return { ...row, images };
      });
    }),
  imageCreate: tenantProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        url: z.string().url(),
        objectKey: z.string().min(1).optional(),
        altText: z.string().min(1).max(200).optional(),
        sortOrder: z.number().int().min(0).default(0),
        isPrimary: z.boolean().default(false),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const productRow = (
          await tx
            .select({ id: schema.product.id })
            .from(schema.product)
            .where(
              and(
                eq(schema.product.id, input.productId),
                isNull(schema.product.deletedAt)
              )
            )
            .for("update")
            .limit(1)
        ).at(0);
        if (!productRow) {
          throw new ORPCError("NOT_FOUND", {
            message: "Product not found in this tenant",
          });
        }
        if (input.isPrimary) {
          await tx
            .update(schema.productImage)
            .set({
              isPrimary: false,
              updatedBy: ctx.actorUserId,
            })
            .where(
              and(
                eq(schema.productImage.productId, input.productId),
                eq(schema.productImage.isPrimary, true),
                isNull(schema.productImage.deletedAt)
              )
            );
        }
        const row = firstOrThrow(
          (
            await tx
              .insert(schema.productImage)
              .values({
                tenantId: ctx.tenantId,
                productId: input.productId,
                url: input.url,
                objectKey: input.objectKey,
                altText: input.altText,
                sortOrder: input.sortOrder,
                isPrimary: input.isPrimary,
                createdBy: ctx.actorUserId,
                updatedBy: ctx.actorUserId,
              })
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "product.imageCreate",
          entityType: "product_image",
          entityId: row.id,
          after: row,
        });
        // Scrub the internal object-storage key from the client DTO; reads
        // (catalog/detail) already omit it, so the write response must too.
        return {
          id: row.id,
          url: row.url,
          altText: row.altText,
          sortOrder: row.sortOrder,
          isPrimary: row.isPrimary,
          createdAt: row.createdAt,
        };
      });
    }),
  imageSetPrimary: tenantProcedure
    .input(z.object({ imageId: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        // RLS scopes the lookup to this tenant; a cross-tenant imageId is
        // invisible and resolves to NOT_FOUND. Lock the target image row
        // FOR UPDATE so a concurrent imageDelete (which also locks this row)
        // is serialized — without it, a delete could slip between this read
        // and the promote below, leaving is_primary=true on a deleted row.
        const target = (
          await tx
            .select({
              id: schema.productImage.id,
              productId: schema.productImage.productId,
            })
            .from(schema.productImage)
            .where(
              and(
                eq(schema.productImage.id, input.imageId),
                isNull(schema.productImage.deletedAt)
              )
            )
            .for("update")
            .limit(1)
        ).at(0);
        if (!target) {
          throw new ORPCError("NOT_FOUND", {
            message: "Product image not found in this tenant",
          });
        }
        // Serialize concurrent primary changes on the same product (mirrors
        // imageCreate) so the single-primary partial unique index can't race.
        await tx
          .select({ id: schema.product.id })
          .from(schema.product)
          .where(eq(schema.product.id, target.productId))
          .for("update")
          .limit(1);
        await tx
          .update(schema.productImage)
          .set({ isPrimary: false, updatedBy: ctx.actorUserId })
          .where(
            and(
              eq(schema.productImage.productId, target.productId),
              eq(schema.productImage.isPrimary, true),
              isNull(schema.productImage.deletedAt)
            )
          );
        // Promote only an ACTIVE row (deleted_at IS NULL) — belt-and-suspenders
        // alongside the row lock: if it was concurrently deleted, the update
        // touches zero rows and we reject rather than flag a deleted image.
        const row = (
          await tx
            .update(schema.productImage)
            .set({ isPrimary: true, updatedBy: ctx.actorUserId })
            .where(
              and(
                eq(schema.productImage.id, input.imageId),
                isNull(schema.productImage.deletedAt)
              )
            )
            .returning()
        ).at(0);
        if (!row) {
          throw new ORPCError("NOT_FOUND", {
            message: "Product image not found in this tenant",
          });
        }
        await services.recordAudit(tx, ctx, {
          action: "product.imageSetPrimary",
          entityType: "product_image",
          entityId: row.id,
          after: row,
        });
        return {
          id: row.id,
          url: row.url,
          altText: row.altText,
          sortOrder: row.sortOrder,
          isPrimary: row.isPrimary,
          createdAt: row.createdAt,
        };
      });
    }),
  imageDelete: tenantProcedure
    .input(z.object({ imageId: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        // No hard deletes for operational data (charter §8): soft-delete and
        // clear the primary flag so the product is left with no primary
        // (explicit re-pick via imageSetPrimary — no surprise auto-promote).
        const before = (
          await tx
            .select()
            .from(schema.productImage)
            .where(
              and(
                eq(schema.productImage.id, input.imageId),
                isNull(schema.productImage.deletedAt)
              )
            )
            .for("update")
            .limit(1)
        ).at(0);
        if (!before) {
          throw new ORPCError("NOT_FOUND", {
            message: "Product image not found in this tenant",
          });
        }
        const row = firstOrThrow(
          (
            await tx
              .update(schema.productImage)
              .set({
                deletedAt: new Date(),
                isPrimary: false,
                updatedBy: ctx.actorUserId,
              })
              .where(eq(schema.productImage.id, input.imageId))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "product.imageDelete",
          entityType: "product_image",
          entityId: row.id,
          before,
          after: row,
        });
        return { id: row.id, deleted: true };
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
  // Storefront curation (Shopix, design §3). A staff-visible product is NOT
  // automatically public — publishing is an explicit, audited, products.create-
  // gated decision. Publishing ensures a unique public slug exists (the PDP
  // addressing key; the internal uuid is never exposed publicly).
  setPublished: tenantProcedure
    .input(z.object({ id: z.string().uuid(), isPublished: z.boolean() }))
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
        // Ensure a unique public slug when publishing (kept once assigned, so a
        // published URL stays stable even if later unpublished/republished).
        const slug =
          input.isPublished && !before.slug
            ? await ensureUniqueProductSlug(
                tx,
                ctx.tenantId,
                before.name,
                input.id
              )
            : before.slug;
        const row = firstOrThrow(
          (
            await tx
              .update(schema.product)
              .set({
                isPublished: input.isPublished,
                slug,
                updatedBy: ctx.actorUserId,
              })
              .where(eq(schema.product.id, input.id))
              .returning()
          ).at(0)
        );
        await services.recordAudit(tx, ctx, {
          action: "product.setPublished",
          entityType: "product",
          entityId: row.id,
          before,
          after: row,
        });
        return { id: row.id, isPublished: row.isPublished, slug: row.slug };
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
  variantCatalogList: tenantProcedure
    .input(
      z.object({
        includeArchived: z.boolean().default(false),
        productId: z.string().uuid().optional(),
        q: z.string().trim().min(1).optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        if (input.productId) {
          await assertProductVisible(tx, input.productId);
        }
        const search = input.q ? `%${input.q}%` : null;
        const conditions = [
          input.productId
            ? eq(schema.variant.productId, input.productId)
            : null,
          input.includeArchived ? null : isNull(schema.variant.deletedAt),
          search
            ? or(
                ilike(schema.variant.name, search),
                ilike(schema.variant.value, search),
                ilike(schema.product.sku, search),
                ilike(schema.product.name, search),
                sql`concat_ws(' ', ${schema.product.name}, ${schema.variant.value}) ilike ${search}`,
                sql`concat_ws(' ', ${schema.product.name}, ${schema.product.sku}, ${schema.variant.name}, ${schema.variant.value}) ilike ${search}`
              )
            : null,
        ].filter((condition): condition is SQL => condition != null);
        return tx
          .select({
            id: schema.variant.id,
            productId: schema.variant.productId,
            productSku: schema.product.sku,
            productName: schema.product.name,
            name: schema.variant.name,
            value: schema.variant.value,
            sortOrder: schema.variant.sortOrder,
            createdAt: schema.variant.createdAt,
          })
          .from(schema.variant)
          .innerJoin(
            schema.product,
            eq(schema.product.id, schema.variant.productId)
          )
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(
            schema.product.name,
            schema.variant.name,
            schema.variant.sortOrder,
            schema.variant.value
          );
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
  skuCatalogList: tenantProcedure
    .input(
      z.object({
        includeArchived: z.boolean().default(false),
        productId: z.string().uuid().optional(),
        q: z.string().trim().min(1).optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        if (input.productId) {
          await assertProductVisible(tx, input.productId);
        }
        const search = input.q ? `%${input.q}%` : null;
        const conditions = [
          input.productId ? eq(schema.sku.productId, input.productId) : null,
          input.includeArchived ? null : isNull(schema.sku.deletedAt),
          search
            ? or(
                ilike(schema.sku.code, search),
                ilike(schema.sku.name, search),
                ilike(schema.product.sku, search),
                ilike(schema.product.name, search),
                ilike(schema.unitOfMeasure.code, search),
                ilike(schema.unitOfMeasure.name, search)
              )
            : null,
        ].filter((condition): condition is SQL => condition != null);
        return tx
          .select({
            id: schema.sku.id,
            productId: schema.sku.productId,
            productSku: schema.product.sku,
            productName: schema.product.name,
            code: schema.sku.code,
            name: schema.sku.name,
            baseUomCode: schema.unitOfMeasure.code,
            baseUomName: schema.unitOfMeasure.name,
            costingMethod: schema.sku.costingMethod,
            trackingMode: schema.sku.trackingMode,
            isActive: schema.sku.isActive,
            createdAt: schema.sku.createdAt,
          })
          .from(schema.sku)
          .innerJoin(
            schema.product,
            eq(schema.product.id, schema.sku.productId)
          )
          .leftJoin(
            schema.unitOfMeasure,
            eq(schema.unitOfMeasure.id, schema.sku.baseUomId)
          )
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(schema.sku.createdAt));
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
  barcodeCatalogList: tenantProcedure
    .input(
      z.object({
        includeArchived: z.boolean().default(false),
        q: z.string().trim().min(1).optional(),
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
        const search = input.q ? `%${input.q}%` : null;
        const conditions = [
          input.skuId ? eq(schema.barcode.skuId, input.skuId) : null,
          input.includeArchived ? null : isNull(schema.barcode.deletedAt),
          search
            ? or(
                ilike(schema.barcode.value, search),
                ilike(schema.barcode.symbology, search),
                ilike(schema.sku.code, search),
                ilike(schema.sku.name, search),
                ilike(schema.product.sku, search),
                ilike(schema.product.name, search)
              )
            : null,
        ].filter((condition): condition is SQL => condition != null);
        return tx
          .select({
            id: schema.barcode.id,
            skuId: schema.barcode.skuId,
            skuCode: schema.sku.code,
            skuName: schema.sku.name,
            productId: schema.sku.productId,
            productSku: schema.product.sku,
            productName: schema.product.name,
            value: schema.barcode.value,
            symbology: schema.barcode.symbology,
            isPrimary: schema.barcode.isPrimary,
            createdAt: schema.barcode.createdAt,
          })
          .from(schema.barcode)
          .innerJoin(schema.sku, eq(schema.sku.id, schema.barcode.skuId))
          .innerJoin(
            schema.product,
            eq(schema.product.id, schema.sku.productId)
          )
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(schema.barcode.createdAt));
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
  uomConversionCatalogList: tenantProcedure
    .input(
      z.object({
        categoryId: z.string().uuid().optional(),
        includeArchived: z.boolean().default(false),
        productId: z.string().uuid().optional(),
        q: z.string().trim().min(1).optional(),
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
        const searchTerms =
          input.q?.split(SEARCH_TERM_SEPARATOR).filter(Boolean) ?? [];
        const conditions = [
          input.categoryId
            ? eq(schema.uomConversion.categoryId, input.categoryId)
            : null,
          input.productId
            ? eq(schema.uomConversion.productId, input.productId)
            : null,
          input.skuId ? eq(schema.uomConversion.skuId, input.skuId) : null,
          input.includeArchived ? null : isNull(schema.uomConversion.deletedAt),
          ...searchTerms.map((term) => {
            const search = `%${term}%`;
            return or(
              ilike(schema.uomConversion.role, search),
              ilike(fromUom.code, search),
              ilike(fromUom.name, search),
              ilike(toUom.code, search),
              ilike(toUom.name, search),
              ilike(schema.category.code, search),
              ilike(schema.category.name, search),
              ilike(schema.product.sku, search),
              ilike(schema.product.name, search),
              ilike(schema.sku.code, search),
              ilike(schema.sku.name, search)
            );
          }),
        ].filter((condition): condition is SQL => condition != null);
        return tx
          .select({
            id: schema.uomConversion.id,
            categoryId: schema.uomConversion.categoryId,
            categoryCode: schema.category.code,
            categoryName: schema.category.name,
            productId: schema.uomConversion.productId,
            productSku: schema.product.sku,
            productName: schema.product.name,
            skuId: schema.uomConversion.skuId,
            skuCode: schema.sku.code,
            skuName: schema.sku.name,
            fromUomId: schema.uomConversion.fromUomId,
            fromUomCode: fromUom.code,
            fromUomName: fromUom.name,
            toUomId: schema.uomConversion.toUomId,
            toUomCode: toUom.code,
            toUomName: toUom.name,
            role: schema.uomConversion.role,
            factor: schema.uomConversion.factor,
            factorScale: schema.uomConversion.factorScale,
            isActive: schema.uomConversion.isActive,
            createdAt: schema.uomConversion.createdAt,
          })
          .from(schema.uomConversion)
          .innerJoin(fromUom, eq(fromUom.id, schema.uomConversion.fromUomId))
          .innerJoin(toUom, eq(toUom.id, schema.uomConversion.toUomId))
          .leftJoin(
            schema.category,
            eq(schema.category.id, schema.uomConversion.categoryId)
          )
          .leftJoin(
            schema.product,
            eq(schema.product.id, schema.uomConversion.productId)
          )
          .leftJoin(schema.sku, eq(schema.sku.id, schema.uomConversion.skuId))
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(
            schema.uomConversion.role,
            fromUom.code,
            toUom.code,
            schema.uomConversion.createdAt
          );
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

const MAX_SLUG_ATTEMPTS = 10_000;

// Generate a public storefront slug unique within the tenant (RLS-scoped). One
// query fetches every existing slug colliding with the base, then a free suffix
// is chosen in memory (no await-in-loop). Excludes the product itself so a
// re-publish keeps its own slug.
async function ensureUniqueProductSlug(
  tx: TenantTransaction,
  tenantId: string,
  name: string,
  productId: string
): Promise<string> {
  // Serialize slug generation per tenant so two concurrent setPublished calls
  // can't read the same "taken" set and mint a colliding slug (which would
  // surface the (tenant_id, slug) unique-index violation as a 500). Same
  // advisory-lock discipline as allocateSaleNumber (folded review MEDIUM).
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`slug:${tenantId}`}, 0))`
  );
  const base = slugify(name) || "product";
  const taken = new Set(
    (
      await tx
        .select({ slug: schema.product.slug })
        .from(schema.product)
        .where(
          and(
            like(schema.product.slug, `${base}%`),
            ne(schema.product.id, productId)
          )
        )
    )
      .map((r) => r.slug)
      .filter((s): s is string => s !== null)
  );
  if (!taken.has(base)) {
    return base;
  }
  for (let n = 2; n < MAX_SLUG_ATTEMPTS; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  // Extremely unlikely; guarantee uniqueness with an id fragment.
  return `${base}-${productId.slice(0, 8)}`;
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
  lotCatalogList: tenantProcedure
    .input(
      z.object({
        includeArchived: z.boolean().default(false),
        q: z.string().trim().min(1).optional(),
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
        const searchTerms =
          input.q?.split(SEARCH_TERM_SEPARATOR).filter(Boolean) ?? [];
        const conditions = [
          input.skuId ? eq(schema.lot.skuId, input.skuId) : null,
          input.status ? eq(schema.lot.status, input.status) : null,
          input.includeArchived ? null : isNull(schema.lot.deletedAt),
          ...searchTerms.map((term) => {
            const search = `%${term}%`;
            return or(
              ilike(schema.lot.lotNumber, search),
              ilike(schema.lot.status, search),
              ilike(schema.sku.code, search),
              ilike(schema.sku.name, search),
              ilike(schema.product.sku, search),
              ilike(schema.product.name, search)
            );
          }),
        ].filter((condition): condition is SQL => condition != null);
        return tx
          .select({
            id: schema.lot.id,
            skuId: schema.lot.skuId,
            skuCode: schema.sku.code,
            skuName: schema.sku.name,
            productId: schema.sku.productId,
            productSku: schema.product.sku,
            productName: schema.product.name,
            lotNumber: schema.lot.lotNumber,
            expiryDate: schema.lot.expiryDate,
            manufacturedDate: schema.lot.manufacturedDate,
            status: schema.lot.status,
            createdAt: schema.lot.createdAt,
          })
          .from(schema.lot)
          .innerJoin(schema.sku, eq(schema.sku.id, schema.lot.skuId))
          .innerJoin(
            schema.product,
            eq(schema.product.id, schema.sku.productId)
          )
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(
            schema.lot.expiryDate,
            schema.product.sku,
            schema.sku.code,
            schema.lot.lotNumber
          );
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
  // On-hand per SKU per location (the inventory grid): AVCO cells (avg_cost) plus
  // the FIFO layer aggregates (valuation_layer), joined to SKU/product/location
  // names — the same dual-costing read as reports.valuation, projected for
  // display. Tenant-scoped (RLS scopes every joined table); gated reports.view.
  // Money/qty are server-computed; the client renders, never sums.
  stockByLocation: tenantProcedure
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
        if (input.locationId) {
          await assertLocationVisible(tx, input.locationId);
        }
        if (input.skuId) {
          await assertSkuVisible(tx, input.skuId);
        }
        // AVCO (qty<>0 cells) UNION FIFO layer aggregates, then name the cell.
        const rows = await tx.execute(sql`
          SELECT
            s.id   AS sku_id,
            s.code AS sku_code,
            p.name AS product_name,
            l.id   AS location_id,
            l.name AS location_name,
            agg.qty_on_hand,
            agg.currency,
            agg.scale,
            agg.total_value_minor
          FROM (
            SELECT sku_id, location_id, currency, scale,
              qty_on_hand::bigint AS qty_on_hand,
              total_value_minor::bigint AS total_value_minor
            FROM avg_cost
            WHERE qty_on_hand <> 0
            UNION ALL
            SELECT sku_id, location_id, currency, scale,
              COALESCE(SUM(qty_remaining), 0)::bigint AS qty_on_hand,
              COALESCE(SUM(qty_remaining * unit_cost_minor), 0)::bigint AS total_value_minor
            FROM valuation_layer
            WHERE qty_remaining > 0
            GROUP BY sku_id, location_id, currency, scale
          ) agg
          JOIN sku s ON s.id = agg.sku_id
          JOIN product p ON p.id = s.product_id
          JOIN location l ON l.id = agg.location_id
          WHERE (${input.locationId ?? null}::uuid IS NULL OR agg.location_id = ${input.locationId ?? null})
            AND (${input.skuId ?? null}::uuid IS NULL OR agg.sku_id = ${input.skuId ?? null})
          ORDER BY p.name, l.name, s.code
        `);
        return rows.rows.map((row) => ({
          skuId: row.sku_id,
          skuCode: row.sku_code,
          productName: row.product_name,
          locationId: row.location_id,
          locationName: row.location_name,
          qtyOnHand: Number(row.qty_on_hand),
          currency: row.currency,
          scale: Number(row.scale),
          totalValueMinor: Number(row.total_value_minor),
        }));
      });
    }),
  // Recent stock-ledger movements (newest-first) for an audit/history panel.
  // Tenant-scoped (RLS); gated reports.view. Projects the display-safe ledger
  // columns only (no idempotency key / ref ids / source-movement plumbing).
  stockLedgerList: tenantProcedure
    .input(
      z.object({
        skuId: z.string().uuid().optional(),
        locationId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).default(100),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "reports.view");
        if (input.skuId) {
          await assertSkuVisible(tx, input.skuId);
        }
        if (input.locationId) {
          await assertLocationVisible(tx, input.locationId);
        }
        const conditions = [
          input.skuId ? eq(schema.stockLedger.skuId, input.skuId) : null,
          input.locationId
            ? eq(schema.stockLedger.locationId, input.locationId)
            : null,
        ].filter((condition): condition is SQL => condition != null);
        return tx
          .select({
            id: schema.stockLedger.id,
            locationId: schema.stockLedger.locationId,
            locationName: schema.location.name,
            productId: schema.stockLedger.productId,
            productName: schema.product.name,
            skuId: schema.stockLedger.skuId,
            skuCode: schema.sku.code,
            movementType: schema.stockLedger.movementType,
            qtyDelta: schema.stockLedger.qtyDelta,
            balanceAfter: schema.stockLedger.balanceAfter,
            unitCostMinor: schema.stockLedger.unitCostMinor,
            costCurrency: schema.stockLedger.costCurrency,
            costScale: schema.stockLedger.costScale,
            costingMethodApplied: schema.stockLedger.costingMethodApplied,
            serverTs: schema.stockLedger.serverTs,
          })
          .from(schema.stockLedger)
          .innerJoin(
            schema.location,
            eq(schema.location.id, schema.stockLedger.locationId)
          )
          .innerJoin(
            schema.product,
            eq(schema.product.id, schema.stockLedger.productId)
          )
          .leftJoin(schema.sku, eq(schema.sku.id, schema.stockLedger.skuId))
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(schema.stockLedger.serverTs))
          .limit(input.limit);
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

const SETTLING_TENDER_METHODS = [
  "cash",
  "card",
  "mobile_money",
  "bank_transfer",
] as const satisfies readonly TenderMethod[];

const STORED_VALUE_TENDER_METHODS = [
  "store_credit",
  "gift_card",
] as const satisfies readonly TenderMethod[];

function assertConfiguredSaleTender(method: TenderMethod): void {
  if ((SETTLING_TENDER_METHODS as readonly string[]).includes(method)) {
    return;
  }
  if ((STORED_VALUE_TENDER_METHODS as readonly string[]).includes(method)) {
    throw new ORPCError("BAD_REQUEST", {
      message:
        "Stored-value tenders are reserved as a voucher/store-credit seam; balance liability ledger is not implemented yet",
    });
  }
  throw new ORPCError("BAD_REQUEST", {
    message: `Tender method is not configured for POS settlement: ${method}`,
  });
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
    assertConfiguredSaleTender(t.method);
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

// ── Pre-sale QUOTE (read-only preview; item 2 frontend-readiness) ────────────
// A cart preview the cashier UI renders WITHOUT computing any money itself. It
// MUST stay identical to what pos.createSale will charge, so it calls the SAME
// priceMspLines + settleTenders the sale calls — never a re-derivation (a parallel
// formula would silently drift). It performs NO writes (no sale/invoice/tender/
// ledger/number/outbox): pure SELECTs through the same RLS-scoped tx.

// Tender preview. Reuses settleTenders verbatim; underpayment / cash-overpayment
// are FLAGGED (settleable=false + the exact reason createSale would reject with),
// not thrown — a preview must tolerate an incomplete payment.
function previewTenders(
  tenders: TenderInput[],
  total: ReturnType<typeof services.money>
) {
  const tenderedMinor = tenders.reduce((sum, t) => sum + t.amountMinor, 0);
  try {
    const settled = settleTenders(tenders, total);
    const settledMinor = settled.reduce(
      (sum, t) => sum + t.settledAmountMinor,
      0
    );
    const changeMinor = settled.reduce(
      (sum, t) => sum + (t.changeMinor ?? 0),
      0
    );
    return {
      items: settled.map((t) => ({
        amountMinor: t.amountMinor,
        changeMinor: t.changeMinor ?? 0,
        currency: t.currency,
        method: t.method,
        settledAmountMinor: t.settledAmountMinor,
      })),
      settleable: true,
      settlementError: null as string | null,
      summary: {
        balanceDueMinor: 0,
        changeMinor,
        settledMinor,
        tenderedMinor,
      },
      underpaid: false,
    };
  } catch (error) {
    const settlementError =
      error instanceof ORPCError
        ? error.message
        : "Tenders cannot settle this sale";
    return {
      items: tenders.map((t) => ({
        amountMinor: t.amountMinor,
        changeMinor: 0,
        currency: t.currency,
        method: t.method,
        settledAmountMinor: null as number | null,
      })),
      settleable: false,
      settlementError,
      summary: {
        balanceDueMinor: Math.max(total.minor - tenderedMinor, 0),
        changeMinor: 0,
        settledMinor: 0,
        tenderedMinor,
      },
      underpaid: tenderedMinor < total.minor,
    };
  }
}

async function buildSaleQuote(
  tx: TenantTransaction,
  ctx: RequestContext,
  input: {
    lines: MspLineInput[];
    locationId: string;
    shiftId?: string;
    terminalId?: string;
    tenders?: TenderInput[];
  }
) {
  // Same sellable-location gate the sale enforces (INV-P4-7) — the preview must
  // refuse exactly what the sale would refuse.
  await assertSaleLocation(tx, input.locationId);
  // Same shift/terminal enforcement createSale runs (resolveSaleShift): if the
  // tenant requires an open shift, or a provided shiftId is closed/foreign, the
  // sale would reject — so the quote must too, or a green preview could be
  // rejected at submit for a shift reason (Codex HIGH — quote/createSale drift).
  // Read-only: resolveSaleShift only SELECTs shift rows + location settings.
  await resolveSaleShift(
    tx,
    ctx,
    input.locationId,
    input.shiftId,
    input.terminalId
  );
  const products = await tx
    .select()
    .from(schema.product)
    .where(
      inArray(
        schema.product.id,
        input.lines.map((line) => line.productId)
      )
    );
  // SAME pricing + SKU-tuple validation the sale uses (no drift).
  const { priced, subtotal } = await priceMspLines(tx, products, input.lines);
  const productById = new Map(products.map((p) => [p.id, p]));
  const skuRows = priced.length
    ? await tx
        .select({ code: schema.sku.code, id: schema.sku.id })
        .from(schema.sku)
        .where(
          inArray(
            schema.sku.id,
            priced.map((p) => p.skuId)
          )
        )
    : [];
  const skuCodeById = new Map(skuRows.map((s) => [s.id, s.code]));
  const lines = priced.map((p) => {
    const lineTotal = services.multiplyMoney(
      services.money(p.unitPriceMinor, subtotal.currency, subtotal.scale),
      p.qty
    );
    return {
      // Reserved seams mirror createSale (tax/discount = 0 in the MSP slice).
      discountMinor: 0,
      lineTotalMinor: lineTotal.minor,
      productId: p.productId,
      productName: productById.get(p.productId)?.name ?? null,
      qty: p.qty,
      skuCode: skuCodeById.get(p.skuId) ?? null,
      skuId: p.skuId,
      taxMinor: 0,
      taxRateId: null as string | null,
      unitPriceMinor: p.unitPriceMinor,
    };
  });
  const payments =
    input.tenders && input.tenders.length > 0
      ? previewTenders(input.tenders, subtotal)
      : {
          items: [],
          settleable: false,
          settlementError: null as string | null,
          summary: {
            balanceDueMinor: subtotal.minor,
            changeMinor: 0,
            settledMinor: 0,
            tenderedMinor: 0,
          },
          underpaid: true,
        };
  return {
    currency: subtotal.currency,
    lines,
    payments,
    scale: subtotal.scale,
    schemaVersion: 1 as const,
    taxBreakdown: [] as Array<{
      baseMinor: number | null;
      taxMinor: number;
      taxRateId: string | null;
    }>,
    totals: {
      discountMinor: 0,
      subtotalMinor: subtotal.minor,
      taxMinor: 0,
      totalMinor: subtotal.minor,
    },
  };
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
    idempotencyKey: string;
    lines: MspLineInput[];
    locationId: string;
    salesRepId?: string;
    shiftId?: string;
    terminalId?: string;
    tenders: TenderInput[];
  }
) {
  const location = await assertSaleLocation(tx, input.locationId);
  // Resolve the shift per the configured shift_enforcement (Commit 4). Default
  // 'optional' + no shiftId/terminalId → null (unchanged MSP behaviour). A
  // provided shiftId must belong to the caller's terminal (Codex HIGH).
  const resolvedShiftId = await resolveSaleShift(
    tx,
    ctx,
    input.locationId,
    input.shiftId,
    input.terminalId
  );
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
          // Reserved seam: exchange producer deferred to a later commit.
          exchangeGroupId: null,
          idempotencyKey: input.idempotencyKey,
          locationId: input.locationId,
          number: saleNumber,
          saleType: "sale",
          salesRepId: input.salesRepId ?? null,
          scale: subtotal.scale,
          shiftId: resolvedShiftId,
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
      currency: t.currency,
      fxRateUsed: null,
      fxRateToSale: null,
      method: t.method,
      scale: subtotal.scale,
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
        currency: t.currency,
        fxRateUsed: null,
        fxRateToSale: null,
        functionalCurrency: null,
        functionalScale: null,
        locationId: input.locationId,
        method: t.method,
        paymentId: tenderRow.id,
        realizedFxGainLossFunctionalMinor: null,
        receivedBy: ctx.actorUserId,
        scale: subtotal.scale,
        saleCurrency: subtotal.currency,
        saleId: sale.id,
        saleScale: subtotal.scale,
        sourceId: sale.id,
        sourceType: "sale",
        settledAmountMinor: t.settledAmountMinor,
        settledFunctionalMinor: null,
        // The DB-resolved shift (what was actually written), never the raw
        // client input — a `disabled` tenant stores null and must emit null,
        // not a spurious/cross-tenant UUID to the P5 GL (Codex MEDIUM).
        shiftId: resolvedShiftId,
        terminalId: input.terminalId ?? null,
        tenderCurrency: t.currency,
        tenderFxRateToFunctional: null,
        tenderId: tenderRow.id,
        tenderScale: subtotal.scale,
        tenderType: t.method,
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
      // Reserved-nullable (event contract): exchange producer deferred.
      exchangeGroupId: null,
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
      // DB-resolved shift (Codex MEDIUM) — matches the persisted sale row.
      shiftId: resolvedShiftId,
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
// Commit 3 — Returns / Refunds / Voids (event-map-phase4.md). (Exchange is
// DEFERRED to a later commit — needs the stored-value seam for excess credit.)
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

// Raw refund runner (the router wraps it in permission + idempotency). A
// standalone refund disburses the refunded value back to the customer (tenders
// must equal the refunded amount). The exchange producer (net settlement) is
// DEFERRED to a later commit — `sale.exchange_group_id` stays a reserved seam.
async function runRefund(
  tx: TenantTransaction,
  ctx: RequestContext,
  input: {
    doNotRestock?: boolean;
    idempotencyKey: string;
    lines: RefundLineInput[];
    originalSaleId: string;
    refundReason?: string;
    terminalId?: string;
    tenders: TenderInput[];
  }
) {
  const original = await loadSaleForUpdate(tx, input.originalSaleId);
  if (!original) {
    throw new ORPCError("NOT_FOUND", {
      message: "Original sale not found in this tenant",
    });
  }
  // Attach the refund to the CURRENT open shift at the caller's terminal — a
  // cash refund pays cash OUT of THIS drawer now, so it must reduce that shift's
  // expected cash (Codex HIGH). No terminal / no open shift → null (a refund
  // outside a shift, e.g. back-office), unchanged for the Commit-3 tests.
  const refundShiftId = await resolveSaleShift(
    tx,
    ctx,
    original.locationId,
    undefined,
    input.terminalId
  );
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

  // Refund tenders = money returned to the customer; a refund MUST be fully
  // tendered back (the refunded amount).
  for (const t of input.tenders) {
    assertConfiguredSaleTender(t.method);
  }
  const tenderedBack = input.tenders.reduce((s, t) => s + t.amountMinor, 0);
  if (tenderedBack !== refundTotalMagnitude) {
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
          // Reserved seam: exchange producer deferred — a return is never part
          // of an exchange group yet (set by the future exchange commit).
          exchangeGroupId: null,
          idempotencyKey: input.idempotencyKey,
          locationId: original.locationId,
          number,
          originalSaleId: original.id,
          saleType: "return",
          scale,
          // The refund's cash leaves THIS shift's drawer (Codex HIGH).
          shiftId: refundShiftId,
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
      // Reserved-nullable (event contract): exchange producer deferred — always
      // null until the exchange commit pairs a return + sale under one group.
      exchangeGroupId: null,
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
      // The shift the refund cash actually left (Codex HIGH/MEDIUM) — the
      // current open shift, not the original sale's shift.
      shiftId: refundShiftId,
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

// NOTE: `pos.exchange` (a linked return + sale sharing an exchangeGroupId, with
// net-difference settlement) is DEFERRED to a later commit — it needs the
// stored-value / store-credit seam so an excess return credit can become store
// credit rather than cash (owner decision). The `sale.exchange_group_id` column
// and the reserved-nullable `exchangeGroupId` event field stay in place for it.
// The exchange CONTRACT (decomposition) remains locked in event-map-phase4.md.

const refundLineSchema = z.object({
  originalSaleLineId: z.string().uuid(),
  qty: z.number().int().positive(),
});
const refundTenderSchema = z.object({
  amountMinor: z.number().int().min(0),
  currency: z.string().length(3),
  method: z.enum(schema.TENDER_METHODS),
});

// ───────────────────────── Phase-4 Commit 4: configurable cash control ──────
// Shift · Cash Drawer · Blind Close · Over/Short · X/Z. Behaviour is configured
// via the settings resolver (resolveShiftSettings) — NO business-type branch.

interface CashLineInput {
  amountMinor: number;
  currency: string;
  scale: number;
}

type ShiftRow = typeof schema.shift.$inferSelect;

function requireActor(ctx: RequestContext): string {
  if (!ctx.actorUserId) {
    throw new ORPCError("UNAUTHORIZED", { message: "No authenticated actor" });
  }
  return ctx.actorUserId;
}

// FOR UPDATE on the shift row BEFORE any status guard — close/movement is a
// status-machine; the lock serializes concurrent closes (the Commit-3 race
// lesson). RLS scopes the read to the tenant (a cross-tenant shiftId → none).
async function loadShiftForUpdate(
  tx: TenantTransaction,
  shiftId: string
): Promise<ShiftRow | undefined> {
  return (
    await tx
      .select()
      .from(schema.shift)
      .where(eq(schema.shift.id, shiftId))
      .for("update")
  ).at(0);
}

// Gapless per-tenant Z-report number, serialized on the SAME advisory lock as
// sale/return numbering (so all document numbering is gapless per tenant).
async function allocateZReportNumber(
  tx: TenantTransaction,
  tenantId: string
): Promise<string> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`docnum:${tenantId}`}, 0))`
  );
  const n =
    ((
      await tx
        .select({ c: count() })
        .from(schema.shift)
        .where(eq(schema.shift.status, "closed"))
    ).at(0)?.c ?? 0) + 1;
  return `Z-${n}`;
}

// overShort = counted − expected, per (currency, scale) — never merge different
// scales of one currency (Codex HIGH; mirrors computeExpectedCash's keying).
function computeOverShort(
  expected: services.CashAmount[],
  counted: CashLineInput[]
): services.CashAmount[] {
  const keyOf = (r: { currency: string; scale: number }) =>
    `${r.currency}:${r.scale}`;
  const exp = new Map(expected.map((e) => [keyOf(e), e]));
  const cnt = new Map(counted.map((c) => [keyOf(c), c]));
  const out: services.CashAmount[] = [];
  for (const key of new Set([...exp.keys(), ...cnt.keys()])) {
    const e = exp.get(key);
    const c = cnt.get(key);
    const ref = e ?? c;
    if (!ref) {
      continue;
    }
    out.push({
      amountMinor: (c?.amountMinor ?? 0) - (e?.amountMinor ?? 0),
      currency: ref.currency,
      scale: ref.scale,
    });
  }
  return out;
}

function reservedFxTwin(rows: CashLineInput[] | services.CashAmount[]) {
  return rows.map((r) => ({
    amountMinor: r.amountMinor,
    currency: r.currency,
    // Functional twin reserved-null (single-currency default; P5 multi-currency).
    fxRateToFunctional: null,
    functionalAmountMinor: null,
    scale: r.scale,
  }));
}

// Resolve which shift a sale/return attaches to, per the configured
// shift_enforcement (the platform seam — no business-type branch). `disabled` →
// always null; `required` → a valid OPEN shift at this terminal+location is
// mandatory; `optional` → attach if one is found, else null.
//
// A sale can only attach to ITS OWN terminal's open shift (the one-shift-per-
// terminal design): a provided shiftId MUST belong to the caller's `terminalId`
// (Codex HIGH — otherwise A could credit cash to B's drawer). When only
// `terminalId` is given (refunds), the open shift for that terminal is
// looked up. All reads are RLS-scoped (a cross-tenant id returns nothing → the
// H1 read guard).
// The single open-shift lookup, shared so the sale/refund WRITE path
// (resolveSaleShift) and the saleDetail READ (refundShiftSatisfied) can never
// disagree about what "an open shift at this terminal+location" means.
async function findOpenShift(
  tx: TenantTransaction,
  terminalId: string,
  locationId: string
): Promise<string | undefined> {
  return (
    await tx
      .select({ id: schema.shift.id })
      .from(schema.shift)
      .where(
        and(
          eq(schema.shift.terminalId, terminalId),
          eq(schema.shift.locationId, locationId),
          eq(schema.shift.status, "open")
        )
      )
      .limit(1)
  ).at(0)?.id;
}

async function resolveSaleShift(
  tx: TenantTransaction,
  ctx: RequestContext,
  locationId: string,
  shiftId: string | undefined,
  terminalId: string | undefined
): Promise<string | null> {
  const settings = await services.resolveShiftSettings(tx, ctx, locationId);
  if (settings.shiftEnforcement === "disabled") {
    return null;
  }
  if (shiftId) {
    if (!terminalId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "terminalId is required to attach a sale to a shift",
      });
    }
    const s = (
      await tx
        .select({
          locationId: schema.shift.locationId,
          status: schema.shift.status,
          terminalId: schema.shift.terminalId,
        })
        .from(schema.shift)
        .where(eq(schema.shift.id, shiftId))
        .limit(1)
    ).at(0);
    if (!s) {
      throw new ORPCError("NOT_FOUND", {
        message: "Shift not found in this tenant",
      });
    }
    if (s.status !== "open") {
      throw new ORPCError("BAD_REQUEST", { message: "Shift is closed" });
    }
    if (s.locationId !== locationId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Shift belongs to a different location",
      });
    }
    if (s.terminalId !== terminalId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Shift belongs to a different terminal",
      });
    }
    return shiftId;
  }
  // No explicit shiftId — find the open shift for the caller's terminal.
  if (terminalId) {
    const openId = await findOpenShift(tx, terminalId, locationId);
    if (openId) {
      return openId;
    }
  }
  if (settings.shiftEnforcement === "required") {
    throw new ORPCError("BAD_REQUEST", {
      message:
        "An open shift is required for this sale (shift_enforcement=required)",
    });
  }
  return null;
}

// Read-only, non-throwing mirror of resolveSaleShift's REQUIRED-path precondition
// (the part runRefund enforces before a cash refund): can a refund's cash-out
// attach to an open shift right now? Used by saleDetail so `canRefund` never
// promises a refund the shift gate would reject (#20 availability↔enforcement —
// the Codex HIGH). `optional`/`disabled` enforcement ⇒ always satisfiable;
// `required` ⇒ needs an open shift at the caller's terminal (no terminal ⇒ not
// satisfiable, exactly as runRefund rejects a no-terminal refund under required).
async function refundShiftSatisfied(
  tx: TenantTransaction,
  ctx: RequestContext,
  locationId: string,
  terminalId: string | undefined
): Promise<boolean> {
  const settings = await services.resolveShiftSettings(tx, ctx, locationId);
  if (settings.shiftEnforcement !== "required") {
    return true;
  }
  if (!terminalId) {
    return false;
  }
  return Boolean(await findOpenShift(tx, terminalId, locationId));
}

async function runShiftList(
  tx: TenantTransaction,
  input: {
    limit: number;
    locationId?: string;
    status?: (typeof schema.SHIFT_STATUSES)[number];
  }
) {
  if (input.locationId) {
    await assertLocationVisible(tx, input.locationId);
  }
  const filters: SQL[] = [];
  if (input.status) {
    filters.push(eq(schema.shift.status, input.status));
  }
  if (input.locationId) {
    filters.push(eq(schema.shift.locationId, input.locationId));
  }
  const rows = await tx
    .select({
      cashierUserId: schema.shift.cashierUserId,
      closedAt: schema.shift.closedAt,
      id: schema.shift.id,
      locationId: schema.shift.locationId,
      locationName: schema.location.name,
      openedAt: schema.shift.openedAt,
      status: schema.shift.status,
      terminalId: schema.shift.terminalId,
      zReportNumber: schema.shift.zReportNumber,
    })
    .from(schema.shift)
    .innerJoin(schema.location, eq(schema.location.id, schema.shift.locationId))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(schema.shift.openedAt))
    .limit(input.limit);
  return rows.map((row) => ({
    ...row,
    closedAt: row.closedAt?.toISOString() ?? null,
    openedAt: row.openedAt.toISOString(),
  }));
}

async function runOpenShift(
  tx: TenantTransaction,
  ctx: RequestContext,
  input: {
    idempotencyKey: string;
    locationId: string;
    openingFloat: CashLineInput[];
    terminalId: string;
  }
) {
  const cashier = requireActor(ctx);
  const loc = await assertSaleLocation(tx, input.locationId);
  const settings = await services.resolveShiftSettings(
    tx,
    ctx,
    input.locationId
  );
  if (settings.shiftEnforcement === "disabled") {
    throw new ORPCError("BAD_REQUEST", {
      message:
        "Shifts are disabled for this location (shift_enforcement=disabled)",
    });
  }
  if (settings.cashDrawer === "off" && input.openingFloat.length > 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Cash drawer is disabled (cash_drawer=off) — no opening float",
    });
  }
  // One open shift per terminal (the partial unique index is the DB backstop).
  const existingOpen = (
    await tx
      .select({ id: schema.shift.id })
      .from(schema.shift)
      .where(
        and(
          eq(schema.shift.terminalId, input.terminalId),
          eq(schema.shift.status, "open")
        )
      )
      .limit(1)
  ).at(0);
  if (existingOpen) {
    throw new ORPCError("CONFLICT", {
      message: "An open shift already exists for this terminal",
    });
  }
  const shiftRow = firstOrThrow(
    (
      await tx
        .insert(schema.shift)
        .values({
          cashierUserId: cashier,
          companyId: loc.companyId,
          createdBy: cashier,
          locationId: input.locationId,
          status: "open",
          tenantId: ctx.tenantId,
          terminalId: input.terminalId,
        })
        .returning()
    ).at(0)
  );
  for (const f of input.openingFloat) {
    await tx.insert(schema.cashMovement).values({
      amountMinor: f.amountMinor,
      createdBy: cashier,
      currency: f.currency,
      scale: f.scale,
      shiftId: shiftRow.id,
      tenantId: ctx.tenantId,
      type: "open_float",
    });
  }
  await services.recordAudit(tx, ctx, {
    action: "pos.open_shift",
    after: shiftRow,
    entityId: shiftRow.id,
    entityType: "shift",
  });
  await services.emitEvent(tx, ctx, {
    payload: {
      cashierUserId: cashier,
      companyId: loc.companyId,
      functionalCurrency: null,
      functionalScale: null,
      locationId: input.locationId,
      openedAt: shiftRow.openedAt.toISOString(),
      openedBy: cashier,
      openingFloat: reservedFxTwin(input.openingFloat),
      shiftId: shiftRow.id,
      terminalId: input.terminalId,
    },
    type: services.DomainEventType.ShiftOpened,
  });
  return {
    shiftId: shiftRow.id,
    status: shiftRow.status,
    terminalId: input.terminalId,
  };
}

async function runCashMovement(
  tx: TenantTransaction,
  ctx: RequestContext,
  input: {
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
    reason?: string;
    scale: number;
    shiftId: string;
    terminalId: string;
    type: "pay_in" | "pay_out" | "drop";
  }
) {
  const cashier = requireActor(ctx);
  const shiftRow = await loadShiftForUpdate(tx, input.shiftId);
  if (!shiftRow) {
    throw new ORPCError("NOT_FOUND", {
      message: "Shift not found in this tenant",
    });
  }
  // You can only act on a shift through ITS OWN terminal (Codex HIGH) — else a
  // cashier could post a drop to a colleague's open drawer.
  if (shiftRow.terminalId !== input.terminalId) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Shift belongs to a different terminal",
    });
  }
  if (shiftRow.status !== "open") {
    throw new ORPCError("CONFLICT", { message: "Shift is already closed" });
  }
  const settings = await services.resolveShiftSettings(
    tx,
    ctx,
    shiftRow.locationId
  );
  if (settings.cashDrawer === "off") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Cash drawer is disabled (cash_drawer=off)",
    });
  }
  const movement = firstOrThrow(
    (
      await tx
        .insert(schema.cashMovement)
        .values({
          amountMinor: input.amountMinor,
          createdBy: cashier,
          currency: input.currency,
          reason: input.reason ?? null,
          scale: input.scale,
          shiftId: shiftRow.id,
          tenantId: ctx.tenantId,
          type: input.type,
        })
        .returning()
    ).at(0)
  );
  await services.recordAudit(tx, ctx, {
    action: "pos.cash_movement",
    after: movement,
    entityId: movement.id,
    entityType: "cash_movement",
  });
  return { cashMovementId: movement.id, shiftId: shiftRow.id };
}

async function runCloseShift(
  tx: TenantTransaction,
  ctx: RequestContext,
  input: {
    countedCash: CashLineInput[];
    idempotencyKey: string;
    shiftId: string;
    terminalId: string;
  }
) {
  const cashier = requireActor(ctx);
  // FOR UPDATE before the status guard — a second concurrent close re-reads
  // 'closed' and fails here (exactly one winner).
  const shiftRow = await loadShiftForUpdate(tx, input.shiftId);
  if (!shiftRow) {
    throw new ORPCError("NOT_FOUND", {
      message: "Shift not found in this tenant",
    });
  }
  // A shift can only be closed through ITS OWN terminal (Codex HIGH) — else a
  // cashier could close a colleague's drawer with an empty count.
  if (shiftRow.terminalId !== input.terminalId) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Shift belongs to a different terminal",
    });
  }
  if (shiftRow.status !== "open") {
    throw new ORPCError("CONFLICT", { message: "Shift is already closed" });
  }
  const settings = await services.resolveShiftSettings(
    tx,
    ctx,
    shiftRow.locationId
  );
  // BLIND: the system computes expected (the input carries only counted).
  const expectedCash = await services.computeExpectedCash(tx, ctx, shiftRow.id);
  const overShort = computeOverShort(expectedCash, input.countedCash);
  for (const c of input.countedCash) {
    await tx.insert(schema.cashMovement).values({
      amountMinor: c.amountMinor,
      createdBy: cashier,
      currency: c.currency,
      scale: c.scale,
      shiftId: shiftRow.id,
      tenantId: ctx.tenantId,
      type: "close_count",
    });
  }
  const zReportNumber = await allocateZReportNumber(tx, ctx.tenantId);
  const closed = firstOrThrow(
    (
      await tx
        .update(schema.shift)
        .set({
          closedAt: new Date(),
          status: "closed",
          updatedBy: cashier,
          zReportNumber,
        })
        .where(eq(schema.shift.id, shiftRow.id))
        .returning()
    ).at(0)
  );
  const movements = await tx
    .select()
    .from(schema.cashMovement)
    .where(eq(schema.cashMovement.shiftId, shiftRow.id));
  await services.recordAudit(tx, ctx, {
    action: "pos.close_shift",
    after: { expectedCash, overShort, shift: closed },
    before: shiftRow,
    entityId: shiftRow.id,
    entityType: "shift",
  });
  await services.emitEvent(tx, ctx, {
    payload: {
      cashMovements: movements.map((m) => ({
        amountMinor: m.amountMinor,
        currency: m.currency,
        fxRateToFunctional: null,
        functionalAmountMinor: null,
        scale: m.scale,
        type: m.type,
      })),
      cashierUserId: closed.cashierUserId,
      closedAt: (closed.closedAt ?? new Date()).toISOString(),
      closedBy: cashier,
      companyId: closed.companyId,
      countedCash: reservedFxTwin(input.countedCash),
      expectedCash: reservedFxTwin(expectedCash),
      functionalCurrency: null,
      functionalScale: null,
      locationId: closed.locationId,
      overShort: reservedFxTwin(overShort),
      shiftId: closed.id,
      terminalId: closed.terminalId,
      zReportId: zReportNumber,
    },
    type: services.DomainEventType.ShiftClosed,
  });
  return {
    blindClose: settings.blindClose,
    expectedCash,
    overShort,
    shiftId: closed.id,
    status: closed.status,
    zReportNumber,
  };
}

async function loadShiftReadable(tx: TenantTransaction, shiftId: string) {
  const shiftRow = (
    await tx
      .select()
      .from(schema.shift)
      .where(eq(schema.shift.id, shiftId))
      .limit(1)
  ).at(0);
  if (!shiftRow) {
    throw new ORPCError("NOT_FOUND", {
      message: "Shift not found in this tenant",
    });
  }
  return shiftRow;
}

async function runXReport(
  tx: TenantTransaction,
  ctx: RequestContext,
  shiftId: string
) {
  const shiftRow = await loadShiftReadable(tx, shiftId);
  const expectedCash = await services.computeExpectedCash(tx, ctx, shiftId);
  const movements = await tx
    .select()
    .from(schema.cashMovement)
    .where(eq(schema.cashMovement.shiftId, shiftId));
  return {
    cashMovements: movements,
    expectedCash,
    openedAt: shiftRow.openedAt.toISOString(),
    shiftId,
    status: shiftRow.status,
    terminalId: shiftRow.terminalId,
  };
}

async function runZReport(
  tx: TenantTransaction,
  ctx: RequestContext,
  shiftId: string
) {
  const shiftRow = await loadShiftReadable(tx, shiftId);
  if (shiftRow.status !== "closed") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Shift is not closed — no Z report yet (use xReport)",
    });
  }
  const expectedCash = await services.computeExpectedCash(tx, ctx, shiftId);
  const countedRows = await tx
    .select({
      amountMinor: schema.cashMovement.amountMinor,
      currency: schema.cashMovement.currency,
      scale: schema.cashMovement.scale,
    })
    .from(schema.cashMovement)
    .where(
      and(
        eq(schema.cashMovement.shiftId, shiftId),
        eq(schema.cashMovement.type, "close_count")
      )
    );
  const overShort = computeOverShort(expectedCash, countedRows);
  return {
    countedCash: countedRows,
    expectedCash,
    overShort,
    shiftId,
    zReportNumber: shiftRow.zReportNumber,
  };
}

async function runNumberLeaseList(
  tx: TenantTransaction,
  input: {
    companyId?: string;
    docType?: string;
    limit: number;
    locationId?: string;
    status?: (typeof schema.NUMBER_LEASE_STATUSES)[number];
    terminalId?: string;
  }
) {
  if (input.companyId) {
    await assertCompanyVisible(tx, input.companyId);
  }
  if (input.locationId) {
    await assertLocationVisible(tx, input.locationId);
  }
  const filters: SQL[] = [];
  if (input.companyId) {
    filters.push(eq(schema.numberLease.companyId, input.companyId));
  }
  if (input.locationId) {
    filters.push(eq(schema.numberLease.locationId, input.locationId));
  }
  if (input.docType) {
    filters.push(eq(schema.numberLease.docType, input.docType));
  }
  if (input.status) {
    filters.push(eq(schema.numberLease.status, input.status));
  }
  if (input.terminalId) {
    filters.push(eq(schema.numberLease.terminalId, input.terminalId));
  }
  const rows = await tx
    .select({
      companyId: schema.numberLease.companyId,
      companyName: schema.company.name,
      consumedThrough: schema.numberLease.consumedThrough,
      createdAt: schema.numberLease.createdAt,
      deviceId: schema.numberLease.deviceId,
      docType: schema.numberLease.docType,
      exhaustedAt: schema.numberLease.exhaustedAt,
      expiresAt: schema.numberLease.expiresAt,
      fiscalYear: schema.numberLease.fiscalYear,
      id: schema.numberLease.id,
      locationId: schema.numberLease.locationId,
      locationName: schema.location.name,
      nextNumber: schema.numberLease.nextNumber,
      rangeEnd: schema.numberLease.rangeEnd,
      rangeStart: schema.numberLease.rangeStart,
      reclaimedAt: schema.numberLease.reclaimedAt,
      series: schema.numberLease.series,
      status: schema.numberLease.status,
      terminalId: schema.numberLease.terminalId,
    })
    .from(schema.numberLease)
    .innerJoin(
      schema.company,
      eq(schema.company.id, schema.numberLease.companyId)
    )
    .leftJoin(
      schema.location,
      eq(schema.location.id, schema.numberLease.locationId)
    )
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(schema.numberLease.createdAt))
    .limit(input.limit);
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    exhaustedAt: row.exhaustedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    reclaimedAt: row.reclaimedAt?.toISOString() ?? null,
    remainingCount: Math.max(row.rangeEnd - row.nextNumber + 1, 0),
  }));
}

export const posRouter = {
  createSale: tenantProcedure
    .input(
      z.object({
        locationId: z.string().uuid(),
        idempotencyKey: z.string().min(1),
        salesRepId: z.string().min(1).optional(),
        customerId: z.string().uuid().optional(),
        shiftId: z.string().uuid().optional(),
        // The cashier's terminal. Required to attach a sale to a shift (so a
        // sale can only ever credit ITS OWN terminal's open drawer — Codex HIGH).
        terminalId: z.string().min(1).optional(),
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
        // The cashier's terminal — the refund attaches to its open shift so the
        // cash-out is reflected in that drawer's expected cash (Codex HIGH).
        terminalId: z.string().min(1).optional(),
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
          () => runRefund(tx, ctx, input)
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

  // Cash control read surface for back-office shift monitoring.
  shiftList: tenantProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        locationId: z.string().uuid().optional(),
        status: z.enum(schema.SHIFT_STATUSES).optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "reports.view");
        return runShiftList(tx, input);
      });
    }),

  // Cash control (Commit 4). Open a drawer session at a terminal with a float.
  openShift: tenantProcedure
    .input(
      z.object({
        idempotencyKey: z.string().min(1),
        locationId: z.string().uuid(),
        openingFloat: z
          .array(
            z.object({
              amountMinor: z.number().int().min(0),
              currency: z.string().length(3),
              scale: z.number().int().min(0).default(2),
            })
          )
          .default([]),
        terminalId: z.string().min(1),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.open_shift");
        return services.runIdempotent(
          tx,
          ctx,
          input.idempotencyKey,
          input,
          () => runOpenShift(tx, ctx, input)
        );
      });
    }),

  // Pay-in / pay-out / drop during a shift (gated by cash_drawer=on).
  cashMovement: tenantProcedure
    .input(
      z.object({
        amountMinor: z.number().int().min(0),
        currency: z.string().length(3),
        idempotencyKey: z.string().min(1),
        reason: z.string().optional(),
        scale: z.number().int().min(0).default(2),
        shiftId: z.string().uuid(),
        terminalId: z.string().min(1),
        type: z.enum(["pay_in", "pay_out", "drop"]),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.cash_movement");
        return services.runIdempotent(
          tx,
          ctx,
          input.idempotencyKey,
          input,
          () => runCashMovement(tx, ctx, input)
        );
      });
    }),

  // BLIND close — the input carries ONLY countedCash; the system computes
  // expected + over/short (the cashier never supplies or sees expected).
  closeShift: tenantProcedure
    .input(
      z.object({
        countedCash: z
          .array(
            z.object({
              amountMinor: z.number().int().min(0),
              currency: z.string().length(3),
              scale: z.number().int().min(0).default(2),
            })
          )
          .default([]),
        idempotencyKey: z.string().min(1),
        shiftId: z.string().uuid(),
        terminalId: z.string().min(1),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.close_shift");
        return services.runIdempotent(
          tx,
          ctx,
          input.idempotencyKey,
          input,
          () => runCloseShift(tx, ctx, input)
        );
      });
    }),

  // Mid-shift X-report snapshot (read-only; does NOT close).
  xReport: tenantProcedure
    .input(z.object({ shiftId: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "reports.view");
        return runXReport(tx, ctx, input.shiftId);
      });
    }),

  // Z-report — final settlement of a closed shift (read-only).
  zReport: tenantProcedure
    .input(z.object({ shiftId: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "reports.view");
        return runZReport(tx, ctx, input.shiftId);
      });
    }),

  numberLeaseList: tenantProcedure
    .input(
      z.object({
        companyId: z.string().uuid().optional(),
        docType: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        locationId: z.string().uuid().optional(),
        status: z.enum(schema.NUMBER_LEASE_STATUSES).optional(),
        terminalId: z.string().min(1).optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "reports.view");
        return runNumberLeaseList(tx, input);
      });
    }),

  numberLeaseAllocate: tenantProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        deviceId: z.string().min(1).nullable().optional(),
        docType: z.string().min(1),
        expiresAt: z.string().datetime().nullable().optional(),
        fiscalYear: z.number().int().nullable().optional(),
        idempotencyKey: z.string().min(1),
        leaseSize: z.number().int().positive().max(10_000),
        locationId: z.string().uuid().nullable().optional(),
        series: z.string().min(1).nullable().optional(),
        terminalId: z.string().min(1),
        ttlMinutes: z.number().int().positive().nullable().optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.create_sale");
        return services.allocateNumberLease(tx, ctx, {
          ...input,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        });
      });
    }),

  numberLeaseCurrent: tenantProcedure
    .input(
      z.object({
        companyId: z.string().uuid().nullable().optional(),
        docType: z.string().min(1).nullable().optional(),
        locationId: z.string().uuid().nullable().optional(),
        series: z.string().min(1).nullable().optional(),
        terminalId: z.string().min(1),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.create_sale");
        return services.getCurrentNumberLease(tx, ctx, input);
      });
    }),

  numberLeaseConsume: tenantProcedure
    .input(
      z.object({
        leaseId: z.string().uuid(),
        number: z.number().int().positive(),
        sourceId: z.string().uuid().nullable().optional(),
        sourceType: z.string().min(1).nullable().optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.create_sale");
        return services.consumeNumberFromLease(tx, ctx, input);
      });
    }),

  numberLeaseReportSkipped: tenantProcedure
    .input(
      z.object({
        fromNumber: z.number().int().positive(),
        leaseId: z.string().uuid(),
        reason: z.string().min(1),
        sourceId: z.string().uuid().nullable().optional(),
        sourceType: z.string().min(1).nullable().optional(),
        toNumber: z.number().int().positive(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.create_sale");
        return services.reportSkippedNumbers(tx, ctx, input);
      });
    }),

  numberLeaseReclaim: tenantProcedure
    .input(
      z.object({
        leaseId: z.string().uuid(),
        reason: z.string().min(1),
        terminalId: z.string().min(1),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.create_sale");
        return services.reclaimNumberLease(tx, ctx, input);
      });
    }),

  // ── POS item search (item 1 frontend-readiness) ──────────────────────────
  // Cashier-safe, SALE-LINE-READY catalog read: returns skuId + price so the POS
  // never needs the admin `catalog.skuList` (products.create-gated). Gated on
  // pos.create_sale; exposes only cashier-relevant fields (no costing/policy
  // internals). SKU-level: one row per sellable SKU matching name/code/barcode.
  itemSearch: tenantProcedure
    .input(
      z.object({
        // Optional terminal location — reserved for a future cheap on-hand
        // summary join; unused today (stock display is a deferred enhancement).
        locationId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(50).default(20),
        q: z.string().min(1),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.create_sale");
        const term = `%${input.q}%`;
        // Exact barcode-scan match (barcode value is unique per tenant).
        const skuIdsByBarcode = tx
          .select({ skuId: schema.barcode.skuId })
          .from(schema.barcode)
          .where(eq(schema.barcode.value, input.q));
        const rows = await tx
          .select({
            currency: schema.product.currency,
            isActive: schema.sku.isActive,
            matchedBarcode: schema.barcode.value,
            priceMinor: schema.product.priceMinor,
            productCode: schema.product.sku,
            productId: schema.product.id,
            productName: schema.product.name,
            scale: schema.product.scale,
            skuCode: schema.sku.code,
            skuId: schema.sku.id,
            skuName: schema.sku.name,
            trackingMode: schema.product.trackingMode,
          })
          .from(schema.sku)
          .innerJoin(
            schema.product,
            eq(schema.sku.productId, schema.product.id)
          )
          // matchedBarcode = the scanned code, when q is this SKU's barcode.
          .leftJoin(
            schema.barcode,
            and(
              eq(schema.barcode.skuId, schema.sku.id),
              eq(schema.barcode.value, input.q)
            )
          )
          .where(
            and(
              // Sellable only: product live, sku active + live.
              isNull(schema.product.deletedAt),
              isNull(schema.sku.deletedAt),
              eq(schema.sku.isActive, true),
              or(
                ilike(schema.product.name, term),
                ilike(schema.product.sku, term),
                ilike(schema.sku.code, term),
                ilike(schema.sku.name, term),
                inArray(schema.sku.id, skuIdsByBarcode)
              )
            )
          )
          .limit(input.limit);
        return rows.map((r) => ({
          currency: r.currency,
          // Sale-line-ready: productId + skuId feed pos.createSale directly.
          displayName: r.skuName
            ? `${r.productName} — ${r.skuName}`
            : r.productName,
          matchedBarcode: r.matchedBarcode,
          priceMinor: Number(r.priceMinor),
          productCode: r.productCode,
          productId: r.productId,
          productName: r.productName,
          scale: r.scale,
          sellable: r.isActive,
          skuCode: r.skuCode,
          skuId: r.skuId,
          skuName: r.skuName,
          trackingMode: r.trackingMode,
        }));
      });
    }),

  // ── POS location picker (frontend-readiness) ────────────────────────────
  // Cashier-safe, SELL-FROM-READY location read: pos.quote/pos.createSale both
  // REQUIRE a locationId, but a cashier must never reach the admin catalog or
  // location-management reads. Gated on pos.create_sale; tenant-scoped (RLS);
  // returns ONLY SELLABLE, non-archived locations — a non-sellable one would be
  // refused by assertSaleLocation (INV-P4-7), so the picker only ever offers a
  // location the sale will accept — with ONLY the fields the picker needs (no
  // shift/cash/costing/hierarchy internals, no mutation).
  // autoSelect ⇔ exactly one eligible location: a single-store tenant skips the
  // dropdown (login → auto-selected → POS); a multi-store tenant gets a picker.
  // Same contract, business-size-adaptive UX (small ↔ enterprise, one codebase).
  locationList: tenantProcedure.input(z.object({})).handler(({ context }) => {
    const ctx = context.requestContext;
    return withTenant(db, ctx.tenantId, async (tx) => {
      await assertPermission(tx, ctx, "pos.create_sale");
      const locations = await tx
        .select({
          companyId: schema.location.companyId,
          displayName: schema.location.name,
          id: schema.location.id,
          isBonded: schema.location.isBonded,
          isSellable: schema.location.isSellable,
          isTransit: schema.location.isTransit,
          type: schema.location.type,
        })
        .from(schema.location)
        // SELLABLE + non-archived UNCONDITIONALLY — no includeArchived escape
        // hatch (Codex HIGH): a cashier picker must never surface a retired
        // location, and the admin-list affordance has no place on a cashier
        // read. assertSaleLocation accepts exactly this set (sellable), so the
        // picker only ever offers a location pos.quote/createSale will accept.
        .where(
          and(
            eq(schema.location.isSellable, true),
            isNull(schema.location.deletedAt)
          )
        );
      return { autoSelect: locations.length === 1, locations };
    });
  }),

  // ── Pre-sale cart/tender quote (item 2 frontend-readiness) ───────────────
  // Read-only preview of an uncommitted cart. Reuses the SAME priceMspLines +
  // settleTenders as pos.createSale (so the quote can never drift from the
  // charge). Creates NO sale/invoice/tender/stock/number/outbox. The frontend
  // renders these totals directly and never computes money locally.
  quote: tenantProcedure
    .input(
      z.object({
        locationId: z.string().uuid(),
        lines: z
          .array(
            z.object({
              productId: z.string().uuid(),
              qty: z.number().int().positive(),
              skuId: z.string().uuid(),
              unitPriceMinor: z.number().int().min(0).optional(),
            })
          )
          .min(1),
        // Mirror createSale's shift inputs so the preview applies the same
        // shift_enforcement (a green quote can't be rejected by the sale for a
        // shift reason).
        shiftId: z.string().uuid().optional(),
        terminalId: z.string().min(1).optional(),
        tenders: z
          .array(
            z.object({
              amountMinor: z.number().int().min(0),
              currency: z.string().length(3),
              method: z.enum(schema.TENDER_METHODS),
            })
          )
          .optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.create_sale");
        return buildSaleQuote(tx, ctx, input);
      });
    }),

  // Backend receipt read model. The frontend renders this model directly and
  // must not recompute sale/payment totals.
  receipt: tenantProcedure
    .input(z.object({ saleId: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.create_sale");
        const receipt = await services.buildSaleReceipt(tx, ctx, input.saleId);
        if (!receipt) {
          throw new ORPCError("NOT_FOUND", {
            message: "Sale receipt not found in this tenant",
          });
        }
        return receipt;
      });
    }),

  // ── POS sale lookup (frontend-readiness) ─────────────────────────────────
  // Cashier-safe, OPERATIONAL "find a recent sale" read so a cashier can locate
  // a sale to REPRINT (pos.receipt) or hand to REFUND/VOID (pos.refund/void).
  // Gated on pos.create_sale (the base cashier grant — finding/reprinting; the
  // refund/void ACTIONS stay separately gated). Tenant-scoped (RLS). Returns
  // ONLY the sale-level fields needed to FIND a sale (number, when, total,
  // status, type, location) — never line/COGS/margin internals (those live on
  // sale_line, not sale, so this sale-only select cannot leak them).
  // BOUNDED on purpose: a RECENCY FLOOR (last 30 days) + most-recent-first + a
  // hard limit (max 50) + optional number match + optional location scope — an
  // operational find, NOT a reporting export. The recency floor is load-bearing:
  // without it the limit only caps a PAGE, and a cashier could script number
  // searches to walk the tenant's entire history 50 rows at a time (Codex HIGH).
  saleSearch: tenantProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        // Optional scope to the cashier's terminal location (the frontend passes
        // its active locationId); RLS already bounds results to the tenant.
        locationId: z.string().uuid().optional(),
        q: z.string().min(1).optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.create_sale");
        const conditions = [
          // Recency floor — the load-bearing bound (Codex HIGH): even scripted
          // `q` searches can only reach the last 30 days, so this is an
          // OPERATIONAL find, never a full-history enumeration/export. (A longer
          // per-tenant refund window is a future settings-resolver concern.)
          gte(schema.sale.createdAt, sql`now() - interval '30 days'`),
          input.locationId
            ? eq(schema.sale.locationId, input.locationId)
            : null,
          input.q ? ilike(schema.sale.number, `%${input.q}%`) : null,
        ].filter((condition): condition is SQL => condition != null);
        const rows = await tx
          .select({
            createdAt: schema.sale.createdAt,
            currency: schema.sale.currency,
            id: schema.sale.id,
            locationId: schema.sale.locationId,
            number: schema.sale.number,
            saleType: schema.sale.saleType,
            scale: schema.sale.scale,
            status: schema.sale.status,
            totalMinor: schema.sale.totalMinor,
          })
          .from(schema.sale)
          .where(conditions.length ? and(...conditions) : undefined)
          // Server-authoritative recency (§14); bounded by limit.
          .orderBy(desc(schema.sale.createdAt))
          .limit(input.limit);
        return rows.map((r) => ({
          createdAt: r.createdAt.toISOString(),
          currency: r.currency,
          id: r.id,
          locationId: r.locationId,
          number: r.number,
          saleType: r.saleType,
          scale: r.scale,
          status: r.status,
          totalMinor: Number(r.totalMinor),
        }));
      });
    }),

  // ── POS sale detail (frontend-readiness) ─────────────────────────────────
  // Per-sale read for the post-sale ACTION view: the full display (reuses the
  // receipt read model — named lines/totals/status, receipt-safe, no COGS), plus
  // per-line refund-state and `availableActions`. Cashier-safe gate
  // (pos.create_sale — a cashier opens a sale to reprint it); the refund/void
  // ACTIONS stay separately gated. `availableActions` is computed SERVER-SIDE
  // from the caller's REAL grants AND the sale's state — principle #20 (Action
  // Availability): the backend decides the actions, the frontend renders exactly
  // those, and pos.refund/pos.void independently RE-AUTHORIZE on invoke
  // (verified — assertPermission in both handlers). UI visibility is never the
  // guard. The flags mirror the EXACT runVoid/runRefund guards so a rendered
  // action cannot be rejected at submit for a reason the detail view never
  // showed (no availability↔enforcement drift).
  saleDetail: tenantProcedure
    .input(
      z.object({
        saleId: z.string().uuid(),
        // The cashier's terminal — needed so `canRefund` reflects the shift
        // precondition pos.refund enforces under shift_enforcement=required.
        terminalId: z.string().min(1).optional(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.create_sale");
        const detail = await services.buildSaleDetail(tx, ctx, input.saleId);
        if (!detail) {
          throw new ORPCError("NOT_FOUND", {
            message: "Sale not found in this tenant",
          });
        }
        // Authorization layer (principle #20): availableActions = caller role
        // grant ∧ sale state. canVoid mirrors runVoid (sale-type "sale",
        // completed, no prior returns — voiding a refunded sale double-restocks);
        // canRefund mirrors runRefund (completed sale, refundable qty remaining);
        // canReprint needs only the base cashier gate.
        const role = await services.resolveTenantRole(tx, ctx.actorUserId);
        const can = (permission: string) =>
          services.roleHasPermission(role, permission);
        const isPlainSale = detail.flags.saleType === "sale";
        const isCompleted = detail.flags.status === "completed";
        // A cash refund must attach to an open shift when the location requires
        // one — fold the same precondition into canRefund so the read agrees
        // with what runRefund will accept (no availability↔enforcement drift).
        const shiftOk = await refundShiftSatisfied(
          tx,
          ctx,
          detail.receipt.location.id,
          input.terminalId
        );
        return {
          availableActions: {
            canRefund:
              can("pos.refund") &&
              isCompleted &&
              isPlainSale &&
              detail.flags.hasRefundableRemaining &&
              shiftOk,
            canReprint: can("pos.create_sale"),
            canVoid:
              can("pos.void_sale") &&
              isCompleted &&
              isPlainSale &&
              !detail.flags.hasPriorReturns,
          },
          receipt: detail.receipt,
          refundState: detail.refundState,
        };
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
            s.code AS sku_code,
            p.name AS product_name,
            rr.location_id,
            l.name AS location_name,
            rr.min_qty,
            rr.max_qty,
            COALESCE(SUM(sl.qty_delta), 0)::bigint AS on_hand
          FROM reorder_rule rr
          JOIN sku s ON s.id = rr.sku_id
          JOIN product p ON p.id = s.product_id
          JOIN location l ON l.id = rr.location_id
          LEFT JOIN stock_ledger sl
            ON sl.sku_id = rr.sku_id
           AND sl.location_id = rr.location_id
          WHERE rr.is_active = true
            AND rr.deleted_at IS NULL
            AND (${input.locationId ?? null}::uuid IS NULL OR rr.location_id = ${input.locationId ?? null})
          GROUP BY rr.sku_id, s.code, p.name, rr.location_id, l.name, rr.min_qty, rr.max_qty
          HAVING COALESCE(SUM(sl.qty_delta), 0) < rr.min_qty
          ORDER BY p.name, l.name, s.code
        `);
        return rows.rows.map((row) => ({
          skuId: row.sku_id,
          skuCode: row.sku_code,
          productName: row.product_name,
          locationId: row.location_id,
          locationName: row.location_name,
          minQty: Number(row.min_qty),
          maxQty: Number(row.max_qty),
          onHand: Number(row.on_hand),
          suggestedQty: Math.max(0, Number(row.max_qty) - Number(row.on_hand)),
        }));
      });
    }),
  // Dashboard KPIs — ALL aggregation/selection happens server-side (backend owns
  // business math, engineering-principles): sales total for the top currency,
  // transaction count, inventory value (AVCO+FIFO) for the top currency, and the
  // low-stock count. The client renders these figures and does no arithmetic.
  dashboardSummary: tenantProcedure
    .input(z.object({ locationId: z.string().uuid().optional() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "reports.view");

        // Sales — grouped by currency; pick the top currency by total.
        const saleConditions = [eq(schema.sale.status, "completed")];
        if (input.locationId) {
          saleConditions.push(eq(schema.sale.locationId, input.locationId));
        }
        const saleRows = await tx
          .select({
            currency: schema.sale.currency,
            scale: schema.sale.scale,
            saleCount: count(),
            totalMinor: sql<number>`COALESCE(SUM(${schema.sale.totalMinor}), 0)::bigint`,
          })
          .from(schema.sale)
          .where(and(...saleConditions))
          .groupBy(schema.sale.currency, schema.sale.scale);
        const transactionCount = saleRows.reduce(
          (sum, r) => sum + Number(r.saleCount),
          0
        );
        const sales =
          saleRows
            .map((r) => ({
              currency: r.currency,
              scale: r.scale,
              totalMinor: Number(r.totalMinor),
            }))
            .sort((a, b) => b.totalMinor - a.totalMinor)
            .at(0) ?? null;

        // Inventory value — AVCO + FIFO, aggregated per currency, top currency.
        const avcoRows = await tx
          .select({
            currency: schema.avgCost.currency,
            scale: schema.avgCost.scale,
            totalValueMinor: sql<number>`COALESCE(SUM(${schema.avgCost.totalValueMinor}), 0)::bigint`,
          })
          .from(schema.avgCost)
          .where(
            input.locationId
              ? eq(schema.avgCost.locationId, input.locationId)
              : undefined
          )
          .groupBy(schema.avgCost.currency, schema.avgCost.scale);
        const fifoRes = await tx.execute(sql`
          SELECT currency, scale,
            COALESCE(SUM(qty_remaining * unit_cost_minor), 0)::bigint AS total_value_minor
          FROM valuation_layer
          WHERE qty_remaining > 0
            AND (${input.locationId ?? null}::uuid IS NULL OR location_id = ${input.locationId ?? null})
          GROUP BY currency, scale
        `);
        const invByCurrency = new Map<
          string,
          { currency: string; scale: number; totalValueMinor: number }
        >();
        const addInv = (currency: string, scale: number, value: number) => {
          const key = `${currency}:${scale}`;
          const existing = invByCurrency.get(key) ?? {
            currency,
            scale,
            totalValueMinor: 0,
          };
          existing.totalValueMinor += value;
          invByCurrency.set(key, existing);
        };
        for (const r of avcoRows) {
          addInv(r.currency, r.scale, Number(r.totalValueMinor));
        }
        for (const r of fifoRes.rows) {
          addInv(
            String(r.currency),
            Number(r.scale),
            Number(r.total_value_minor)
          );
        }
        const inventoryValue =
          [...invByCurrency.values()].sort(
            (a, b) => b.totalValueMinor - a.totalValueMinor
          )[0] ?? null;

        // Low-stock count.
        const lowRes = await tx.execute(sql`
          SELECT COUNT(*)::int AS n FROM (
            SELECT rr.sku_id
            FROM reorder_rule rr
            LEFT JOIN stock_ledger sl
              ON sl.sku_id = rr.sku_id AND sl.location_id = rr.location_id
            WHERE rr.is_active = true AND rr.deleted_at IS NULL
              AND (${input.locationId ?? null}::uuid IS NULL OR rr.location_id = ${input.locationId ?? null})
            GROUP BY rr.sku_id, rr.location_id, rr.min_qty
            HAVING COALESCE(SUM(sl.qty_delta), 0) < rr.min_qty
          ) q
        `);
        const lowStockCount = Number(lowRes.rows.at(0)?.n ?? 0);

        return { sales, transactionCount, inventoryValue, lowStockCount };
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
  // Transfer headers (newest-first) for the transfers list. Tenant-scoped (RLS);
  // gated inventory.transfer. Projects display-safe header columns.
  list: tenantProcedure
    .input(
      z.object({
        status: z.enum(schema.TRANSFER_STATUSES).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.transfer");
        const conditions = input.status
          ? [eq(schema.stockTransfer.status, input.status)]
          : [];
        return tx
          .select({
            id: schema.stockTransfer.id,
            number: schema.stockTransfer.number,
            companyId: schema.stockTransfer.companyId,
            sourceLocationId: schema.stockTransfer.sourceLocationId,
            destLocationId: schema.stockTransfer.destLocationId,
            status: schema.stockTransfer.status,
            shippedAt: schema.stockTransfer.shippedAt,
            expectedReceiptDate: schema.stockTransfer.expectedReceiptDate,
            actualReceiptDate: schema.stockTransfer.actualReceiptDate,
            createdAt: schema.stockTransfer.createdAt,
          })
          .from(schema.stockTransfer)
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(schema.stockTransfer.createdAt))
          .limit(input.limit);
      });
    }),
  // One transfer header + its lines. Tenant-scoped read → NOT_FOUND when the
  // transfer is not visible in this tenant (H1: never trust a caller-supplied id).
  detail: tenantProcedure
    .input(z.object({ transferId: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.transfer");
        const transfer = (
          await tx
            .select({
              id: schema.stockTransfer.id,
              number: schema.stockTransfer.number,
              companyId: schema.stockTransfer.companyId,
              sourceLocationId: schema.stockTransfer.sourceLocationId,
              destLocationId: schema.stockTransfer.destLocationId,
              status: schema.stockTransfer.status,
              shippedAt: schema.stockTransfer.shippedAt,
              expectedReceiptDate: schema.stockTransfer.expectedReceiptDate,
              actualReceiptDate: schema.stockTransfer.actualReceiptDate,
              createdAt: schema.stockTransfer.createdAt,
            })
            .from(schema.stockTransfer)
            .where(eq(schema.stockTransfer.id, input.transferId))
            .limit(1)
        ).at(0);
        if (!transfer) {
          throw new ORPCError("NOT_FOUND", {
            message: "Transfer not found in this tenant",
          });
        }
        const lines = await tx
          .select({
            id: schema.stockTransferLine.id,
            productId: schema.stockTransferLine.productId,
            productName: schema.product.name,
            skuId: schema.stockTransferLine.skuId,
            skuCode: schema.sku.code,
            lotId: schema.stockTransferLine.lotId,
            qty: schema.stockTransferLine.qty,
          })
          .from(schema.stockTransferLine)
          .innerJoin(
            schema.product,
            eq(schema.product.id, schema.stockTransferLine.productId)
          )
          .leftJoin(
            schema.sku,
            eq(schema.sku.id, schema.stockTransferLine.skuId)
          )
          .where(eq(schema.stockTransferLine.transferId, input.transferId));
        return { transfer, lines };
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
  // Bond receipt headers (newest-first) for the bonded-stock list. Tenant-scoped
  // (RLS); gated bond.receive. Projects display-safe compliance header columns.
  receiptList: tenantProcedure
    .input(
      z.object({
        locationId: z.string().uuid().optional(),
        status: z.enum(schema.BOND_RECEIPT_STATUSES).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "bond.receive");
        if (input.locationId) {
          await assertLocationVisible(tx, input.locationId);
        }
        const conditions = [
          input.locationId
            ? eq(schema.bondReceipt.locationId, input.locationId)
            : null,
          input.status ? eq(schema.bondReceipt.status, input.status) : null,
        ].filter((condition): condition is SQL => condition != null);
        return tx
          .select({
            id: schema.bondReceipt.id,
            number: schema.bondReceipt.number,
            companyId: schema.bondReceipt.companyId,
            locationId: schema.bondReceipt.locationId,
            status: schema.bondReceipt.status,
            supplierRef: schema.bondReceipt.supplierRef,
            customsReference: schema.bondReceipt.customsReference,
            receivedAt: schema.bondReceipt.receivedAt,
            createdAt: schema.bondReceipt.createdAt,
          })
          .from(schema.bondReceipt)
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(schema.bondReceipt.createdAt))
          .limit(input.limit);
      });
    }),
  // One bond receipt header + its lines. Tenant-scoped read → NOT_FOUND when the
  // receipt is not visible in this tenant (H1: never trust a caller-supplied id).
  receiptDetail: tenantProcedure
    .input(z.object({ bondReceiptId: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "bond.receive");
        const receipt = (
          await tx
            .select({
              id: schema.bondReceipt.id,
              number: schema.bondReceipt.number,
              companyId: schema.bondReceipt.companyId,
              locationId: schema.bondReceipt.locationId,
              status: schema.bondReceipt.status,
              supplierRef: schema.bondReceipt.supplierRef,
              customsReference: schema.bondReceipt.customsReference,
              landedCostReference: schema.bondReceipt.landedCostReference,
              receivedAt: schema.bondReceipt.receivedAt,
              createdAt: schema.bondReceipt.createdAt,
            })
            .from(schema.bondReceipt)
            .where(eq(schema.bondReceipt.id, input.bondReceiptId))
            .limit(1)
        ).at(0);
        if (!receipt) {
          throw new ORPCError("NOT_FOUND", {
            message: "Bond receipt not found in this tenant",
          });
        }
        const lines = await tx
          .select({
            id: schema.bondReceiptLine.id,
            productId: schema.bondReceiptLine.productId,
            productName: schema.product.name,
            skuId: schema.bondReceiptLine.skuId,
            skuCode: schema.sku.code,
            lotId: schema.bondReceiptLine.lotId,
            qty: schema.bondReceiptLine.qty,
            unitCostMinor: schema.bondReceiptLine.unitCostMinor,
            costCurrency: schema.bondReceiptLine.costCurrency,
            costScale: schema.bondReceiptLine.costScale,
          })
          .from(schema.bondReceiptLine)
          .innerJoin(
            schema.product,
            eq(schema.product.id, schema.bondReceiptLine.productId)
          )
          .innerJoin(
            schema.sku,
            eq(schema.sku.id, schema.bondReceiptLine.skuId)
          )
          .where(eq(schema.bondReceiptLine.bondReceiptId, input.bondReceiptId));
        return { receipt, lines };
      });
    }),
};
