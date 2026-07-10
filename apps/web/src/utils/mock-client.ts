// biome-ignore-all lint/suspicious/noBitwiseOperators: integer hash (hashToUuid) requires bitwise mixing
import {
  UNITECH_CURRENCY,
  UNITECH_SCALE,
  unitechCategories,
  unitechProducts,
  unitechStats,
} from "@RetailOS/sample-data";

/**
 * Preview-only mock oRPC client.
 *
 * The admin app normally talks to the live oRPC server over HTTP. In the
 * frontend-only preview (VITE_PREVIEW_NO_AUTH=true) there is no backend, so we
 * swap in this object which mirrors the real procedure signatures closely
 * enough for the UI to render the real Unitech catalog.
 *
 * `createTanstackQueryUtils` walks the client with `client[prop]` for nested
 * routers and calls leaf procedures as `client.path.to.proc(input, options)`.
 * So the client is just a nested object of async functions. A Proxy provides
 * safe empty defaults for any procedure we haven't explicitly modelled, so no
 * screen throws.
 */

// --- Deterministic ids ------------------------------------------------------
// Stable UUID-shaped id derived from a string, so the same product/location
// keeps the same id across renders and query keys stay stable.
function hashToUuid(input: string): string {
  let h1 = 0x9e_37_79_b9;
  let h2 = 0x85_eb_ca_6b;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01_00_01_93) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x01_00_00_c9) >>> 0;
  }
  const hex = (
    h1.toString(16).padStart(8, "0") +
    h2.toString(16).padStart(8, "0") +
    Math.imul(h1 ^ h2, 0x27_d4_eb_2f)
      .toString(16)
      .padStart(8, "0") +
    Math.imul(h1 + h2, 0x16_56_67_b1)
      .toString(16)
      .padStart(8, "0")
  ).slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const LOCATION_ID = hashToUuid("location:main-warehouse");
const LOCATION_NAME = "Main Store — Georgetown";
const UOM_ID = hashToUuid("uom:each");
const now = () => new Date().toISOString();

function productId(handle: string) {
  return hashToUuid(`product:${handle}`);
}
function skuId(handle: string) {
  return hashToUuid(`sku:${handle}`);
}
function imageUrl(categoryHandle: string) {
  return `/img/dept/${categoryHandle}.png`;
}

// --- Row builders (match real procedure projections) ------------------------
function productCatalogRows(q?: string) {
  const term = q?.trim().toLowerCase();
  return unitechProducts
    .filter(
      (p) =>
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term)
    )
    .map((p) => ({
      id: productId(p.handle),
      sku: p.sku,
      name: p.name,
      trackingMode: "none",
      priceMinor: p.priceMinor,
      currency: UNITECH_CURRENCY,
      scale: UNITECH_SCALE,
      primaryImageAltText: p.name,
      primaryImageUrl: imageUrl(p.categoryHandle),
    }));
}

function stockRows(locationId?: string) {
  if (locationId && locationId !== LOCATION_ID) {
    return [];
  }
  return unitechProducts.map((p) => ({
    skuId: skuId(p.handle),
    skuCode: p.sku,
    productName: p.name,
    locationId: LOCATION_ID,
    locationName: LOCATION_NAME,
    qtyOnHand: p.onHand,
    currency: UNITECH_CURRENCY,
    scale: UNITECH_SCALE,
    totalValueMinor: p.priceMinor * Math.max(0, p.onHand),
  }));
}

function skuCatalogRows(q?: string) {
  const term = q?.trim().toLowerCase();
  return unitechProducts
    .filter(
      (p) =>
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term)
    )
    .map((p) => ({
      id: skuId(p.handle),
      productId: productId(p.handle),
      productSku: p.sku,
      productName: p.name,
      code: p.sku,
      name: p.name,
      baseUomCode: "EA",
      baseUomName: "Each",
      costingMethod: "avco",
      trackingMode: "none",
      isActive: true,
      createdAt: now(),
      currency: UNITECH_CURRENCY,
      scale: UNITECH_SCALE,
    }));
}

// --- Catalog import (preview + commit) --------------------------------------
interface ImportRow {
  lotNumber?: string | null;
  openingQtyBase?: number | null;
  productSku: string;
  rowNumber: number;
  skuCode?: string | null;
}

// Client-parsed rows arrive already well-formed; the preview mirrors the real
// server checks that don't need a database: SKU presence + duplicate detection
// within the batch. Anything the real backend would flag on persisted state
// (e.g. an existing SKU) can't be known offline, so we stay optimistic.
function previewImportRows(rows: ImportRow[]) {
  const seen = new Map<string, number>();
  const previewed = rows.map((row) => {
    const errors: string[] = [];
    const sku = (row.productSku ?? "").trim();
    if (sku) {
      const firstSeen = seen.get(sku.toLowerCase());
      if (firstSeen) {
        errors.push(`duplicate SKU "${sku}" (also row ${firstSeen})`);
      } else {
        seen.set(sku.toLowerCase(), row.rowNumber);
      }
    } else {
      errors.push("missing product SKU");
    }
    return {
      rowNumber: row.rowNumber,
      productSku: sku,
      skuCode: row.skuCode ?? null,
      status: errors.length > 0 ? "error" : "valid",
      errors,
    };
  });
  return {
    validCount: previewed.filter((r) => r.status === "valid").length,
    errorCount: previewed.filter((r) => r.status === "error").length,
    rows: previewed,
  };
}

// --- Explicit procedure handlers --------------------------------------------
type Handler = (input: unknown) => unknown;

