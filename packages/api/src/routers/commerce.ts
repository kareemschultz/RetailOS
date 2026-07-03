import {
  db,
  schema,
  services,
  type TenantTransaction,
  withTenant,
} from "@RetailOS/db";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { storefrontProcedure } from "../storefront";

// Shopix Commerce Experience — the PUBLIC, anonymous storefront API (design §3).
// Every endpoint is a storefrontProcedure: tenant resolved from hostname, NO
// session/permission. DTOs are strict allow-lists (design §1.3) — only the listed
// fields ship; cost/margin/qty/internal ids/other-tenant data are never exposed.
//
// Phase C: hostname→tenant gateway + public-safe catalog/PDP + real-tax quote
// (design §4 — `commerce.quote` resolves product → category → tenant-default
// via `services.calculateQuoteTax`, the same `tax_rate`/`mulDivRound`
// primitives POS uses). The schema has no explicit public slug, publish flag,
// cart table, reservation, or online-order model yet, so this slice uses
// `product.sku` as the public handle and marks checkout explicitly blocked
// instead of inventing hidden policy.

const quoteBlockers = {
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

// v1 guest token = the customer id itself (design §5/§10 — see
// commerce-cart.ts for the reasoning). Every cart call re-submits it.
const cartAuthInput = z.object({
  cartId: z.uuid(),
  customerId: z.uuid(),
});

const cartAddLineInput = cartAuthInput.extend({
  handle: z.string().min(1),
  quantity: z.number().int().positive(),
});

const cartRemoveLineInput = cartAuthInput.extend({
  cartLineId: z.uuid(),
});

interface ProductRow {
  categoryCode: string | null;
  categoryName: string | null;
  categoryTaxRateId: string | null;
  currency: string;
  handle: string;
  name: string;
  priceMinor: number;
  productId: string;
  productTaxRateId: string | null;
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
  opts: { handles?: string[]; productIds?: string[]; q?: string; limit: number }
): Promise<ProductRow[]> {
  const conditions = [isNull(schema.product.deletedAt)];
  if (opts.handles && opts.handles.length > 0) {
    conditions.push(inArray(schema.product.sku, opts.handles));
  }
  if (opts.productIds && opts.productIds.length > 0) {
    conditions.push(inArray(schema.product.id, opts.productIds));
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
      categoryTaxRateId: schema.category.taxRateId,
      productTaxRateId: schema.product.taxRateId,
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

// The cart service throws plain Error (not ORPCError) — mapped here at the
// router boundary, same convention as the other service-layer routers.
function mapCartError(error: unknown): never {
  if (error instanceof Error && error.message.includes("not found")) {
    throw new ORPCError("NOT_FOUND", { message: error.message });
  }
  if (error instanceof Error) {
    throw new ORPCError("BAD_REQUEST", { message: error.message });
  }
  throw error;
}

// Shared cart DTO builder: fetches the cart's lines, re-prices/re-taxes them
// from CURRENT product rows (never the stored line — design §5, the
// authoritative total is always a fresh quote), and returns the full public
// cart view. `cartLineId` is intentionally exposed (renamed `lineId`) — the
// cart owner needs it to target `cartRemoveLine`; this is not internal
// product/business data, and the cart is unreadable without the bearer
// customerId/cartId pair.
async function buildCartResponse(
  tx: TenantTransaction,
  cartId: string,
  customerId: string
) {
  const cart = await services.getCart(tx, { cartId, customerId });
  if (cart.lines.length === 0) {
    return {
      id: cart.id,
      status: cart.status,
      currency: null,
      scale: null,
      lines: [],
      taxBreakdown: [],
      totals: { subtotalMinor: 0, taxMinor: 0, totalMinor: 0 },
    };
  }
  const rows = await publicProductRows(tx, {
    productIds: cart.lines.map((line) => line.productId),
    limit: cart.lines.length,
  });
  const byProductId = new Map(rows.map((row) => [row.productId, row]));
  const first = rows.at(0);
  if (!first) {
    throw new ORPCError("NOT_FOUND", {
      message: "Cart products are no longer available in this storefront",
    });
  }
  const mixedCurrency = rows.some(
    (row) => row.currency !== first.currency || row.scale !== first.scale
  );
  if (mixedCurrency) {
    throw new ORPCError("BAD_REQUEST", {
      message: "A storefront cart must use one currency and scale",
    });
  }
  const quoteLines = cart.lines.map((line) => {
    const product = byProductId.get(line.productId);
    if (!product) {
      throw new ORPCError("NOT_FOUND", {
        message: "A cart item is no longer available in this storefront",
      });
    }
    return {
      categoryTaxRateId: product.categoryTaxRateId,
      currency: product.currency,
      name: product.name,
      priceMinor: product.priceMinor,
      productId: product.productId,
      productTaxRateId: product.productTaxRateId,
      qty: line.qty,
      scale: product.scale,
    };
  });
  const quote = await services.buildCartQuote(tx, quoteLines);
  return {
    id: cart.id,
    status: cart.status,
    currency: first.currency,
    scale: first.scale,
    // Explicit field list (not a spread of the quote line) — `productId` is
    // internal and must never reach the public response; `handle` is the
    // public identifier.
    lines: cart.lines.map((line, index) => {
      const quoted = quote.lines[index];
      return {
        lineId: line.id,
        handle: byProductId.get(line.productId)?.handle ?? null,
        name: quoted?.name ?? null,
        qty: quoted?.qty ?? line.qty,
        unitPriceMinor: quoted?.unitPriceMinor ?? null,
        lineSubtotalMinor: quoted?.lineSubtotalMinor ?? null,
        lineTaxMinor: quoted?.lineTaxMinor ?? null,
        lineTotalMinor: quoted?.lineTotalMinor ?? null,
      };
    }),
    taxBreakdown: quote.taxBreakdown,
    totals: quote.totals,
  };
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
        // Product detail returns the full `images` array (superset of
        // `primaryImage`), so `primaryImage` is intentionally excluded here
        // to avoid shipping the same image data twice.
        const { handle, name, category, price, availability } = mapCatalogItem(
          row,
          groupImages(imageRows)
        );
        return {
          handle,
          name,
          category,
          price,
          images: imageRows.map((image) => ({
            url: image.url,
            altText: image.altText,
            isPrimary: image.isPrimary,
          })),
          variants: variantRows,
          availability,
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
        const resolvedLines = input.lines.map((line) => {
          const product = byHandle.get(line.handle);
          if (!product) {
            throw new ORPCError("NOT_FOUND", {
              message: "Product not found for this storefront",
            });
          }
          return {
            product,
            quantity: line.quantity,
            lineSubtotalMinor: product.priceMinor * line.quantity,
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

        // Real tax (design §4): resolves product -> category -> the tenant's
        // active standard rate per line, never trusted from the client.
        const taxResult = await services.calculateQuoteTax(
          tx,
          resolvedLines.map((line) => ({
            categoryTaxRateId: line.product.categoryTaxRateId,
            lineBaseMinor: line.lineSubtotalMinor,
            productTaxRateId: line.product.productTaxRateId,
          }))
        );

        const lines = resolvedLines.map((line, index) => {
          const lineTaxMinor = taxResult.lines[index]?.lineTaxMinor ?? 0;
          const discountMinor = 0;
          return {
            handle: line.product.handle,
            name: line.product.name,
            quantity: line.quantity,
            unitPriceMinor: line.product.priceMinor,
            lineSubtotalMinor: line.lineSubtotalMinor,
            discountMinor,
            taxMinor: lineTaxMinor,
            lineTotalMinor:
              line.lineSubtotalMinor - discountMinor + lineTaxMinor,
          };
        });
        const subtotalMinor = lines.reduce(
          (sum, line) => sum + line.lineSubtotalMinor,
          0
        );
        const discountMinor = 0;
        return {
          schemaVersion: 1 as const,
          currency: first.currency,
          scale: first.scale,
          lines,
          taxBreakdown: taxResult.taxBreakdown,
          totals: {
            subtotalMinor,
            discountMinor,
            taxMinor: taxResult.taxMinor,
            totalMinor: subtotalMinor - discountMinor + taxResult.taxMinor,
          },
          ...quoteBlockers,
        };
      })
    ),

  // --- Cart (design §5) ----------------------------------------------------
  // Server-persisted only once a guest/customer principal exists — this is
  // that principal (`cartStart` mints both in one call). See
  // `commerce-cart.ts` for the v1 guest-token reasoning (the customer id
  // itself, an opaque bearer credential). Anonymous browsing/carting never
  // calls these; a real checkout (next Storefront/Commerce slice) is still
  // blocked (`quoteBlockers.checkout`).

  cartStart: storefrontProcedure.handler(({ context }) =>
    withTenant(db, context.storefront.tenantId, (tx) =>
      services.startGuestCart(tx, context.storefront.tenantId)
    )
  ),

  cartAddLine: storefrontProcedure
    .input(cartAddLineInput)
    .handler(({ context, input }) =>
      withTenant(db, context.storefront.tenantId, async (tx) => {
        const row = (
          await publicProductRows(tx, { handles: [input.handle], limit: 1 })
        ).at(0);
        if (!row) {
          throw new ORPCError("NOT_FOUND", {
            message: "Product not found for this storefront",
          });
        }
        try {
          await services.addCartLine(tx, context.storefront.tenantId, {
            cartId: input.cartId,
            customerId: input.customerId,
            productId: row.productId,
            qty: input.quantity,
          });
          return await buildCartResponse(tx, input.cartId, input.customerId);
        } catch (error) {
          return mapCartError(error);
        }
      })
    ),

  cartRemoveLine: storefrontProcedure
    .input(cartRemoveLineInput)
    .handler(({ context, input }) =>
      withTenant(db, context.storefront.tenantId, async (tx) => {
        try {
          await services.removeCartLine(tx, {
            cartId: input.cartId,
            cartLineId: input.cartLineId,
            customerId: input.customerId,
          });
          return await buildCartResponse(tx, input.cartId, input.customerId);
        } catch (error) {
          return mapCartError(error);
        }
      })
    ),

  cartGet: storefrontProcedure
    .input(cartAuthInput)
    .handler(({ context, input }) =>
      withTenant(db, context.storefront.tenantId, async (tx) => {
        try {
          return await buildCartResponse(tx, input.cartId, input.customerId);
        } catch (error) {
          return mapCartError(error);
        }
      })
    ),
};
