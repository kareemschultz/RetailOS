import { auth } from "@RetailOS/auth";
import type { TenantTransaction } from "@RetailOS/db";
import { db, schema, services, withTenant } from "@RetailOS/db";
import { ORPCError } from "@orpc/server";
import { and, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
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
  create: tenantProcedure
    .input(
      z.object({
        sku: z.string().min(1),
        name: z.string().min(1),
        priceMinor: z.number().int().min(0),
        currency: z.string().length(3),
        scale: z.number().int().min(0).default(2),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "products.create");
        const m = services.money(input.priceMinor, input.currency, input.scale);
        const row = firstOrThrow(
          (
            await tx
              .insert(schema.product)
              .values({
                tenantId: ctx.tenantId,
                sku: input.sku,
                name: input.name,
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
};

export const inventoryRouter = {
  receive: tenantProcedure
    .input(
      z.object({
        locationId: z.string().uuid(),
        productId: z.string().uuid(),
        qty: z.number().int().positive(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "inventory.receive");
        // RLS-scoped existence checks (FK checks bypass RLS — see location.create).
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
        const ledger = await services.appendStockMovement(tx, ctx, {
          locationId: input.locationId,
          productId: input.productId,
          movementType: "receipt",
          qtyDelta: input.qty,
        });
        await services.emitEvent(tx, ctx, {
          type: services.DomainEventType.InventoryReceived,
          payload: {
            locationId: input.locationId,
            productId: input.productId,
            qty: input.qty,
            ledgerId: ledger.id,
          },
        });
        await services.recordAudit(tx, ctx, {
          action: "inventory.receive",
          entityType: "stock_ledger",
          entityId: ledger.id,
          after: ledger,
        });
        return ledger;
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
              // Stock deduction goes through the ledger (the only mutator).
              // NOTE: oversell policy (reject if balance would go negative vs.
              // allow with backorder vs. optimistic) is a per-tenant BUSINESS
              // decision (charter §14) — deliberately NOT enforced here; the
              // ledger records the movement faithfully. See deferred-decisions log.
              await services.appendStockMovement(tx, ctx, {
                locationId: input.locationId,
                productId: lv.productId,
                movementType: "sale",
                qtyDelta: -lv.qty,
                refType: "sale",
                refId: sale.id,
                idempotencyKey: input.idempotencyKey,
              });
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
};
