import { auth } from "@RetailOS/auth";
import type { TenantTransaction } from "@RetailOS/db";
import { db, schema, services, withTenant } from "@RetailOS/db";
import { ORPCError } from "@orpc/server";
import { and, count, eq, gte, inArray, lte, type SQL, sql } from "drizzle-orm";
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
            lines: result.adjustments,
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
