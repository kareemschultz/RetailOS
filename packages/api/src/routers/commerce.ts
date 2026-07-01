import { db, schema, type TenantTransaction, withTenant } from "@RetailOS/db";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { storefrontProcedure } from "../storefront";

// Shopix Commerce Experience — the PUBLIC, anonymous storefront API (design §3).
// Every endpoint is a storefrontProcedure: tenant resolved from hostname, NO
// session/permission. DTOs are strict allow-lists (design §1.3) — only the listed
// fields ship; cost/margin/qty/internal ids/other-tenant data are never exposed.
//
// Phase C first backend slice: hostname→tenant gateway + public-safe catalog/PDP
// + quote skeleton. The current schema has no explicit public slug, publish flag,
// tax-rate table, cart table, reservation, payment, or online-order model yet, so
// this slice uses `product.sku` as the public handle and marks availability/tax/
// checkout seams explicitly blocked instead of inventing hidden policy.

const quoteBlockers = {
  tax: {
    status: "blocked" as const,
    blocker:
      "Real storefront tax rates are not modelled yet; v1 quote carries a zero-tax seam only.",
  },
  checkout: {
    status: "blocked" as const,
    blocker:
      "Cart persistence, reservation, checkout intent, payment provider, and online order writes are deferred to the next Storefront/Commerce slice.",
  },
};

const publicCatalogInput = z.object({
  q: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(50).default(24),
});

const publicProductInput = z.object({
  handle: z.string().min(1),
});

