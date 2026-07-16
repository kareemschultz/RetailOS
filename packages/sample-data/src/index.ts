import catalog from "./everstock-catalog.json" with { type: "json" };

/**
 * Synthetic demo catalog for "Everstock" — a fictional Guyana appliance &
 * electronics retailer. This is generated placeholder data, not derived from
 * any real business or client.
 *
 * - Prices are in GYD minor units (cents), scale 2.
 * - `onHand` is a synthetic on-hand quantity and is intentionally NEGATIVE for
 *   a meaningful share of products — RetailOS surfaces this as a first-class
 *   data-quality signal (oversold / unreconciled stock) rather than hiding it.
 *
 * Single source of truth: consumed by the admin app and the storefront so both
 * show the same sample inventory in preview without a live backend.
 */
export interface EverstockProduct {
  categoryHandle: string;
  department: string;
  description: string;
  handle: string;
  name: string;
  /** Synthetic on-hand quantity; may be negative. */
  onHand: number;
  /** GYD minor units (cents). */
  priceMinor: number;
  sku: string;
}

export interface EverstockCategory {
  handle: string;
  name: string;
  productCount: number;
}

interface CatalogFile {
  categories: EverstockCategory[];
  products: EverstockProduct[];
}

const data = catalog as CatalogFile;

export const EVERSTOCK_CURRENCY = "GYD";
export const EVERSTOCK_SCALE = 2;

export const everstockProducts: EverstockProduct[] = data.products;
export const everstockCategories: EverstockCategory[] = data.categories;

export function findEverstockProduct(
  handle: string
): EverstockProduct | undefined {
  return data.products.find((p) => p.handle === handle);
}

// Aggregate signals used by dashboards / reports.
export const everstockStats = {
  productCount: data.products.length,
  categoryCount: data.categories.length,
  negativeStockCount: data.products.filter((p) => p.onHand < 0).length,
  totalOnHand: data.products.reduce((sum, p) => sum + p.onHand, 0),
  inventoryValueMinor: data.products.reduce(
    (sum, p) => sum + p.priceMinor * Math.max(0, p.onHand),
    0
  ),
};
