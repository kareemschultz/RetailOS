import type {
  CatalogItem,
  ProductDetail,
  Quote,
} from "./commerce-types";

// Typed mock storefront catalog. Shapes match the PUBLIC commerce DTOs exactly
// (commerce.catalog / commerce.product / commerce.quote) so this can be swapped
// for the live endpoints by flipping USE_MOCK in lib/commerce.ts — no page
// edits. Prices are backend-authoritative minor units (GYD, scale 2), never
// computed in the UI. Availability is coarse ("in_stock"/"out_of_stock") — the
// same anti-scrape read model the public router will expose.

const CURRENCY = "GYD";
const SCALE = 2;

function money(amountMinor: number) {
  return { amountMinor, currency: CURRENCY, scale: SCALE };
}

// Presentation copy that is NOT part of the strict public commerce DTO —
// description/highlights/tagline/rating would come from a product-content field
// or CMS. Kept separate from the DTO-shaped data so the contract boundary stays
// honest (the real catalog/product endpoints do not return these today).
export type ProductContent = {
  tagline: string;
  description: string;
  highlights: string[];
  rating: number;
  reviewCount: number;
};

type Seed = {
  handle: string;
  name: string;
  categoryHandle: string;
  categoryName: string;
  priceMinor: number;
  image: string;
  availability: CatalogItem["availability"];
  content: ProductContent;
};

