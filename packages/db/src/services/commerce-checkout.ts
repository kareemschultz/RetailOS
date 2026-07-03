import { randomBytes } from "node:crypto";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import * as schema from "../schema";
import type { TenantTransaction } from "../tenant";
import { recordAudit } from "./audit";
import { buildCartQuote, getCart } from "./commerce-cart";
import { applyValuation } from "./costing";
import { runIdempotent } from "./idempotency";
import { DomainEventType, emitEvent } from "./outbox";
import { appendStockMovement, stockOnHandForSku } from "./stock-ledger";
import type { ServiceContext } from "./types";

// Shopix design §6/§7/§9 — the checkout / reservation seam. The project's
// signature-risk surface: a public, anonymous endpoint that must never let
// two concurrent confirms oversell, deadlock, or skip valuation.
//
// LOAD-BEARING INVARIANT (design §6): stock/COGS/sale commit ONLY inside
// `confirmCheckout`'s transaction, atomically with the availability gate.
// `createCheckoutOrder` (order placement) does a coarse, non-binding check
// only — NO lock, NO deduction, NO COGS, NO sale row. A payment_pending order
// that never confirms has nothing to reverse.

const CHECKOUT_INTENT_TTL_MS = 30 * 60 * 1000; // 30 minutes (design §9 "with expiry")
// Cheap, no-infra defense (design §1.5): bounds the stock-inference probe
// range per line. A real per-IP/per-SKU rate-limit budget (Redis token
// bucket, charter §8) is NOT built here — that is deployment-time
// infrastructure this pass does not add; documented as a known gap, not
// silently skipped.
export const CHECKOUT_MAX_QTY_PER_LINE = 20;

function firstOrThrow<T>(rows: T[], label: string): T {
  const row = rows.at(0);
  if (!row) {
    throw new Error(`commerce-checkout: expected a row for ${label}`);
  }
  return row;
}

// v1 storefront simplification: exactly one sellable location. A multi-
// location storefront (choose-your-fulfilment-branch) is not built — the
// design doc's `fulfilment_location_id` seam is reserved on `order` for it.
async function resolveSellableLocation(tx: TenantTransaction) {
  const rows = await tx
    .select({
      companyId: schema.location.companyId,
      id: schema.location.id,
    })
    .from(schema.location)
    .where(
      and(
        eq(schema.location.isSellable, true),
        isNull(schema.location.deletedAt)
      )
    )
    .limit(2);
  if (rows.length !== 1) {
    throw new Error(
      "Storefront checkout requires exactly one sellable location to be configured"
    );
  }
  const row = rows[0];
  if (!row) {
    throw new Error(
      "Storefront checkout requires exactly one sellable location to be configured"
    );
  }
  return row;
}

// v1 storefront simplification: a product must resolve to exactly one active
// SKU (no variant-selection API yet — the cart/quote stay product-handle
// granularity, design §5). A multi-SKU product cannot check out until a
// variant-selection surface exists.
async function resolveSkuForProduct(
  tx: TenantTransaction,
  productId: string
): Promise<string> {
  const rows = await tx
    .select({ id: schema.sku.id })
    .from(schema.sku)
    .where(
      and(
        eq(schema.sku.productId, productId),
        eq(schema.sku.isActive, true),
        isNull(schema.sku.deletedAt)
      )
    )
    .limit(2);
  if (rows.length !== 1) {
    throw new Error(
      "One or more items in this order cannot be checked out yet (no single sellable variant)"
    );
  }
  const row = rows[0];
  if (!row) {
    throw new Error(
      "One or more items in this order cannot be checked out yet (no single sellable variant)"
    );
  }
  return row.id;
}

interface CheckoutProductRow {
  categoryTaxRateId: string | null;
  currency: string;
  name: string;
  priceMinor: number;
  productId: string;
  productTaxRateId: string | null;
  scale: number;
}

function fetchCheckoutProductRows(
  tx: TenantTransaction,
  productIds: string[]
): Promise<CheckoutProductRow[]> {
  if (productIds.length === 0) {
    return Promise.resolve([]);
  }
  return tx
    .select({
      categoryTaxRateId: schema.category.taxRateId,
      currency: schema.product.currency,
      name: schema.product.name,
      priceMinor: schema.product.priceMinor,
      productId: schema.product.id,
      productTaxRateId: schema.product.taxRateId,
      scale: schema.product.scale,
    })
    .from(schema.product)
    .leftJoin(
      schema.category,
      eq(schema.product.categoryId, schema.category.id)
    )
    .where(
      and(
        inArray(schema.product.id, productIds),
        isNull(schema.product.deletedAt)
      )
    );
}

export interface CreateCheckoutOrderInput {
  cartId: string;
  customerId: string;
  fulfilmentType?: (typeof schema.FULFILMENT_TYPES)[number];
}

