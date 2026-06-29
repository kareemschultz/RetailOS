import { db, schema, withTenant } from "@RetailOS/db";
import { ORPCError } from "@orpc/server";
import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import { storefrontProcedure } from "../storefront";

// Shopix Commerce Experience — the PUBLIC, anonymous storefront API (design §3).
// Every endpoint is a storefrontProcedure: tenant resolved from hostname, NO
// session/permission, rate-limited. Reads are tenant-scoped via
// withTenant(ctx.storefront.tenantId, ...) so RLS fail-closed applies exactly as
// on the authenticated path.
//
// PUBLIC DTO RULE (standing): every DTO below is an explicit ALLOW-LIST — only
// the listed fields ship. Cost, margin, exact quantity/value, internal uuids
// (slug is the public address, never the id), sku, and other-tenant data are
// NEVER exposed. Adding a public field is an intentional decision, asserted by
// the paired leak tests in commerce.integration.test.ts.
//
// CURATION: a product/category is public only when is_published = true (a
// staff-visible item is NOT auto-public) AND, for a product, slug IS NOT NULL.

const CATALOG_DEFAULT_LIMIT = 24;
const CATALOG_MAX_LIMIT = 60;

type AvailabilityBand = "in_stock" | "low_stock" | "out_of_stock";

export const commerceRouter = {
  // Public storefront identity for the host-resolved tenant. Allow-list DTO:
  // `name` only — deliberately NOT slug, internal ids, vat/tax, or config.
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

  // Public product catalog — only PUBLISHED, non-deleted, slug-addressable
  // products. Allow-list DTO: slug/name/price + primary image + (published)
  // category name. No id, no sku, no cost/qty.
  catalog: storefrontProcedure
    .input(
      z.object({
        q: z.string().optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(CATALOG_MAX_LIMIT)
          .default(CATALOG_DEFAULT_LIMIT),
      })
    )
    .handler(({ context, input }) =>
      withTenant(db, context.storefront.tenantId, async (tx) => {
        const conditions: SQL[] = [
          eq(schema.product.isPublished, true),
          isNull(schema.product.deletedAt),
          // Only slug-addressable products are public (defensive: never expose a
          // published-but-unslugged row, which would have no public URL).
          sql`${schema.product.slug} IS NOT NULL`,
        ];
        if (input.q) {
          const term = `%${input.q}%`;
          const search = or(
            ilike(schema.product.name, term),
            ilike(schema.product.slug, term)
          );
          if (search) {
            conditions.push(search);
          }
        }
        const rows = await tx
          .select({
            // `id` is selected ONLY for the internal image join below; it is
            // NOT placed in the returned DTO.
            id: schema.product.id,
            slug: schema.product.slug,
            name: schema.product.name,
            priceMinor: schema.product.priceMinor,
            currency: schema.product.currency,
            scale: schema.product.scale,
            categoryName: schema.category.name,
            categoryPublished: schema.category.isPublished,
            categoryDeletedAt: schema.category.deletedAt,
          })
          .from(schema.product)
          .leftJoin(
            schema.category,
            eq(schema.product.categoryId, schema.category.id)
          )
          .where(and(...conditions))
          .orderBy(schema.product.name)
          .limit(input.limit);

        const ids = rows.map((r) => r.id);
        const imageRows =
          ids.length === 0
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
                    inArray(schema.productImage.productId, ids),
                    eq(schema.productImage.isPrimary, true),
                    isNull(schema.productImage.deletedAt)
                  )
                );
        const primaryByProduct = new Map(
          imageRows.map((img) => [img.productId, img])
        );

        return rows.map((row) => {
          const image = primaryByProduct.get(row.id);
          return {
            slug: row.slug,
            name: row.name,
            priceMinor: row.priceMinor,
            currency: row.currency,
            scale: row.scale,
            // Category name only when the category is published AND not
            // soft-deleted (folded review MEDIUM — a deleted-but-published
            // category must not leak its name).
            categoryName:
              row.categoryPublished && row.categoryDeletedAt === null
                ? row.categoryName
                : null,
            primaryImageUrl: image?.url ?? null,
            primaryImageAltText: image?.altText ?? null,
          };
        });
      })
    ),

  // Public product detail (PDP), addressed by SLUG (never the internal uuid).
  // Allow-list DTO: slug/name/price + ordered images (url/altText/sort/primary).
  productDetail: storefrontProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .handler(({ context, input }) =>
      withTenant(db, context.storefront.tenantId, async (tx) => {
        const row = (
          await tx
            .select({
              id: schema.product.id,
              slug: schema.product.slug,
              name: schema.product.name,
              priceMinor: schema.product.priceMinor,
              currency: schema.product.currency,
              scale: schema.product.scale,
            })
            .from(schema.product)
            .where(
              and(
                eq(schema.product.slug, input.slug),
                eq(schema.product.isPublished, true),
                isNull(schema.product.deletedAt)
              )
            )
            .limit(1)
        ).at(0);
        if (!row) {
          throw new ORPCError("NOT_FOUND", {
            message: "No published product for this slug",
          });
        }
        const images = await tx
          .select({
            altText: schema.productImage.altText,
            isPrimary: schema.productImage.isPrimary,
            sortOrder: schema.productImage.sortOrder,
            url: schema.productImage.url,
          })
          .from(schema.productImage)
          .where(
            and(
              eq(schema.productImage.productId, row.id),
              isNull(schema.productImage.deletedAt)
            )
          )
          .orderBy(
            desc(schema.productImage.isPrimary),
            schema.productImage.sortOrder,
            schema.productImage.createdAt
          );
        return {
          slug: row.slug,
          name: row.name,
          priceMinor: row.priceMinor,
          currency: row.currency,
          scale: row.scale,
          images,
        };
      })
    ),

  // Public availability — a COARSE band only (decision #2). Exact on-hand
  // quantity and value are NEVER exposed (exposing them is a competitive/security
  // leak and lets stock be inferred). Computed from on-hand across the tenant's
  // SELLABLE locations vs the product's reorder threshold.
  availability: storefrontProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .handler(({ context, input }) =>
      withTenant(db, context.storefront.tenantId, async (tx) => {
        const product = (
          await tx
            .select({ id: schema.product.id })
            .from(schema.product)
            .where(
              and(
                eq(schema.product.slug, input.slug),
                eq(schema.product.isPublished, true),
                isNull(schema.product.deletedAt)
              )
            )
            .limit(1)
        ).at(0);
        if (!product) {
          throw new ORPCError("NOT_FOUND", {
            message: "No published product for this slug",
          });
        }
        // On-hand across sellable locations only (the storefront fulfils from
        // sellable stock). bigint summed in SQL, coerced to a JS number.
        const onHandRow = await tx.execute(sql`
          SELECT COALESCE(SUM(sl.qty_delta), 0)::bigint AS on_hand
          FROM stock_ledger sl
          JOIN location l ON l.id = sl.location_id
          WHERE sl.product_id = ${product.id} AND l.is_sellable = true
        `);
        const minRow = await tx.execute(sql`
          SELECT COALESCE(SUM(rr.min_qty), 0)::bigint AS min_total
          FROM reorder_rule rr
          JOIN sku s ON s.id = rr.sku_id
          WHERE s.product_id = ${product.id}
            AND rr.is_active = true
            AND rr.deleted_at IS NULL
        `);
        // Raw pg int8 sums come back as strings; compare as BigInt end-to-end
        // (project bigint-quantity discipline — no 2^53 truncation).
        const onHand = BigInt(
          (onHandRow.rows.at(0) as { on_hand?: string | number } | undefined)
            ?.on_hand ?? 0
        );
        const lowThreshold = BigInt(
          (minRow.rows.at(0) as { min_total?: string | number } | undefined)
            ?.min_total ?? 0
        );
        let band: AvailabilityBand;
        if (onHand <= 0n) {
          band = "out_of_stock";
        } else if (lowThreshold > 0n && onHand <= lowThreshold) {
          band = "low_stock";
        } else {
          band = "in_stock";
        }
        return { band };
      })
    ),
};
