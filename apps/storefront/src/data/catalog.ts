import {
  EVERSTOCK_CURRENCY,
  EVERSTOCK_SCALE,
  everstockCategories,
  everstockProducts,
} from "@RetailOS/sample-data";
import type { CatalogItem, ProductDetail, Quote } from "./commerce-types";

// Storefront mock catalog, derived from the SYNTHETIC sample dataset
// ("Everstock" — @RetailOS/sample-data, generated placeholder data, not a real
// business). Shapes match the PUBLIC commerce DTOs exactly (commerce.catalog /
// commerce.product / commerce.quote) so this can be swapped for the live
// endpoints by flipping USE_MOCK in lib/commerce.ts — no page edits. Prices are
// backend-authoritative minor units (GYD, scale 2), never computed in the UI.
// Availability is coarse ("in_stock"/"out_of_stock") — the same anti-scrape
// read model the public router exposes; derived here from the sample on-hand
// quantity.

const CURRENCY = EVERSTOCK_CURRENCY;
const SCALE = EVERSTOCK_SCALE;

function money(amountMinor: number) {
  return { amountMinor, currency: CURRENCY, scale: SCALE };
}

// Departments that are ledger artifacts in the export, not real shopping
// categories — hidden from the storefront.
const HIDDEN_CATEGORIES = new Set(["total", "fee"]);

// One representative photo per department (real product imagery, reused across
// the department — the export ships no per-SKU images). Falls back to a neutral
// parcel image for the long tail of small departments.
const DEPT_IMAGE: Record<string, string> = {
  "kitchen-appliances": "/img/dept/kitchen-appliances.png",
  fridges: "/img/dept/fridges.png",
  accessories: "/img/dept/accessories.png",
  "washers-dryers": "/img/dept/washers-dryers.png",
  freezers: "/img/dept/freezers.png",
  stoves: "/img/dept/stoves.png",
  "kitchen-ware": "/img/dept/kitchen-ware.png",
  "air-conditioning": "/img/dept/air-conditioning.png",
  television: "/img/dept/television.png",
  tv: "/img/dept/television.png",
  generator: "/img/dept/generator.png",
  microwaves: "/img/dept/microwaves.png",
  music: "/img/dept/music.png",
  fan: "/img/dept/fan.png",
  dispensers: "/img/dept/dispensers.png",
  "tools-machinary": "/img/dept/tools-machinary.png",
  mats: "/img/dept/mats.png",
  camera: "/img/dept/camera.png",
  furniture: "/img/dept/furniture.png",
  chairs: "/img/dept/furniture.png",
  table: "/img/dept/furniture.png",
  shelfs: "/img/dept/furniture.png",
  decor: "/img/dept/furniture.png",
};

function imageFor(categoryHandle: string): string {
  return DEPT_IMAGE[categoryHandle] ?? "/img/dept/generic.png";
}

// Presentation copy that is NOT part of the strict public commerce DTO —
// tagline/description/highlights/rating would come from a product-content field
// or CMS. Synthesized deterministically from the real name + department so the
// storefront reads naturally without inventing per-SKU marketing data.
export interface ProductContent {
  description: string;
  highlights: string[];
  rating: number;
  reviewCount: number;
  tagline: string;
}

const DEPT_TAGLINE: Record<string, string> = {
  "kitchen-appliances": "Everyday kitchen essentials",
  fridges: "Cool, quiet and energy-smart",
  accessories: "The little things that complete the setup",
  "washers-dryers": "Laundry day, sorted",
  freezers: "Extra storage that keeps its cool",
  stoves: "Cook with confidence",
  "kitchen-ware": "Built for the daily cook",
  "air-conditioning": "Stay cool through the dry season",
  television: "Bring the picture home",
  generator: "Power you can rely on",
  microwaves: "Fast, even, everyday heating",
  music: "Turn it up",
  fan: "Keep the air moving",
  dispensers: "Fresh water on tap",
  "tools-machinary": "For the job that needs doing",
};

// Small deterministic hash so ratings/counts are stable across renders/builds.
function hash(str: string): number {
  let h = 2_166_136_261;
  for (let i = 0; i < str.length; i++) {
    // biome-ignore lint/suspicious/noBitwiseOperators: integer hash (FNV-1a) requires bitwise mixing
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16_777_619);
  }
  // biome-ignore lint/suspicious/noBitwiseOperators: integer hash (FNV-1a) requires bitwise mixing
  return h >>> 0;
}

const HAS_PROSE_RE = /[a-z]/;

function buildContent(
  handle: string,
  name: string,
  categoryHandle: string,
  categoryName: string,
  description: string
): ProductContent {
  const h = hash(handle);
  const rating = Number((4.2 + (h % 8) / 10).toFixed(1)); // 4.2 – 4.9
  const reviewCount = 8 + (h % 240);
  const cleanDesc = description.trim();
  // The export's "description" column is often a spec code, not prose — only
  // use it when it reads like real text.
  const hasProse = HAS_PROSE_RE.test(cleanDesc) && cleanDesc.length > 3;
  return {
    tagline: DEPT_TAGLINE[categoryHandle] ?? categoryName,
    description: hasProse
      ? `${name}. ${cleanDesc}. Part of our ${categoryName} range, backed by in-store support and islandwide delivery.`
      : `${name} from our ${categoryName} range. Backed by in-store support, warranty options, and islandwide delivery across Guyana.`,
    highlights: [
      categoryName,
      hasProse ? cleanDesc : "Genuine stock",
      "Warranty available",
    ],
    rating,
    reviewCount,
  };
}