const publicQuoteInput = z.object({
  lines: z
    .array(
      z.object({
        handle: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1)
    .max(50),
});

interface ProductRow {
  categoryCode: string | null;
  categoryName: string | null;
  currency: string;
  handle: string;
  name: string;
  priceMinor: number;
  productId: string;
  scale: number;
}

interface ProductImageRow {
  altText: string | null;
  isPrimary: boolean;
  productId: string;
  sortOrder: number;
  url: string;
}

function publicCategory(row: ProductRow) {
  if (!row.categoryName) {
    return null;
  }
  return {
    handle: row.categoryCode ?? row.categoryName,
    name: row.categoryName,
  };
}

function primaryImageFor(
  productId: string,
  imagesByProductId: Map<string, ProductImageRow[]>
) {
  const image = imagesByProductId.get(productId)?.at(0);
  return image
    ? {
        url: image.url,
        altText: image.altText,
      }
    : null;
}

function groupImages(rows: ProductImageRow[]) {
  const byProductId = new Map<string, ProductImageRow[]>();
  for (const row of rows) {
    const current = byProductId.get(row.productId) ?? [];
    current.push(row);
    byProductId.set(row.productId, current);
  }
  return byProductId;
}

function mapCatalogItem(
  row: ProductRow,
  imagesByProductId: Map<string, ProductImageRow[]>
) {
  return {
    handle: row.handle,
    name: row.name,
    category: publicCategory(row),
    price: {
      amountMinor: row.priceMinor,
      currency: row.currency,
      scale: row.scale,
    },
    primaryImage: primaryImageFor(row.productId, imagesByProductId),
    // TODO(Storefront availability): replace this with a coarse, anti-scrape read
    // model once public availability policy and rate-limit budgets are locked.
    availability: "unknown" as const,
  };
}

function publicProductRows(
  tx: TenantTransaction,
  opts: { handles?: string[]; q?: string; limit: number }
): Promise<ProductRow[]> {
  const conditions = [isNull(schema.product.deletedAt)];
  if (opts.handles && opts.handles.length > 0) {
    conditions.push(inArray(schema.product.sku, opts.handles));
  }
  if (opts.q) {
    const search = ilike(schema.product.name, `%${opts.q}%`);
    conditions.push(search);
  }
  return tx
    .select({
      productId: schema.product.id,
      handle: schema.product.sku,
      name: schema.product.name,
      priceMinor: schema.product.priceMinor,
      currency: schema.product.currency,
      scale: schema.product.scale,
      categoryName: schema.category.name,
      categoryCode: schema.category.code,
    })
    .from(schema.product)
    .leftJoin(
      schema.category,
      eq(schema.product.categoryId, schema.category.id)
    )
    .where(and(...conditions))
    .orderBy(asc(schema.product.name))
    .limit(opts.limit);
}

function publicImages(tx: TenantTransaction, productIds: string[]) {
  if (productIds.length === 0) {
    return [];
  }
  return tx
    .select({
      productId: schema.productImage.productId,
      url: schema.productImage.url,
      altText: schema.productImage.altText,
      isPrimary: schema.productImage.isPrimary,
      sortOrder: schema.productImage.sortOrder,
    })
    .from(schema.productImage)
    .where(
      and(
        inArray(schema.productImage.productId, productIds),
        isNull(schema.productImage.deletedAt)
      )
    )
    .orderBy(
      schema.productImage.productId,
      asc(schema.productImage.sortOrder),
      asc(schema.productImage.createdAt)
    );
}

export const commerceRouter = {
  // Public storefront identity for the host-resolved tenant. Allow-list DTO:
  // `name` only — deliberately NOT slug, internal ids, vat/tax numbers, or any
  // tenant config. Proves the hostname → tenant gateway end-to-end. The
  // organization read is a platform read by id (the registry is not tenant-owned).
  storefront: storefrontProcedure.handler(async ({ context }) => {
    const row = (
      await db
        .select({ name: schema.organization.name })
        .from(schema.organization)
        .where(eq(schema.organization.id, context.storefront.tenantId))
        .limit(1)
    ).at(0);
    return { name: row?.name ?? null };
  }),

  catalog: storefrontProcedure
    .input(publicCatalogInput)
    .handler(({ context, input }) =>
      withTenant(db, context.storefront.tenantId, async (tx) => {
        const rows = await publicProductRows(tx, {
          q: input.q,
          limit: input.limit,
        });
        const imagesByProductId = groupImages(
          await publicImages(
            tx,
            rows.map((row) => row.productId)
          )
        );
        return {
          items: rows.map((row) => mapCatalogItem(row, imagesByProductId)),
        };
      })
    ),

  product: storefrontProcedure
    .input(publicProductInput)
    .handler(({ context, input }) =>
      withTenant(db, context.storefront.tenantId, async (tx) => {
        const row = (
          await publicProductRows(tx, {
            handles: [input.handle],
            limit: 1,
          })
        ).at(0);
        if (!row) {
          throw new ORPCError("NOT_FOUND", {
            message: "Product not found for this storefront",
          });
        }
        const imageRows = await publicImages(tx, [row.productId]);
        const variantRows = await tx
          .select({
            code: schema.sku.code,
            name: schema.sku.name,
          })
          .from(schema.sku)
          .where(
            and(
              eq(schema.sku.productId, row.productId),
              eq(schema.sku.isActive, true),
              isNull(schema.sku.deletedAt)
            )
          )
          .orderBy(asc(schema.sku.code));
        return {
          ...mapCatalogItem(row, groupImages(imageRows)),
          images: imageRows.map((image) => ({
            url: image.url,
            altText: image.altText,
            isPrimary: image.isPrimary,
          })),
          variants: variantRows,
        };
      })
    ),

  quote: storefrontProcedure
    .input(publicQuoteInput)
    .handler(({ context, input }) =>
      withTenant(db, context.storefront.tenantId, async (tx) => {
        const handles = input.lines.map((line) => line.handle);
        const rows = await publicProductRows(tx, {
          handles,
          limit: input.lines.length,
        });
        const byHandle = new Map(rows.map((row) => [row.handle, row]));
        const lines = input.lines.map((line) => {
          const product = byHandle.get(line.handle);
          if (!product) {
            throw new ORPCError("NOT_FOUND", {
              message: "Product not found for this storefront",
            });
          }
          const lineSubtotalMinor = product.priceMinor * line.quantity;
          return {
            handle: product.handle,
            name: product.name,
            quantity: line.quantity,
            unitPriceMinor: product.priceMinor,
            lineSubtotalMinor,
            discountMinor: 0,
            taxMinor: 0,
            lineTotalMinor: lineSubtotalMinor,
          };
        });
        const first = rows.at(0);
        if (!first) {
          throw new ORPCError("NOT_FOUND", {
            message: "Product not found for this storefront",
          });
        }
        const mixedCurrency = rows.some(
          (row) => row.currency !== first.currency || row.scale !== first.scale
        );
        if (mixedCurrency) {
          throw new ORPCError("BAD_REQUEST", {
            message: "A storefront quote must use one currency and scale",
          });
        }
        const subtotalMinor = lines.reduce(
          (sum, line) => sum + line.lineSubtotalMinor,
          0
        );
        return {
          schemaVersion: 1 as const,
          currency: first.currency,
          scale: first.scale,
          lines,
          totals: {
            subtotalMinor,
            discountMinor: 0,
            taxMinor: 0,
            totalMinor: subtotalMinor,
          },
          ...quoteBlockers,
        };
      })
    ),
};
