// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import {
  avgCost,
  cart,
  cartLine,
  category,
  company,
  customer,
  location,
  order,
  orderLine,
  organization,
  product,
  sale,
  saleLine,
  sku,
  stockLedger,
  tender,
  unitOfMeasure,
  valuationLayer,
} from "../schema";
import type { TenantTransaction } from "../tenant";
import { withTenant } from "../tenant";
import { addCartLine, startGuestCart } from "./commerce-cart";
import { confirmCheckout, createCheckoutOrder } from "./commerce-checkout";
import { applyValuation } from "./costing";
import { appendStockMovement } from "./stock-ledger";

const url = process.env.RLS_TEST_DATABASE_URL;
const TENANT = "commerce_checkout_slice_tenant";
const CTX = { tenantId: TENANT };
const CONVERTED_RE = /converted/i;
const HAS_DIGIT_RE = /\d/;
const EXPIRED_RE = /expired/i;

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined || value === null) {
    throw new Error(`checkout test expected ${label}`);
  }
  return value;
}

// Seeds real, VALUED stock — appendStockMovement alone does not populate
// avg_cost/valuation_layer; a receipt needs applyValuation too, exactly like
// every real receiving path, or the later sale has no cost basis to consume.
async function receiveStock(
  tx: TenantTransaction,
  opts: {
    locationId: string;
    productId: string;
    qty: number;
    skuId: string;
    unitCostMinor: number;
  }
) {
  const movement = await appendStockMovement(tx, CTX, {
    costCurrency: "USD",
    costScale: 2,
    locationId: opts.locationId,
    movementType: "receipt",
    productId: opts.productId,
    qtyDelta: opts.qty,
    skuId: opts.skuId,
    unitCostMinor: opts.unitCostMinor,
  });
  await applyValuation(tx, CTX, movement);
}

async function seedProduct(
  tx: TenantTransaction,
  opts: { skuCode: string; sku: string; uomId: string }
) {
  const p = required(
    (
      await tx
        .insert(product)
        .values({
          currency: "USD",
          name: `Checkout ${opts.sku}`,
          priceMinor: 1000,
          sku: opts.sku,
          tenantId: TENANT,
          baseUomId: opts.uomId,
        })
        .returning()
    ).at(0),
    "product"
  );
  const s = required(
    (
      await tx
        .insert(sku)
        .values({
          code: opts.skuCode,
          productId: p.id,
          tenantId: TENANT,
          baseUomId: opts.uomId,
        })
        .returning()
    ).at(0),
    "sku"
  );
  return { productId: p.id, skuId: s.id };
}

