import catalog from "./unitech-catalog.json" with { type: "json" };

/**
 * Real client catalog: "Unitech Solutions / Services" (Guyana appliance &
 * electronics retailer), extracted from their Item Detail export.
 *
 * - Prices are in GYD minor units (cents), scale 2.
 * - `onHand` is the raw exported on-hand quantity and is frequently NEGATIVE —
 *   the legacy system oversells without reconciliation. RetailOS surfaces this
 *   as a first-class data-quality signal rather than hiding it.
 *
 * Single source of truth: consumed by the admin app and the storefront so both
 * show the same real inventory in preview without a live backend.
 */
export type UnitechProduct = {
  handle: string;
  sku: string;
  name: string;
  department: string;
  categoryHandle: string;
  /** GYD minor units (cents). */
  priceMinor: number;
  /** Raw exported on-hand; may be negative. */
  onHand: number;
  description: string;
};

export type UnitechCategory = {
  handle: string;
  name: string;
  productCount: number;
};

type CatalogFile = {
  products: UnitechProduct[];
  categories: UnitechCategory[];
};

const data = catalog as CatalogFile;

export const UNITECH_CURRENCY = "GYD";
export const UNITECH_SCALE = 2;

export const unitechProducts: UnitechProduct[] = data.products;
export const unitechCategories: UnitechCategory[] = data.categories;

export function findUnitechProduct(handle: string): UnitechProduct | undefined {
  return data.products.find((p) => p.handle === handle);
}

// Aggregate signals used by dashboards / reports.
export const unitechStats = {
  productCount: data.products.length,
  categoryCount: data.categories.length,
  negativeStockCount: data.products.filter((p) => p.onHand < 0).length,
  totalOnHand: data.products.reduce((sum, p) => sum + p.onHand, 0),
  inventoryValueMinor: data.products.reduce(
    (sum, p) => sum + p.priceMinor * Math.max(0, p.onHand),
    0
  ),
};