// Order placement — coarse, NON-BINDING availability only (design §6). No
// lock, no deduction, no COGS, no sale row. Marks the cart "converted" so a
// second concurrent placement from the same cart is rejected (one order per
// cart), independent of whether the order ever pays.
export async function createCheckoutOrder(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: CreateCheckoutOrderInput
) {
  const cart = await getCart(tx, {
    cartId: input.cartId,
    customerId: input.customerId,
  });
  if (cart.status !== "active") {
    throw new Error(`Cart is ${cart.status}, not active`);
  }
  if (cart.lines.length === 0) {
    throw new Error("Cart is empty");
  }
  for (const line of cart.lines) {
    if (line.qty > CHECKOUT_MAX_QTY_PER_LINE) {
      throw new Error(
        "One or more cart lines exceed the maximum checkout quantity"
      );
    }
  }

  const productRows = await fetchCheckoutProductRows(
    tx,
    cart.lines.map((line) => line.productId)
  );
  const byProductId = new Map(productRows.map((row) => [row.productId, row]));
  const first = productRows.at(0);
  if (!first) {
    throw new Error("Cart products are no longer available in this storefront");
  }
  const mixedCurrency = productRows.some(
    (row) => row.currency !== first.currency || row.scale !== first.scale
  );
  if (mixedCurrency) {
    throw new Error("A checkout order must use one currency and scale");
  }

  const quoteLines = cart.lines.map((line) => {
    const product = byProductId.get(line.productId);
    if (!product) {
      throw new Error("A cart item is no longer available in this storefront");
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
  const quote = await buildCartQuote(tx, quoteLines);

  const skuByProductId = new Map<string, string>();
  for (const line of cart.lines) {
    if (!skuByProductId.has(line.productId)) {
      skuByProductId.set(
        line.productId,
        await resolveSkuForProduct(tx, line.productId)
      );
    }
  }

  const location = await resolveSellableLocation(tx);
  const checkoutIntentId = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + CHECKOUT_INTENT_TTL_MS);

  const orderRow = firstOrThrow(
    await tx
      .insert(schema.order)
      .values({
        checkoutIntentId,
        currency: first.currency,
        customerId: input.customerId,
        expiresAt,
        fulfilmentType: input.fulfilmentType ?? "pickup",
        locationId: location.id,
        scale: first.scale,
        status: "payment_pending",
        tenantId: ctx.tenantId,
        totalMinor: quote.totals.totalMinor,
      })
      .returning(),
    "order"
  );

  const orderLines: (typeof schema.orderLine.$inferSelect)[] = [];
  for (let i = 0; i < cart.lines.length; i++) {
    const cartLine = cart.lines[i];
    const quoted = quote.lines[i];
    if (!(cartLine && quoted)) {
      throw new Error("commerce-checkout: cart/quote line mismatch");
    }
    const skuId = skuByProductId.get(cartLine.productId);
    if (!skuId) {
      throw new Error("commerce-checkout: missing resolved SKU for cart line");
    }
    const row = firstOrThrow(
      await tx
        .insert(schema.orderLine)
        .values({
          lineSubtotalMinor: quoted.lineSubtotalMinor,
          lineTaxMinor: quoted.lineTaxMinor,
          orderId: orderRow.id,
          productId: cartLine.productId,
          qty: cartLine.qty,
          skuId,
          tenantId: ctx.tenantId,
          unitPriceMinor: quoted.unitPriceMinor,
        })
        .returning(),
      "order_line"
    );
    orderLines.push(row);
  }

  await tx
    .update(schema.cart)
    .set({ status: "converted", updatedAt: new Date() })
    .where(eq(schema.cart.id, cart.id));

  await recordAudit(tx, ctx, {
    action: "commerce.checkout_create",
    after: orderRow,
    entityId: orderRow.id,
    entityType: "order",
  });

  return {
    checkoutIntentId,
    expiresAt,
    lines: orderLines,
    order: orderRow,
    taxBreakdown: quote.taxBreakdown,
  };
}

async function allocateSaleAndOrderNumbers(
  tx: TenantTransaction,
  tenantId: string
) {
  // Same `docnum:${tenantId}` lock key POS's allocateSaleNumber uses, so
  // sale-number allocation is serialized across BOTH channels (POS + Shopix)
  // — genuinely disjoint numbers, charter §17.
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`docnum:${tenantId}`}, 0))`
  );
  const saleSeq =
    ((await tx.select({ c: count() }).from(schema.sale)).at(0)?.c ?? 0) + 1;
  const orderSeq =
    ((await tx.select({ c: count() }).from(schema.order)).at(0)?.c ?? 0) + 1;
  return { orderNumber: `ORDER-${orderSeq}`, saleNumber: `SALE-${saleSeq}` };
}

export interface ConfirmCheckoutInput {
  checkoutIntentId: string;
}

export interface ConfirmCheckoutResult {
  currency: string;
  orderId: string;
  orderNumber: string;
  saleId: string;
  saleNumber: string;
  scale: number;
  status: "paid";
  totalMinor: number;
}

// The atomic gate + deduct + valuation + sale/tender write, all inside the
// SAME canonically-lock-ordered transaction (design §6). On an availability
// failure this just throws — it deliberately does NOT try to persist an
// "unavailable" status transition in the same (about-to-roll-back)
// transaction; the order stays `payment_pending` and expires naturally. A
// second, separate mutation to mark it `unavailable` immediately is a
// possible follow-up, not required for correctness.
export async function confirmCheckout(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: ConfirmCheckoutInput
): Promise<ConfirmCheckoutResult> {
  return await runIdempotent(
    tx,
    ctx,
    `checkout:${input.checkoutIntentId}`,
    input,
    async () => {
      const orderRow = (
        await tx
          .select()
          .from(schema.order)
          .where(eq(schema.order.checkoutIntentId, input.checkoutIntentId))
          .limit(1)
      ).at(0);
      if (!orderRow) {
        throw new Error("Checkout order not found");
      }
      if (orderRow.status !== "payment_pending") {
        throw new Error(`Order is ${orderRow.status}, not payment_pending`);
      }
      if (orderRow.expiresAt.getTime() < Date.now()) {
        throw new Error("Checkout intent has expired");
      }

      const lines = await tx
        .select()
        .from(schema.orderLine)
        .where(eq(schema.orderLine.orderId, orderRow.id));
      if (lines.length === 0) {
        throw new Error("commerce-checkout: order has no lines");
      }

      // Step 1 (design §6): aggregate requested qty by stock cell, then
      // acquire every cell's advisory lock in a canonical (lexicographic)
      // order — removes the deadlock cycle a per-line unordered acquire
      // would allow against a concurrent POS sale or another confirm.
      const cells = new Map<string, { qty: number; skuId: string }>();
      for (const line of lines) {
        const key = `${ctx.tenantId}:${orderRow.locationId}:${line.skuId}`;
        const existing = cells.get(key);
        if (existing) {
          existing.qty += line.qty;
        } else {
          cells.set(key, { qty: line.qty, skuId: line.skuId });
        }
      }
      for (const key of [...cells.keys()].sort()) {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`
        );
      }

      // Step 2: availability gate under the locks. Generic error — never
      // reveals the threshold or exact stock (design §1.5 stock-probing
      // defense).
      for (const cell of cells.values()) {
        const onHand = await stockOnHandForSku(
          tx,
          orderRow.locationId,
          cell.skuId
        );
        if (onHand < cell.qty) {
          throw new Error("COMMERCE_UNAVAILABLE");
        }
      }

      const locationRow = (
        await tx
          .select({ companyId: schema.location.companyId })
          .from(schema.location)
          .where(eq(schema.location.id, orderRow.locationId))
          .limit(1)
      ).at(0);
      if (!locationRow) {
        throw new Error("commerce-checkout: fulfilment location not found");
      }

      const { orderNumber, saleNumber } = await allocateSaleAndOrderNumbers(
        tx,
        ctx.tenantId
      );

      const subtotalMinor = lines.reduce(
        (sum, line) => sum + line.lineSubtotalMinor,
        0
      );
      const taxMinor = lines.reduce((sum, line) => sum + line.lineTaxMinor, 0);

      // Step 3/4 (design §6): the REAL financial document — the storefront is
      // a channel on the SAME shared ledger (charter §21), not a parallel
      // posting path.
      const saleRow = firstOrThrow(
        await tx
          .insert(schema.sale)
          .values({
            currency: orderRow.currency,
            customerId: orderRow.customerId,
            discountMinor: 0,
            idempotencyKey: `checkout:${input.checkoutIntentId}`,
            locationId: orderRow.locationId,
            number: saleNumber,
            saleType: "sale",
            scale: orderRow.scale,
            status: "completed",
            subtotalMinor,
            taxMinor,
            tenantId: ctx.tenantId,
            totalMinor: orderRow.totalMinor,
          })
          .returning(),
        "sale"
      );

      const eventLines: unknown[] = [];
      for (const line of lines) {
        const saleLineRow = firstOrThrow(
          await tx
            .insert(schema.saleLine)
            .values({
              lineTaxMinor: line.lineTaxMinor,
              productId: line.productId,
              qty: line.qty,
              qtyBase: line.qty,
              saleId: saleRow.id,
              skuId: line.skuId,
              tenantId: ctx.tenantId,
              unitPriceMinor: line.unitPriceMinor,
            })
            .returning(),
          "sale_line"
        );

        const movement = await appendStockMovement(tx, ctx, {
          idempotencyKey: `checkout:${input.checkoutIntentId}:${line.id}`,
          locationId: orderRow.locationId,
          movementType: "sale",
          productId: line.productId,
          qtyDelta: -line.qty,
          refId: saleRow.id,
          refType: "sale",
          skuId: line.skuId,
        });
        // #8 — the write path invokes valuation UNCONDITIONALLY. skuId is
        // always present (resolved at order-create), so this never skips.
        const valuation = await applyValuation(tx, ctx, movement);
        await tx
          .update(schema.saleLine)
          .set({
            cogsCurrency: valuation.currency,
            cogsMinor: valuation.cogsMinor,
            cogsScale: valuation.scale,
            costingMethodApplied: valuation.method,
          })
          .where(eq(schema.saleLine.id, saleLineRow.id));

        await tx
          .update(schema.orderLine)
          .set({ saleLineId: saleLineRow.id, updatedAt: new Date() })
          .where(eq(schema.orderLine.id, line.id));

        eventLines.push({
          cogsCurrency: valuation.currency,
          cogsMinor: valuation.cogsMinor,
          cogsScale: valuation.scale,
          costingMethodApplied: valuation.method,
          discountMinor: 0,
          lineSubtotalMinor: line.lineSubtotalMinor,
          lineTaxMinor: line.lineTaxMinor,
          productId: line.productId,
          qty: line.qty,
          qtyBase: line.qty,
          skuId: line.skuId,
          taxRateId: null,
          unitPriceMinor: line.unitPriceMinor,
        });
      }

      const tenderRow = firstOrThrow(
        await tx
          .insert(schema.tender)
          .values({
            amountMinor: orderRow.totalMinor,
            changeMinor: 0,
            currency: orderRow.currency,
            method: "online",
            saleId: saleRow.id,
            scale: orderRow.scale,
            settledAmountMinor: orderRow.totalMinor,
            tenantId: ctx.tenantId,
          })
          .returning(),
        "tender"
      );

      await tx
        .update(schema.order)
        .set({
          number: orderNumber,
          saleId: saleRow.id,
          status: "paid",
          updatedAt: new Date(),
        })
        .where(eq(schema.order.id, orderRow.id));

      await recordAudit(tx, ctx, {
        action: "commerce.checkout_confirm",
        after: { orderId: orderRow.id, saleId: saleRow.id },
        entityId: orderRow.id,
        entityType: "order",
      });

      // sale.created / payment.received — the SAME event contract POS emits
      // (design §8), channel-marked so the (unbuilt) Phase-5 GL consumer
      // needs zero new consumer code for an online sale. Functional-currency
      // + commission fields reserved present-but-null, matching POS's own
      // MSP-era emission (event-map-phase4.md).
      await emitEvent(tx, ctx, {
        payload: {
          channel: "online",
          commissionAccrualPolicy: null,
          commissionFunctionalMinor: null,
          commissionMinor: null,
          companyId: locationRow.companyId,
          createdBy: null,
          currency: orderRow.currency,
          customerId: orderRow.customerId,
          discountFunctionalMinor: null,
          discountMinor: 0,
          exchangeGroupId: null,
          functionalCurrency: null,
          functionalScale: null,
          fxRateToFunctional: null,
          lines: eventLines,
          locationId: orderRow.locationId,
          number: saleNumber,
          orderId: orderRow.id,
          saleId: saleRow.id,
          scale: orderRow.scale,
          shiftId: null,
          subtotalMinor,
          taxMinor,
          totalMinor: orderRow.totalMinor,
        },
        type: DomainEventType.SaleCreated,
      });

      await emitEvent(tx, ctx, {
        payload: {
          amountMinor: orderRow.totalMinor,
          changeMinor: 0,
          channel: "online",
          companyId: locationRow.companyId,
          currency: orderRow.currency,
          locationId: orderRow.locationId,
          method: "online",
          paymentId: tenderRow.id,
          receivedBy: null,
          saleCurrency: orderRow.currency,
          saleId: saleRow.id,
          saleScale: orderRow.scale,
          scale: orderRow.scale,
          settledAmountMinor: orderRow.totalMinor,
          shiftId: null,
          sourceId: saleRow.id,
          sourceType: "sale",
          tenderId: tenderRow.id,
        },
        type: DomainEventType.PaymentReceived,
      });

      return {
        currency: orderRow.currency,
        orderId: orderRow.id,
        orderNumber,
        saleId: saleRow.id,
        saleNumber,
        scale: orderRow.scale,
        status: "paid" as const,
        totalMinor: orderRow.totalMinor,
      };
    }
  );
}