interface StoreSeed {
  availability: CatalogItem["availability"];
  categoryHandle: string;
  categoryName: string;
  content: ProductContent;
  handle: string;
  image: string;
  name: string;
  priceMinor: number;
}

const SEEDS: StoreSeed[] = everstockProducts
  .filter((p) => !HIDDEN_CATEGORIES.has(p.categoryHandle) && p.priceMinor > 0)
  .map((p) => {
    const categoryName = p.department;
    return {
      handle: p.handle,
      name: p.name,
      categoryHandle: p.categoryHandle,
      categoryName,
      priceMinor: p.priceMinor,
      image: imageFor(p.categoryHandle),
      // On-hand <= 0 (the frequent negative/zero legacy values) reads as
      // out-of-stock to shoppers; the admin sees the true signed quantity.
      availability: p.onHand > 0 ? "in_stock" : "out_of_stock",
      content: buildContent(
        p.handle,
        p.name,
        p.categoryHandle,
        categoryName,
        p.description
      ),
    } satisfies StoreSeed;
  });

export const CONTENT_BY_HANDLE: Record<string, ProductContent> =
  Object.fromEntries(SEEDS.map((s) => [s.handle, s.content]));

// Featured = a few high-value, in-stock items spread across flagship
// departments, chosen deterministically so the home page stays stable.
export const FEATURED_HANDLES: string[] = (() => {
  const flagship = ["television", "fridges", "generator", "air-conditioning"];
  const picks: string[] = [];
  for (const cat of flagship) {
    const best = SEEDS.filter(
      (s) => s.categoryHandle === cat && s.availability === "in_stock"
    ).sort((a, b) => b.priceMinor - a.priceMinor)[0];
    if (best) {
      picks.push(best.handle);
    }
  }
  // Backfill if any flagship department had no in-stock item.
  if (picks.length < 4) {
    for (const s of SEEDS) {
      if (s.availability === "in_stock" && !picks.includes(s.handle)) {
        picks.push(s.handle);
      }
      if (picks.length >= 4) {
        break;
      }
    }
  }
  return picks.slice(0, 4);
})();

export const MOCK_CATALOG: CatalogItem[] = SEEDS.map((s) => ({
  handle: s.handle,
  name: s.name,
  category: { handle: s.categoryHandle, name: s.categoryName },
  price: money(s.priceMinor),
  primaryImage: { url: s.image, altText: s.name },
  availability: s.availability,
}));

export const MOCK_PRODUCTS: Record<string, ProductDetail> = Object.fromEntries(
  SEEDS.map((s) => [
    s.handle,
    {
      handle: s.handle,
      name: s.name,
      category: { handle: s.categoryHandle, name: s.categoryName },
      price: money(s.priceMinor),
      images: [{ url: s.image, altText: s.name, isPrimary: true }],
      variants: [],
      availability: s.availability,
    } satisfies ProductDetail,
  ])
);

export const MOCK_CATEGORIES = everstockCategories
  .filter((c) => !HIDDEN_CATEGORIES.has(c.handle))
  .map((c) => ({ handle: c.handle, name: c.name }));

export function priceMinorFor(handle: string): number {
  return MOCK_PRODUCTS[handle]?.price.amountMinor ?? 0;
}

// Mock re-implementation of commerce.quote: re-prices each line from the
// current catalog and applies a single standard VAT rate. Mirrors the real
// router's contract (server is always the source of truth for totals); when
// USE_MOCK is off this is replaced by the live commerce.quote call.
const STANDARD_VAT_BPS = 1400; // 14% VAT (GRA standard rate)

export function buildMockQuote(
  lines: { handle: string; quantity: number }[]
): Quote {
  const resolved = lines
    .map((line) => {
      const product = MOCK_PRODUCTS[line.handle];
      if (!product) {
        return null;
      }
      const unitPriceMinor = product.price.amountMinor;
      const lineSubtotalMinor = unitPriceMinor * line.quantity;
      const taxMinor = Math.round(
        (lineSubtotalMinor * STANDARD_VAT_BPS) / 10_000
      );
      return {
        handle: line.handle,
        name: product.name,
        quantity: line.quantity,
        unitPriceMinor,
        lineSubtotalMinor,
        discountMinor: 0,
        taxMinor,
        lineTotalMinor: lineSubtotalMinor + taxMinor,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  const subtotalMinor = resolved.reduce((s, l) => s + l.lineSubtotalMinor, 0);
  const taxMinor = resolved.reduce((s, l) => s + l.taxMinor, 0);
  return {
    schemaVersion: 1,
    currency: CURRENCY,
    scale: SCALE,
    lines: resolved,
    taxBreakdown:
      taxMinor > 0
        ? [
            {
              baseMinor: subtotalMinor,
              name: "VAT (14%)",
              rateBps: STANDARD_VAT_BPS,
              taxMinor,
            },
          ]
        : [],
    totals: {
      subtotalMinor,
      discountMinor: 0,
      taxMinor,
      totalMinor: subtotalMinor + taxMinor,
    },
  };
}