describe.skipIf(!url)("Shopix checkout (confirmCheckout)", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let uomId: string;
  let locationId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    await db
      .insert(organization)
      .values({ id: TENANT, name: "Commerce Checkout Slice Tenant" })
      .onConflictDoNothing();

    const ids = await withTenant(db, TENANT, async (tx) => {
      await tx.delete(orderLine);
      await tx.delete(order);
      await tx.delete(cartLine);
      await tx.delete(cart);
      await tx.delete(customer);
      await tx.delete(saleLine);
      await tx.delete(tender);
      await tx.delete(sale);
      await tx.delete(valuationLayer);
      await tx.delete(avgCost);
      await tx.delete(stockLedger);
      await tx.delete(sku);
      await tx.delete(product);
      await tx.delete(category);
      await tx.delete(location);
      await tx.delete(company);
      await tx.delete(unitOfMeasure);

      const uom = required(
        (
          await tx
            .insert(unitOfMeasure)
            .values({ code: "EA-CO", name: "Each", tenantId: TENANT })
            .returning()
        ).at(0),
        "uom"
      );
      const co = required(
        (
          await tx
            .insert(company)
            .values({ name: "Checkout Co", tenantId: TENANT })
            .returning()
        ).at(0),
        "company"
      );
      const loc = required(
        (
          await tx
            .insert(location)
            .values({
              companyId: co.id,
              isSellable: true,
              name: "Storefront Fulfilment",
              tenantId: TENANT,
              type: "store",
            })
            .returning()
        ).at(0),
        "location"
      );
      return { locationId: loc.id, uomId: uom.id };
    });
    uomId = ids.uomId;
    locationId = ids.locationId;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("confirms a checkout: deducts stock, stamps COGS, emits a real sale/tender", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const { productId, skuId } = await seedProduct(tx, {
        sku: "co-happy",
        skuCode: "CO-HAPPY",
        uomId,
      });
      await receiveStock(tx, {
        locationId,
        productId,
        qty: 10,
        skuId,
        unitCostMinor: 500,
      });

      const started = await startGuestCart(tx, TENANT);
      await addCartLine(tx, TENANT, {
        cartId: started.id,
        customerId: started.customerId,
        productId,
        qty: 3,
      });

      const created = await createCheckoutOrder(tx, CTX, {
        cartId: started.id,
        customerId: started.customerId,
      });
      expect(created.order.status).toBe("payment_pending");
      expect(created.order.saleId).toBeNull();
      expect(created.order.number).toBeNull();

      const confirmed = await confirmCheckout(tx, CTX, {
        checkoutIntentId: created.checkoutIntentId,
      });
      expect(confirmed.status).toBe("paid");
      expect(confirmed.totalMinor).toBe(3000);

      const saleLineRow = required(
        (
          await tx
            .select()
            .from(saleLine)
            .where(eq(saleLine.saleId, confirmed.saleId))
        ).at(0),
        "sale line"
      );
      // #8 — the write path invoked valuation: COGS is stamped, not null.
      expect(saleLineRow.cogsMinor).toBe(1500); // 3 * 500
      expect(saleLineRow.costingMethodApplied).toBeTruthy();

      const tenderRow = required(
        (
          await tx
            .select()
            .from(tender)
            .where(eq(tender.saleId, confirmed.saleId))
        ).at(0),
        "tender"
      );
      expect(tenderRow.method).toBe("online");
      expect(tenderRow.amountMinor).toBe(3000);

      const orderRow = required(
        (
          await tx.select().from(order).where(eq(order.id, created.order.id))
        ).at(0),
        "order row"
      );
      expect(orderRow.status).toBe("paid");
      expect(orderRow.saleId).toBe(confirmed.saleId);
      expect(orderRow.number).toBe(confirmed.orderNumber);
    });
  });

  it("is idempotent: a repeated confirm with the same checkoutIntentId does not double-deduct", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const { productId, skuId } = await seedProduct(tx, {
        sku: "co-idem",
        skuCode: "CO-IDEM",
        uomId,
      });
      await receiveStock(tx, {
        locationId,
        productId,
        qty: 5,
        skuId,
        unitCostMinor: 200,
      });
      const started = await startGuestCart(tx, TENANT);
      await addCartLine(tx, TENANT, {
        cartId: started.id,
        customerId: started.customerId,
        productId,
        qty: 2,
      });
      const created = await createCheckoutOrder(tx, CTX, {
        cartId: started.id,
        customerId: started.customerId,
      });

      const first = await confirmCheckout(tx, CTX, {
        checkoutIntentId: created.checkoutIntentId,
      });
      const second = await confirmCheckout(tx, CTX, {
        checkoutIntentId: created.checkoutIntentId,
      });
      expect(second).toEqual(first);

      const movements = await tx
        .select()
        .from(stockLedger)
        .where(eq(stockLedger.skuId, skuId));
      // one receipt (+5) + exactly one sale deduction (-2), never two.
      expect(movements).toHaveLength(2);
    });
  });

  it("rejects confirm on an expired checkout intent", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const { productId, skuId } = await seedProduct(tx, {
        sku: "co-expired",
        skuCode: "CO-EXPIRED",
        uomId,
      });
      await receiveStock(tx, {
        locationId,
        productId,
        qty: 5,
        skuId,
        unitCostMinor: 100,
      });
      const started = await startGuestCart(tx, TENANT);
      await addCartLine(tx, TENANT, {
        cartId: started.id,
        customerId: started.customerId,
        productId,
        qty: 1,
      });
      const created = await createCheckoutOrder(tx, CTX, {
        cartId: started.id,
        customerId: started.customerId,
      });
      // Force the intent into the past.
      await tx
        .update(order)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(order.id, created.order.id));

      await expect(
        confirmCheckout(tx, CTX, { checkoutIntentId: created.checkoutIntentId })
      ).rejects.toThrow(EXPIRED_RE);
    });
  });

  it("rejects confirm with a generic error when stock is unavailable, revealing no numbers", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const { productId, skuId } = await seedProduct(tx, {
        sku: "co-unavailable",
        skuCode: "CO-UNAVAIL",
        uomId,
      });
      await receiveStock(tx, {
        locationId,
        productId,
        qty: 1,
        skuId,
        unitCostMinor: 100,
      });
      const started = await startGuestCart(tx, TENANT);
      await addCartLine(tx, TENANT, {
        cartId: started.id,
        customerId: started.customerId,
        productId,
        qty: 5,
      });
      const created = await createCheckoutOrder(tx, CTX, {
        cartId: started.id,
        customerId: started.customerId,
      });

      let caught: unknown;
      try {
        await confirmCheckout(tx, CTX, {
          checkoutIntentId: created.checkoutIntentId,
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(Error);
      const message = (caught as Error).message;
      expect(message).toBe("COMMERCE_UNAVAILABLE");
      expect(message).not.toMatch(HAS_DIGIT_RE); // never reveals a threshold/on-hand number
    });
  });

  it("only ONE order can be created from a cart — a second placement is rejected", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const { productId, skuId } = await seedProduct(tx, {
        sku: "co-onecart",
        skuCode: "CO-ONECART",
        uomId,
      });
      await receiveStock(tx, {
        locationId,
        productId,
        qty: 5,
        skuId,
        unitCostMinor: 100,
      });
      const started = await startGuestCart(tx, TENANT);
      await addCartLine(tx, TENANT, {
        cartId: started.id,
        customerId: started.customerId,
        productId,
        qty: 1,
      });
      await createCheckoutOrder(tx, CTX, {
        cartId: started.id,
        customerId: started.customerId,
      });
      await expect(
        createCheckoutOrder(tx, CTX, {
          cartId: started.id,
          customerId: started.customerId,
        })
      ).rejects.toThrow(CONVERTED_RE);
    });
  });

  it("LOAD-BEARING: two concurrent confirms racing for the last unit — exactly one wins, stock never goes negative", async () => {
    // Each confirm needs its OWN transaction/connection to exercise real
    // concurrency (the canonical-lock-ordering + availability-gate
    // invariant, design §6) — sharing one `tx` would just serialize them
    // trivially and prove nothing.
    const { productId, skuId } = await withTenant(db, TENANT, (tx) =>
      seedProduct(tx, { sku: "co-race", skuCode: "CO-RACE", uomId })
    );
    await withTenant(db, TENANT, (tx) =>
      receiveStock(tx, {
        locationId,
        productId,
        qty: 1,
        skuId,
        unitCostMinor: 100,
      })
    );

    const orderA = await withTenant(db, TENANT, async (tx) => {
      const started = await startGuestCart(tx, TENANT);
      await addCartLine(tx, TENANT, {
        cartId: started.id,
        customerId: started.customerId,
        productId,
        qty: 1,
      });
      return await createCheckoutOrder(tx, CTX, {
        cartId: started.id,
        customerId: started.customerId,
      });
    });
    const orderB = await withTenant(db, TENANT, async (tx) => {
      const started = await startGuestCart(tx, TENANT);
      await addCartLine(tx, TENANT, {
        cartId: started.id,
        customerId: started.customerId,
        productId,
        qty: 1,
      });
      return await createCheckoutOrder(tx, CTX, {
        cartId: started.id,
        customerId: started.customerId,
      });
    });

    const results = await Promise.allSettled([
      withTenant(db, TENANT, (tx) =>
        confirmCheckout(tx, CTX, { checkoutIntentId: orderA.checkoutIntentId })
      ),
      withTenant(db, TENANT, (tx) =>
        confirmCheckout(tx, CTX, { checkoutIntentId: orderB.checkoutIntentId })
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toBe(
      "COMMERCE_UNAVAILABLE"
    );

    // Never negative — the ledger's running balance proves the gate actually
    // serialized the two writers rather than racing past each other.
    const movements = await withTenant(db, TENANT, (tx) =>
      tx.select().from(stockLedger).where(eq(stockLedger.skuId, skuId))
    );
    const finalBalance = movements.at(-1)?.balanceAfter ?? Number.NaN;
    expect(finalBalance).toBeGreaterThanOrEqual(0);
    expect(movements).toHaveLength(2); // receipt(+1) + exactly one sale(-1)
  });
});
