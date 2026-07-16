// Storefront DTO types — a faithful mirror of the PUBLIC `commerce` oRPC router
// output (packages/api/src/routers/commerce.ts). Keeping these shapes exact is
// what lets the mock layer be swapped for the live endpoints with zero page
// edits (plan.md — "Real API + typed mock"). Only fields the public router
// actually ships are modeled here; cost/margin/qty/internal ids are never part
// of the public contract and never appear.

export interface Money {
  amountMinor: number;
  currency: string;
  scale: number;
}

export type PublicCategory = {
  handle: string;
  name: string;
} | null;

export interface PublicImage {
  altText: string | null;
  isPrimary: boolean;
  url: string;
}

// Derived client-side from catalog items' `category` field (the public router
// has no separate categories endpoint) — used for nav and category tiles.
export interface StoreCategory {
  handle: string;
  name: string;
  productCount: number;
}

// commerce.catalog -> items[]
export interface CatalogItem {
  availability: "unknown" | "in_stock" | "out_of_stock";
  category: PublicCategory;
  handle: string;
  name: string;
  price: Money;
  primaryImage: { url: string; altText: string | null } | null;
}

// commerce.product -> full product view
export interface ProductDetail {
  availability: "unknown" | "in_stock" | "out_of_stock";
  category: PublicCategory;
  handle: string;
  images: PublicImage[];
  name: string;
  price: Money;
  variants: { code: string; name: string }[];
}

// commerce.quote -> re-priced, real-tax cart quote
export interface QuoteLine {
  discountMinor: number;
  handle: string;
  lineSubtotalMinor: number;
  lineTotalMinor: number;
  name: string;
  quantity: number;
  taxMinor: number;
  unitPriceMinor: number;
}

export interface TaxBreakdownRow {
  baseMinor: number;
  name: string;
  rateBps: number;
  taxMinor: number;
}

export interface Quote {
  currency: string;
  lines: QuoteLine[];
  scale: number;
  schemaVersion: 1;
  taxBreakdown: TaxBreakdownRow[];
  totals: {
    subtotalMinor: number;
    discountMinor: number;
    taxMinor: number;
    totalMinor: number;
  };
}

// commerce.checkoutConfirm -> customer-facing confirmation (human-readable refs
// only; internal order/sale uuids are never exposed by the public router).
export interface OrderConfirmation {
  currency: string;
  orderNumber: string;
  saleNumber: string;
  scale: number;
  status: string;
  totalMinor: number;
}
