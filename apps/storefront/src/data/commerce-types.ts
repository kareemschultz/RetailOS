// Storefront DTO types — a faithful mirror of the PUBLIC `commerce` oRPC router
// output (packages/api/src/routers/commerce.ts). Keeping these shapes exact is
// what lets the mock layer be swapped for the live endpoints with zero page
// edits (plan.md — "Real API + typed mock"). Only fields the public router
// actually ships are modeled here; cost/margin/qty/internal ids are never part
// of the public contract and never appear.

export type Money = {
  amountMinor: number;
  currency: string;
  scale: number;
};

export type PublicCategory = {
  handle: string;
  name: string;
} | null;

export type PublicImage = {
  url: string;
  altText: string | null;
  isPrimary: boolean;
};

// Derived client-side from catalog items' `category` field (the public router
// has no separate categories endpoint) — used for nav and category tiles.
export type StoreCategory = {
  handle: string;
  name: string;
  productCount: number;
};

// commerce.catalog -> items[]
export type CatalogItem = {
  handle: string;
  name: string;
  category: PublicCategory;
  price: Money;
  primaryImage: { url: string; altText: string | null } | null;
  availability: "unknown" | "in_stock" | "out_of_stock";
};

// commerce.product -> full product view
export type ProductDetail = {
  handle: string;
  name: string;
  category: PublicCategory;
  price: Money;
  images: PublicImage[];
  variants: { code: string; name: string }[];
  availability: "unknown" | "in_stock" | "out_of_stock";
};

// commerce.quote -> re-priced, real-tax cart quote
export type QuoteLine = {
  handle: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  lineSubtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  lineTotalMinor: number;
};

export type TaxBreakdownRow = {
  label: string;
  rateBps: number;
  taxMinor: number;
};

export type Quote = {
  schemaVersion: 1;
  currency: string;
  scale: number;
  lines: QuoteLine[];
  taxBreakdown: TaxBreakdownRow[];
  totals: {
    subtotalMinor: number;
    discountMinor: number;
    taxMinor: number;
    totalMinor: number;
  };
};

// commerce.checkoutConfirm -> customer-facing confirmation (human-readable refs
// only; internal order/sale uuids are never exposed by the public router).
export type OrderConfirmation = {
  currency: string;
  orderNumber: string;
  saleNumber: string;
  scale: number;
  status: string;
  totalMinor: number;
};