const handlers: Record<string, Handler> = {
  "catalog.importPreview": (input) =>
    previewImportRows(
      ((input as { rows?: ImportRow[] })?.rows ?? []) as ImportRow[]
    ),
  "catalog.importCommit": (input) => {
    const rows = ((input as { rows?: ImportRow[] })?.rows ?? []) as ImportRow[];
    const results = rows.map((row) => ({
      rowNumber: row.rowNumber,
      productId: hashToUuid(`import-product:${row.productSku}`),
      skuId: row.skuCode ? hashToUuid(`import-sku:${row.skuCode}`) : null,
      lotId: row.lotNumber ? hashToUuid(`import-lot:${row.lotNumber}`) : null,
      openingMovementId:
        row.openingQtyBase == null
          ? null
          : hashToUuid(`import-move:${row.rowNumber}`),
    }));
    return {
      createdProductCount: results.length,
      createdSkuCount: results.filter((r) => r.skuId).length,
      createdLotCount: results.filter((r) => r.lotId).length,
      openingStockCount: results.filter((r) => r.openingMovementId).length,
      rows: results,
    };
  },
  "reports.dashboardSummary": () => ({
    sales: {
      currency: UNITECH_CURRENCY,
      scale: UNITECH_SCALE,
      totalMinor: 428_500_000,
    },
    transactionCount: 128,
    inventoryValue: {
      currency: UNITECH_CURRENCY,
      scale: UNITECH_SCALE,
      totalValueMinor: unitechStats.inventoryValueMinor,
    },
    lowStockCount: unitechStats.negativeStockCount,
  }),
  "reports.operationsSummary": () => ({
    openShifts: 1,
    pendingTransfers: 0,
    openPurchaseOrders: 3,
    openCounts: 0,
    negativeStockSkus: unitechStats.negativeStockCount,
  }),
  "product.catalog": (input) =>
    productCatalogRows((input as { q?: string } | undefined)?.q),
  "product.detail": (input) => {
    const id = (input as { id: string }).id;
    const p = unitechProducts.find((x) => productId(x.handle) === id);
    if (!p) {
      return null;
    }
    return {
      id: productId(p.handle),
      sku: p.sku,
      name: p.name,
      trackingMode: "none",
      priceMinor: p.priceMinor,
      currency: UNITECH_CURRENCY,
      scale: UNITECH_SCALE,
      images: [
        {
          id: hashToUuid(`img:${p.handle}`),
          url: imageUrl(p.categoryHandle),
          altText: p.name,
          isPrimary: true,
          sortOrder: 0,
        },
      ],
    };
  },
  "location.list": () => [
    {
      id: LOCATION_ID,
      companyId: hashToUuid("company:unitech"),
      name: LOCATION_NAME,
      type: "store",
      parentLocationId: null,
      isSellable: true,
      isQuarantine: false,
      isBonded: false,
      isTransit: false,
      createdAt: now(),
    },
  ],
  "pos.locationList": () => [{ id: LOCATION_ID, name: LOCATION_NAME }],
  "inventory.stockByLocation": (input) =>
    stockRows((input as { locationId?: string } | undefined)?.locationId),
  "inventory.adjust": (input) => {
    // Mirror the real ledger-append result. No persistence in preview: the
    // caller optimistically drops the reconciled row from its own view.
    const i = (input as {
      skuId: string;
      qtyDelta: number;
      reasonCode: string;
    }) ?? { skuId: "", qtyDelta: 0, reasonCode: "" };
    return {
      movementId: hashToUuid(`adjust:${i.skuId}:${now()}`),
      skuId: i.skuId,
      qtyDelta: i.qtyDelta,
      reasonCode: i.reasonCode,
      createdAt: now(),
    };
  },
  "inventory.receive": (input) => {
    const i = (input as { skuId?: string; qty: number }) ?? { qty: 0 };
    return {
      movementId: hashToUuid(`receive:${i.skuId ?? ""}:${now()}`),
      qty: i.qty,
      createdAt: now(),
    };
  },
  "catalog.skuCatalogList": (input) =>
    skuCatalogRows((input as { q?: string } | undefined)?.q),
  "catalog.categoryList": () =>
    unitechCategories.map((c) => ({
      id: hashToUuid(`category:${c.handle}`),
      code: c.handle.toUpperCase().slice(0, 12),
      name: c.name,
      costingMethod: null,
      trackingMode: null,
      deletedAt: null,
      createdAt: now(),
    })),
  "catalog.uomList": () => [
    {
      id: UOM_ID,
      code: "EA",
      name: "Each",
      kind: "count",
      decimalScale: 0,
      deletedAt: null,
      createdAt: now(),
    },
  ],
  "membership.myAccess": () => ({
    role: "owner",
    permissions: [
      "products.create",
      "reports.view",
      "inventory.adjust",
      "inventory.count",
      "sales.create",
      "users.manage",
      "settings.manage",
    ],
  }),
};

// List-shaped procedure names get [] as their safe default; everything else {}.
const LIST_LEAF_RE = /(list|search|catalog|ledger)$/i;
function emptyDefault(path: string): unknown {
  const leaf = path.split(".").at(-1) ?? "";
  if (LIST_LEAF_RE.test(leaf)) {
    return [];
  }
  return {};
}

// --- Proxy client -----------------------------------------------------------
function makeNode(path: string): unknown {
  const fn = (input: unknown) => {
    const handler = handlers[path];
    const value = handler ? handler(input) : emptyDefault(path);
    return Promise.resolve(value);
  };
  return new Proxy(fn, {
    get(_target, prop: string) {
      if (prop === "then" || typeof prop === "symbol") {
        return;
      }
      return makeNode(path ? `${path}.${prop}` : prop);
    },
  });
}

export const mockClient = makeNode("") as never;
