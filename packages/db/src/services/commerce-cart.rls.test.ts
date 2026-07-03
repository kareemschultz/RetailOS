// @vitest-environment node
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import {
  cart,
  cartLine,
  customer,
  organization,
  product,
  unitOfMeasure,
} from "../schema";
import { withTenant } from "../tenant";
import {
  addCartLine,
  buildCartQuote,
  getCart,
  removeCartLine,
  startGuestCart,
} from "./commerce-cart";

const url = process.env.RLS_TEST_DATABASE_URL;
const TENANT = "commerce_cart_slice_tenant";
const NOT_FOUND_RE = /not found/i;

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined || value === null) {
    throw new Error(`cart test expected ${label}`);
  }
  return value;
}

describe.skipIf(!url)("Shopix cart", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let productId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    await db
      .insert(organization)
      .values({ id: TENANT, name: "Commerce Cart Slice Tenant" })
      .onConflictDoNothing();
    productId = await withTenant(db, TENANT, async (tx) => {
      await tx.delete(cartLine);
      await tx.delete(cart);
      await tx.delete(customer);
      await tx.delete(product);
      await tx.delete(unitOfMeasure);
      const uom = required(
        (
          await tx
            .insert(unitOfMeasure)
            .values({ tenantId: TENANT, code: "EA-CART", name: "Each" })
            .returning()
        ).at(0),
        "uom"
      );
      const p = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: TENANT,
              sku: "cart-product",
              name: "Cart Product",
              baseUomId: uom.id,
              priceMinor: 500,
              currency: "USD",
            })
            .returning()
        ).at(0),
        "product"
      );
      return p.id;
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("starts a guest cart and adds/merges lines by product", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const started = await startGuestCart(tx, TENANT);
      expect(started.status).toBe("active");
      expect(started.lines).toEqual([]);

      await addCartLine(tx, TENANT, {
        cartId: started.id,
        customerId: started.customerId,
        productId,
        qty: 2,
      });
      // Adding the same product again merges into the existing line (qty
      // sums) rather than creating a duplicate row.
      await addCartLine(tx, TENANT, {
        cartId: started.id,
        customerId: started.customerId,
        productId,
        qty: 1,
      });

      const view = await getCart(tx, {
        cartId: started.id,
        customerId: started.customerId,
      });
      expect(view.lines).toHaveLength(1);
      expect(view.lines[0]?.qty).toBe(3);
    });
  });

  it("removes a line and rejects operations for the wrong customer", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const started = await startGuestCart(tx, TENANT);
      await addCartLine(tx, TENANT, {
        cartId: started.id,
        customerId: started.customerId,
        productId,
        qty: 1,
      });
      const before = await getCart(tx, {
        cartId: started.id,
        customerId: started.customerId,
      });
      const lineId = required(before.lines[0]?.id, "cart line id");

      const otherStart = await startGuestCart(tx, TENANT);
      await expect(
        removeCartLine(tx, {
          cartId: started.id,
          cartLineId: lineId,
          customerId: otherStart.customerId,
        })
      ).rejects.toThrow(NOT_FOUND_RE);

      await removeCartLine(tx, {
        cartId: started.id,
        cartLineId: lineId,
        customerId: started.customerId,
      });
      const after = await getCart(tx, {
        cartId: started.id,
        customerId: started.customerId,
      });
      expect(after.lines).toEqual([]);
    });
  });

  it("builds an authoritative quote from current product prices (never a stored line price)", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const quote = await buildCartQuote(tx, [
        {
          categoryTaxRateId: null,
          currency: "USD",
          name: "Cart Product",
          priceMinor: 500,
          productId,
          scale: 2,
          productTaxRateId: null,
          qty: 3,
        },
      ]);
      expect(quote.totals.subtotalMinor).toBe(1500);
      expect(quote.totals.taxMinor).toBe(0);
      expect(quote.totals.totalMinor).toBe(1500);
      expect(quote.lines[0]?.lineTotalMinor).toBe(1500);
    });
  });
});
