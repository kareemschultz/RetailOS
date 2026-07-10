import type { AppRouter } from "@RetailOS/api/routers/index";
import { env } from "@RetailOS/env/web";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import {
  buildMockQuote,
  MOCK_CATALOG,
  MOCK_PRODUCTS,
} from "../data/catalog";
import type {
  CatalogItem,
  ProductDetail,
  Quote,
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

// --- Hooks -----------------------------------------------------------------

export const IS_MOCK_DATA = USE_MOCK;

export function useCatalog(q?: string): UseQueryResult<CatalogItem[]> {
  return useQuery({
    queryKey: [USE_MOCK ? "mock" : "live", "catalog", q ?? ""],
    queryFn: () => fetchCatalog(q),
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
