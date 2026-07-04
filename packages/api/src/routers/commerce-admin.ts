import { db, schema, withTenant } from "@RetailOS/db";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { tenantProcedure } from "../index";
import { assertPermission } from "./vs1";

// Staff/back-office view of Shopix orders — deliberately a SEPARATE module and
// router key (commerceAdmin, not commerce) from the public, anonymous
// storefront API in commerce.ts (design threat model §2/§3: staff and public
// surfaces must never share a procedure base). A confirmed order becomes a
// real `sale` row on the shared ledger (design §8) so staff can already look
// it up via pos.saleDetail; this adds the commerce-shaped view (order status,
// fulfilment type, order lines) that the sale-shaped read can't show. Gated
// with the same "pos.create_sale" permission pos.saleSearch/saleDetail use —
// online orders are sale documents, so the same staff can view both.

export interface OrderListRow {
  createdAt: Date;
  currency: string;
  fulfilmentType: string;
  id: string;
  number: string | null;
  saleId: string | null;
  scale: number;
  status: string;
  totalMinor: number;
}

export const commerceAdminRouter = {
  orderList: tenantProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        q: z.string().min(1).optional(),
      })
    )
    .handler(({ context, input }): Promise<OrderListRow[]> => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.create_sale");
        const conditions = input.q
          ? ilike(schema.order.number, `%${input.q}%`)
          : undefined;
        return tx
          .select({
            id: schema.order.id,
            number: schema.order.number,
            status: schema.order.status,
            fulfilmentType: schema.order.fulfilmentType,
            totalMinor: schema.order.totalMinor,
            currency: schema.order.currency,
            scale: schema.order.scale,
            createdAt: schema.order.createdAt,
            saleId: schema.order.saleId,
          })
          .from(schema.order)
          .where(conditions)
          .orderBy(desc(schema.order.createdAt))
          .limit(input.limit);
      });
    }),
  orderDetail: tenantProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "pos.create_sale");
        const header = (
          await tx
            .select({
              id: schema.order.id,
              number: schema.order.number,
              status: schema.order.status,
              fulfilmentType: schema.order.fulfilmentType,
              totalMinor: schema.order.totalMinor,
              currency: schema.order.currency,
              scale: schema.order.scale,
              createdAt: schema.order.createdAt,
              expiresAt: schema.order.expiresAt,
              saleId: schema.order.saleId,
              locationId: schema.order.locationId,
              locationName: schema.location.name,
            })
            .from(schema.order)
            .innerJoin(
              schema.location,
              and(
                eq(schema.location.tenantId, schema.order.tenantId),
                eq(schema.location.id, schema.order.locationId)
              )
            )
            .where(
              and(
                eq(schema.order.tenantId, ctx.tenantId),
                eq(schema.order.id, input.orderId)
              )
            )
            .limit(1)
        ).at(0);
        if (!header) {
          throw new ORPCError("NOT_FOUND", { message: "Order not found" });
        }
        const lines = await tx
          .select({
            id: schema.orderLine.id,
            productId: schema.orderLine.productId,
            productName: schema.product.name,
            skuId: schema.orderLine.skuId,
            skuCode: schema.sku.code,
            qty: schema.orderLine.qty,
            unitPriceMinor: schema.orderLine.unitPriceMinor,
            lineSubtotalMinor: schema.orderLine.lineSubtotalMinor,
            lineTaxMinor: schema.orderLine.lineTaxMinor,
          })
          .from(schema.orderLine)
          .innerJoin(
            schema.product,
            and(
              eq(schema.product.tenantId, schema.orderLine.tenantId),
              eq(schema.product.id, schema.orderLine.productId)
            )
          )
          .innerJoin(
            schema.sku,
            and(
              eq(schema.sku.tenantId, schema.orderLine.tenantId),
              eq(schema.sku.id, schema.orderLine.skuId)
            )
          )
          .where(
            and(
              eq(schema.orderLine.tenantId, ctx.tenantId),
              eq(schema.orderLine.orderId, input.orderId)
            )
          )
          .orderBy(schema.orderLine.createdAt);
        return { ...header, lines };
      });
    }),
};
