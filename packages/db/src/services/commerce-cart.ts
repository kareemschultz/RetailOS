import { and, eq, isNull } from "drizzle-orm";
import * as schema from "../schema";
import type { TenantTransaction } from "../tenant";
import { calculateQuoteTax } from "./tax";

// Shopix design §5/§10 — server-persisted cart, only once a guest/customer
// principal exists (anonymous browsing carts client-side; that path never
// touches this service). v1 keeps cart lines at PRODUCT-handle granularity —
// the same granularity `commerce.quote` already uses; adding SKU-level lines
// is deferred to when checkout (design §6, next build step) needs a specific
// stock cell to deduct from, not introduced here.
//
// v1 guest token = the customer id itself (a server-minted, unguessable
// uuid), treated as an opaque bearer credential the client re-submits on
// every cart call — simpler than a dedicated signed/expiring token (§1.4) and
// no less secure than a typical opaque session id as long as it is never
// enumerable. A dedicated signed guest token is deferred, not silently
// skipped — noted here so it isn't mistaken for the final design.

export interface CartLineView {
  id: string;
  productId: string;
  qty: number;
}

export interface CartView {
  customerId: string;
  id: string;
  lines: CartLineView[];
  status: (typeof schema.CART_STATUSES)[number];
}

export async function startGuestCart(
  tx: TenantTransaction,
  tenantId: string
): Promise<CartView> {
  const customer = (
    await tx
      .insert(schema.customer)
      .values({ isGuest: true, tenantId })
      .returning({ id: schema.customer.id })
  ).at(0);
  if (!customer) {
    throw new Error("Failed to create guest customer");
  }
  const cart = (
    await tx
      .insert(schema.cart)
      .values({ customerId: customer.id, status: "active", tenantId })
      .returning({ id: schema.cart.id, status: schema.cart.status })
  ).at(0);
  if (!cart) {
    throw new Error("Failed to create cart");
  }
  return {
    customerId: customer.id,
    id: cart.id,
    lines: [],
    status: cart.status,
  };
}

async function assertActiveCartForCustomer(
  tx: TenantTransaction,
  cartId: string,
  customerId: string
) {
  const row = (
    await tx
      .select({ status: schema.cart.status })
      .from(schema.cart)
      .where(
        and(eq(schema.cart.id, cartId), eq(schema.cart.customerId, customerId))
      )
      .limit(1)
  ).at(0);
  if (!row) {
    throw new Error("Cart not found for this customer");
  }
  if (row.status !== "active") {
    throw new Error(`Cart is ${row.status}, not active`);
  }
}

export async function addCartLine(
  tx: TenantTransaction,
  tenantId: string,
  args: { cartId: string; customerId: string; productId: string; qty: number }
): Promise<void> {
  await assertActiveCartForCustomer(tx, args.cartId, args.customerId);
  const existing = (
    await tx
      .select({ id: schema.cartLine.id, qty: schema.cartLine.qty })
      .from(schema.cartLine)
      .where(
        and(
          eq(schema.cartLine.cartId, args.cartId),
          eq(schema.cartLine.productId, args.productId),
          isNull(schema.cartLine.skuId)
        )
      )
      .limit(1)
  ).at(0);
  if (existing) {
    await tx
      .update(schema.cartLine)
      .set({ qty: existing.qty + args.qty, updatedAt: new Date() })
      .where(eq(schema.cartLine.id, existing.id));
    return;
  }
  await tx.insert(schema.cartLine).values({
    cartId: args.cartId,
    productId: args.productId,
    qty: args.qty,
    tenantId,
  });
}

export async function removeCartLine(
  tx: TenantTransaction,
  args: { cartId: string; cartLineId: string; customerId: string }
): Promise<void> {
  await assertActiveCartForCustomer(tx, args.cartId, args.customerId);
  // Cart lines are ephemeral pre-checkout shopping state, never a financial
  // or audited record — a real delete here (unlike operational/ledger data)
  // is the correct, honest representation of "removed from cart."
  await tx
    .delete(schema.cartLine)
    .where(
      and(
        eq(schema.cartLine.id, args.cartLineId),
        eq(schema.cartLine.cartId, args.cartId)
      )
    );
}

export async function getCart(
  tx: TenantTransaction,
  args: { cartId: string; customerId: string }
): Promise<CartView> {
  const cartRow = (
    await tx
      .select({ status: schema.cart.status })
      .from(schema.cart)
      .where(
        and(
          eq(schema.cart.id, args.cartId),
          eq(schema.cart.customerId, args.customerId)
        )
      )
      .limit(1)
  ).at(0);
  if (!cartRow) {
    throw new Error("Cart not found for this customer");
  }
  const lines = await tx
    .select({
      id: schema.cartLine.id,
      productId: schema.cartLine.productId,
      qty: schema.cartLine.qty,
    })
    .from(schema.cartLine)
    .where(eq(schema.cartLine.cartId, args.cartId))
    .orderBy(schema.cartLine.createdAt);
  return {
    customerId: args.customerId,
    id: args.cartId,
    lines,
    status: cartRow.status,
  };
}

export interface CartQuoteLineInput {
  categoryTaxRateId: string | null;
  currency: string;
  name: string;
  priceMinor: number;
  productId: string;
  productTaxRateId: string | null;
  qty: number;
  scale: number;
}

// The authoritative cart total — always re-priced/re-taxed server-side from
// the CURRENT product rows the caller supplies (never trusted from the
// client, design §5). Reuses the exact tax primitive `commerce.quote` uses so
// a cart total and a fresh quote of the same lines never diverge.
export async function buildCartQuote(
  tx: TenantTransaction,
  lines: CartQuoteLineInput[]
) {
  const taxResult = await calculateQuoteTax(
    tx,
    lines.map((line) => ({
      categoryTaxRateId: line.categoryTaxRateId,
      lineBaseMinor: line.priceMinor * line.qty,
      productTaxRateId: line.productTaxRateId,
    }))
  );
  const quotedLines = lines.map((line, index) => {
    const lineSubtotalMinor = line.priceMinor * line.qty;
    const lineTaxMinor = taxResult.lines[index]?.lineTaxMinor ?? 0;
    return {
      lineSubtotalMinor,
      lineTaxMinor,
      lineTotalMinor: lineSubtotalMinor + lineTaxMinor,
      name: line.name,
      productId: line.productId,
      qty: line.qty,
      unitPriceMinor: line.priceMinor,
    };
  });
  const subtotalMinor = quotedLines.reduce(
    (sum, line) => sum + line.lineSubtotalMinor,
    0
  );
  return {
    lines: quotedLines,
    taxBreakdown: taxResult.taxBreakdown,
    totals: {
      subtotalMinor,
      taxMinor: taxResult.taxMinor,
      totalMinor: subtotalMinor + taxResult.taxMinor,
    },
  };
}