const SEEDS: Seed[] = [
  {
    handle: "highland-reserve-coffee",
    name: "Highland Reserve Coffee Beans",
    categoryHandle: "coffee-pantry",
    categoryName: "Coffee & Pantry",
    priceMinor: 450_000,
    image: "/img/coffee.png",
    availability: "in_stock",
    content: {
      tagline: "Small-batch, medium-dark, whole bean",
      description:
        "A rounded, chocolate-forward roast sourced from highland estates and roasted in small batches for a smooth, low-acidity cup. Whole bean, 340g resealable bag.",
      highlights: ["340g whole bean", "Medium-dark roast", "Roasted to order"],
      rating: 4.8,
      reviewCount: 126,
    },
  },
  {
    handle: "stoneware-pour-over-set",
    name: "Stoneware Pour-Over Set",
    categoryHandle: "kitchen",
    categoryName: "Kitchen",
    priceMinor: 890_000,
    image: "/img/mug.png",
    availability: "in_stock",
    content: {
      tagline: "Matte ceramic dripper + mug",
      description:
        "A hand-glazed stoneware dripper that nests neatly on the matching 350ml mug. Even extraction, no paper taste, and a calm stone-gray finish that suits any counter.",
      highlights: ["Dripper + 350ml mug", "Hand-glazed stoneware", "Dishwasher safe"],
      rating: 4.6,
      reviewCount: 74,
    },
  },
  {
    handle: "rattan-pendant-lamp",
    name: "Rattan Pendant Lamp",
    categoryHandle: "home-living",
    categoryName: "Home & Living",
    priceMinor: 1_575_000,
    image: "/img/lamp.png",
    availability: "in_stock",
    content: {
      tagline: "Hand-woven natural shade",
      description:
        "A warm, hand-woven rattan pendant that throws a soft dappled glow. Ships with a 1.5m braided cord and ceiling fixture. Bulb not included.",
      highlights: ["40cm hand-woven shade", "1.5m braided cord", "E27 fitting"],
      rating: 4.7,
      reviewCount: 51,
    },
  },
  {
    handle: "linen-weave-throw",
    name: "Linen Weave Throw",
    categoryHandle: "home-living",
    categoryName: "Home & Living",
    priceMinor: 1_120_000,
    image: "/img/throw.png",
    availability: "in_stock",
    content: {
      tagline: "Stonewashed pure linen",
      description:
        "A breathable, stonewashed linen throw with a subtle fringe — light enough for warm evenings, generous at 130 x 170cm. Softens with every wash.",
      highlights: ["130 x 170cm", "100% stonewashed linen", "Oeko-Tex certified"],
      rating: 4.9,
      reviewCount: 88,
    },
  },
  {
    handle: "cast-iron-skillet-12",
    name: 'Cast Iron Skillet 12"',
    categoryHandle: "kitchen",
    categoryName: "Kitchen",
    priceMinor: 980_000,
    image: "/img/skillet.png",
    availability: "in_stock",
    content: {
      tagline: "Pre-seasoned, oven to table",
      description:
        "A pre-seasoned 30cm cast iron skillet that sears, bakes, and holds heat beautifully. Pour spouts on both sides and a helper handle for a confident lift.",
      highlights: ['12" / 30cm', "Pre-seasoned", "Oven safe to 260°C"],
      rating: 4.8,
      reviewCount: 203,
    },
  },
  {
    handle: "insulated-water-bottle-750",
    name: "Insulated Water Bottle 750ml",
    categoryHandle: "bags-accessories",
    categoryName: "Bags & Accessories",
    priceMinor: 340_000,
    image: "/img/bottle.png",
    availability: "in_stock",
    content: {
      tagline: "Cold 24h, hot 12h",
      description:
        "Double-walled stainless steel in a soft powder-blue matte finish. Leakproof lid, wide mouth for ice, and a footprint that fits standard cup holders.",
      highlights: ["750ml", "Double-wall vacuum", "Leakproof lid"],
      rating: 4.5,
      reviewCount: 167,
    },
  },
  {
    handle: "soy-candle-vetiver",
    name: "Soy Wax Candle — Vetiver",
    categoryHandle: "home-living",
    categoryName: "Home & Living",
    priceMinor: 390_000,
    image: "/img/candle.png",
    availability: "in_stock",
    content: {
      tagline: "Vetiver, cedar & warm amber",
      description:
        "A clean-burning soy blend in frosted glass with a cotton wick. Grounded notes of vetiver and cedar over warm amber. ~45 hours of calm.",
      highlights: ["200g soy blend", "~45h burn time", "Cotton wick"],
      rating: 4.7,
      reviewCount: 92,
    },
  },
  {
    handle: "woven-market-tote",
    name: "Woven Market Tote",
    categoryHandle: "bags-accessories",
    categoryName: "Bags & Accessories",
    priceMinor: 625_000,
    image: "/img/tote.png",
    availability: "in_stock",
    content: {
      tagline: "Straw body, leather handles",
      description:
        "A roomy hand-woven straw tote with tanned leather handles and a snap closure. Holds a market run or a beach day with equal ease.",
      highlights: ["Hand-woven straw", "Leather handles", "Snap closure"],
      rating: 4.6,
      reviewCount: 44,
    },
  },
  {
    handle: "stoneware-dinner-set",
    name: "Stoneware Dinner Set (4)",
    categoryHandle: "kitchen",
    categoryName: "Kitchen",
    priceMinor: 1_350_000,
    image: "/img/plates.png",
    availability: "out_of_stock",
    content: {
      tagline: "Four reactive-glaze plates",
      description:
        "A set of four 27cm stoneware dinner plates in mixed sand and slate-blue reactive glazes — every piece a little different. Microwave and dishwasher safe.",
      highlights: ["Set of 4 · 27cm", "Reactive glaze", "Microwave safe"],
      rating: 4.8,
      reviewCount: 61,
    },
  },
];

export const CONTENT_BY_HANDLE: Record<string, ProductContent> =
  Object.fromEntries(SEEDS.map((s) => [s.handle, s.content]));

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

export const MOCK_CATEGORIES = Array.from(
  new Map(SEEDS.map((s) => [s.categoryHandle, s.categoryName])).entries()
).map(([handle, name]) => ({ handle, name }));

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
      const taxMinor = Math.round((lineSubtotalMinor * STANDARD_VAT_BPS) / 10_000);
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
        ? [{ label: "VAT (14%)", rateBps: STANDARD_VAT_BPS, taxMinor }]
        : [],
    totals: {
      subtotalMinor,
      discountMinor: 0,
      taxMinor,
      totalMinor: subtotalMinor + taxMinor,
    },
  };
}
