import type { AppRouter } from "@RetailOS/api/routers/index";
import { env } from "@RetailOS/env/web";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import {
  useMutation,
  type UseMutationResult,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  buildMockQuote,
  MOCK_CATALOG,
  MOCK_PRODUCTS,
} from "../data/catalog";
import type {
  CatalogItem,
  OrderConfirmation,
  ProductDetail,
  Quote,
  StoreCategory,
} from "../data/commerce-types";

// ---------------------------------------------------------------------------
// Data strategy (plan.md): the storefront reads through ONE swappable layer.
// USE_MOCK serves the typed mock catalog (shapes identical to the public
// commerce DTOs); flipping it to false routes the same hooks to the live public
// `commerce` oRPC router (tenant resolved from hostname, server-side). No page
// edits are needed to switch — only this flag + a running API server.
//
// It defaults to mock unless VITE_SERVER_URL is set AND the preview-no-auth
// switch is off, so the shop renders fully in a frontend-only preview.
// ---------------------------------------------------------------------------
const USE_MOCK = env.VITE_PREVIEW_NO_AUTH || !env.VITE_SERVER_URL;

const MOCK_LATENCY_MS = 300;

function mocked<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY_MS));
}

const link = new RPCLink({
  url: `${env.VITE_SERVER_URL}/rpc`,
  fetch: (url, options) => fetch(url, { ...options, credentials: "include" }),
});

const client = createORPCClient(link) as RouterClient<AppRouter>;

// --- Query functions (real | mock behind one signature) --------------------

async function fetchCatalog(q?: string): Promise<CatalogItem[]> {
  if (USE_MOCK) {
    const term = q?.trim().toLowerCase();
    const items = term
      ? MOCK_CATALOG.filter(
          (i) =>
            i.name.toLowerCase().includes(term) ||
            i.category?.name.toLowerCase().includes(term)
        )
      : MOCK_CATALOG;
    return mocked(items);
  }
  const res = await client.commerce.catalog({ q, limit: 48 });
  return res.items as CatalogItem[];
}

async function fetchCategories(): Promise<StoreCategory[]> {
  const items = await fetchCatalog();
  const map = new Map<string, StoreCategory>();
  for (const item of items) {
    if (!item.category) {
      continue;
    }
    const existing = map.get(item.category.handle);
    if (existing) {
      existing.productCount += 1;
    } else {
      map.set(item.category.handle, {
        handle: item.category.handle,
        name: item.category.name,
        productCount: 1,
      });
    }
  }
  return [...map.values()];
}

async function fetchProduct(handle: string): Promise<ProductDetail> {
  if (USE_MOCK) {
    const product = MOCK_PRODUCTS[handle];
    if (!product) {
      throw new Error("Product not found for this storefront");
    }
    return mocked(product);
  }
  return (await client.commerce.product({ handle })) as ProductDetail;
}

async function fetchQuote(
  lines: { handle: string; quantity: number }[]
): Promise<Quote> {
  if (lines.length === 0) {
    return {
      schemaVersion: 1,
      currency: "GYD",
      scale: 2,
      lines: [],
      taxBreakdown: [],
      totals: { subtotalMinor: 0, discountMinor: 0, taxMinor: 0, totalMinor: 0 },
    };
  }
  if (USE_MOCK) {
    return mocked(buildMockQuote(lines));
  }
  return (await client.commerce.quote({ lines })) as Quote;
}

export type CheckoutDetails = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  paymentMethod: "cash" | "card" | "mobile";
  note?: string;
};

function orderRef(prefix: string): string {
  const n = Math.floor(100_000 + Math.random() * 900_000);
  return `${prefix}-${n}`;
}

// Mock checkout: mirrors the customer-facing result of the real two-step flow
// (commerce.checkoutCreate -> commerce.checkoutConfirm). The live path needs a
// server-persisted guest cart (cartId + guest-token customerId, design §5/§10)
// and runs both calls inside the storefrontProcedure; the total is always the
// server's, never recomputed here. In preview we synthesize the confirmation
// from the authoritative quote so the full purchase journey is walkable.
async function submitCheckout(
  _details: CheckoutDetails,
  lines: { handle: string; quantity: number }[]
): Promise<OrderConfirmation> {
  if (USE_MOCK) {
    const quote = buildMockQuote(lines);
    return mocked({
      currency: quote.currency,
      orderNumber: orderRef("SHX"),
      saleNumber: orderRef("SALE"),
      scale: quote.scale,
      status: "confirmed",
      totalMinor: quote.totals.totalMinor,
    });
  }
  // Live: create a checkout intent for the server cart, then confirm it.
  const created = await client.commerce.checkoutCreate({
    cartId: getCartSession().cartId,
    customerId: getCartSession().customerId,
    fulfilmentType: "delivery",
  });
  return (await client.commerce.checkoutConfirm({
    checkoutIntentId: created.checkoutIntentId,
  })) as OrderConfirmation;
}

// Placeholder for the live guest-cart session (cartId + guest-token customerId).
// Wired up when USE_MOCK is off; unused in preview.
function getCartSession(): { cartId: string; customerId: string } {
  throw new Error(
    "Live checkout requires a persisted guest cart session (see commerce-cart.ts)."
  );
}

// --- Hooks -----------------------------------------------------------------

export const IS_MOCK_DATA = USE_MOCK;

export function useCatalog(q?: string): UseQueryResult<CatalogItem[]> {
  return useQuery({
    queryKey: [USE_MOCK ? "mock" : "live", "catalog", q ?? ""],
    queryFn: () => fetchCatalog(q),
  });
}

export function useCategories(): UseQueryResult<StoreCategory[]> {
  return useQuery({
    queryKey: [USE_MOCK ? "mock" : "live", "categories"],
    queryFn: fetchCategories,
  });
}

export function useProduct(handle: string): UseQueryResult<ProductDetail> {
  return useQuery({
    queryKey: [USE_MOCK ? "mock" : "live", "product", handle],
    queryFn: () => fetchProduct(handle),
  });
}

export function useQuote(
  lines: { handle: string; quantity: number }[]
): UseQueryResult<Quote> {
  return useQuery({
    queryKey: [USE_MOCK ? "mock" : "live", "quote", lines],
    queryFn: () => fetchQuote(lines),
    staleTime: 0,
  });
}

export function useCheckout(): UseMutationResult<
  OrderConfirmation,
  Error,
  {
    details: CheckoutDetails;
    lines: { handle: string; quantity: number }[];
  }
> {
  return useMutation({
    mutationFn: ({ details, lines }) => submitCheckout(details, lines),
  });
}
