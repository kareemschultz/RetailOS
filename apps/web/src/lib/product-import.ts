// Pure helpers for the /products/import wizard. No DOM, no network — unit
// tested in product-import.test.ts. Parsing/mapping happens client-side; ALL
// validation authority stays with catalog.importPreview / importCommit on the
// backend (a clean client parse is convenience, not a contract).

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

const BOM = "\uFEFF";
const CRLF_RE = /\r\n?/g;

// Consumes a quoted section starting AFTER the opening quote; "" is an escaped
// quote. Returns the text and the index just past the closing quote.
function readQuoted(
  source: string,
  start: number
): { next: number; text: string } {
  let text = "";
  let i = start;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '"') {
      if (source[i + 1] === '"') {
        text += '"';
        i += 2;
        continue;
      }
      return { next: i + 1, text };
    }
    text += ch;
    i += 1;
  }
  return { next: i, text };
}

// Hand-written CSV parser (no dependency): quoted fields, embedded commas,
// escaped quotes (""), CR/LF/CRLF newlines, BOM. Empty lines are skipped.
export function parseCsv(text: string): ParsedCsv {
  const withoutBom = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  // Normalizing CR/CRLF up front keeps the parse loop a 4-way branch. A bare
  // CR inside a quoted field becomes LF \u2014 an acceptable normalization.
  const source = withoutBom.replace(CRLF_RE, "\n");
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    const isEmpty = record.every((value) => value.trim() === "");
    if (!isEmpty) {
      records.push(record);
    }
    record = [];
  };
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '"') {
      const quoted = readQuoted(source, i + 1);
      field += quoted.text;
      i = quoted.next;
      continue;
    }
    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (ch === "\n") {
      pushRecord();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field !== "" || record.length > 0) {
    pushRecord();
  }
  const [headers, ...rows] = records;
  return {
    headers: (headers ?? []).map((h) => h.trim()),
    rows,
  };
}

export type ImportField =
  | "productSku"
  | "productName"
  | "price"
  | "cost"
  | "openingQty"
  | "skuCode"
  | "baseUomCode"
  | "lotNumber"
  | "expiryDate";

export type ColumnMapping = Partial<Record<ImportField, number>>;

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  productSku: "Product SKU / item code",
  productName: "Product name",
  price: "Selling price",
  cost: "Unit cost",
  openingQty: "Quantity on hand",
  skuCode: "Variant SKU code",
  baseUomCode: "Unit of measure code",
  lotNumber: "Lot / batch number",
  expiryDate: "Expiry date",
};

// Header aliases, normalized (lowercase, alphanumerics only). Covers RetailOS
// canonical headers AND the common QuickBooks item-list export headers.
const HEADER_ALIASES: Record<ImportField, string[]> = {
  productSku: [
    "productsku",
    "sku",
    "item",
    "itemnumber",
    "itemcode",
    "number",
    "code",
  ],
  productName: [
    "productname",
    "itemname",
    "name",
    "description",
    "salesdescription",
  ],
  price: [
    "price",
    "salesprice",
    "sellingprice",
    "unitprice",
    "rate",
    "retailprice",
  ],
  cost: ["cost", "unitcost", "purchasecost", "standardcost", "avgcost"],
  openingQty: [
    "openingqty",
    "openingstock",
    "quantityonhand",
    "qtyonhand",
    "onhand",
    "quantity",
    "qty",
    "stock",
  ],
  skuCode: ["skucode", "variantsku", "variantcode"],
  baseUomCode: ["baseuomcode", "uom", "um", "unitofmeasure", "baseunit"],
  lotNumber: ["lotnumber", "lot", "batch", "batchnumber"],
  expiryDate: ["expirydate", "expiry", "expiration", "expirationdate"],
};

const NON_ALPHANUMERIC_RE = /[^a-z0-9]/g;

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(NON_ALPHANUMERIC_RE, "");
}

// Maps detected CSV headers to import fields. First alias match wins; a column
// is only assigned to one field (productSku takes priority over productName so
// a lone QuickBooks "Item" column becomes the SKU, with name falling back).
export function autoMapColumns(headers: string[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const mapping: ColumnMapping = {};
  const claimed = new Set<number>();
  const fields = Object.keys(HEADER_ALIASES) as ImportField[];
  for (const field of fields) {
    for (const alias of HEADER_ALIASES[field]) {
      const index = normalized.findIndex(
        (header, i) => header === alias && !claimed.has(i)
      );
      if (index >= 0) {
        mapping[field] = index;
        claimed.add(index);
        break;
      }
    }
  }
  return mapping;
}

const AMOUNT_RE = /^\d+(\.\d+)?$/;
const CURRENCY_NOISE_RE = /[$\s]/g;

// Decimal string -> integer minor units via STRING math (never float
// multiplication — "12.99" at scale 2 must be exactly 1299). Accepts thousands
// separators ("1,299.50") and a leading $ sign; rejects negatives and more
// decimals than the scale allows.
export function amountToMinor(input: string, scale: number): number | null {
  const cleaned = input.replace(CURRENCY_NOISE_RE, "").replace(COMMA_RE, "");
  if (!AMOUNT_RE.test(cleaned)) {
    return null;
  }
  const [wholePart, fractionPart = ""] = cleaned.split(".");
  if (fractionPart.length > scale) {
    return null;
  }
  const paddedFraction = fractionPart.padEnd(scale, "0");
  const minor = Number(`${wholePart}${paddedFraction}`);
  if (!Number.isSafeInteger(minor)) {
    return null;
  }
  return minor;
}

const INTEGER_RE = /^\d+$/;
const COMMA_RE = /,/g;
const TRAILING_ZERO_FRACTION_RE = /\.0+$/;

export function quantityToInt(input: string): number | null {
  const cleaned = input.replace(COMMA_RE, "").trim();
  // Tolerate a trailing ".00" that spreadsheet exports add to whole numbers.
  const withoutZeroFraction = cleaned.replace(TRAILING_ZERO_FRACTION_RE, "");
  if (!INTEGER_RE.test(withoutZeroFraction)) {
    return null;
  }
  const value = Number(withoutZeroFraction);
  if (!Number.isSafeInteger(value)) {
    return null;
  }
  return value;
}

export interface ImportDefaults {
  // Auto-create one sellable SKU per product (code = product SKU). Required
  // for cost/opening-stock rows, since those live on the SKU.
  autoSku: boolean;
  costingMethod?: "avco" | "fifo";
  currency: string;
  scale: number;
  trackingMode: "none" | "lot" | "serial";
}

export interface ImportRowInput {
  baseUomCode?: string;
  costingMethod?: "avco" | "fifo";
  currency: string;
  expiryDate?: string;
  lotNumber?: string;
  openingQtyBase?: number;
  priceMinor: number;
  productName: string;
  productSku: string;
  rowNumber: number;
  scale: number;
  skuCode?: string;
  trackingMode: "none" | "lot" | "serial";
  unitCostMinor?: number;
}

export interface BuildResult {
  issues: string[];
  rows: ImportRowInput[];
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cell(row: string[], index: number | undefined): string {
  if (index === undefined) {
    return "";
  }
  return (row[index] ?? "").trim();
}

// One CSV data row -> one ImportRowInput (or issue strings). Kept separate so
// buildImportRows stays a thin loop.
function buildImportRow(
  row: string[],
  rowNumber: number,
  mapping: ColumnMapping,
  defaults: ImportDefaults
): { issues: string[]; value?: ImportRowInput } {
  const issues: string[] = [];
  const productSku = cell(row, mapping.productSku);
  if (!productSku) {
    issues.push(`row ${rowNumber}: missing product SKU`);
    return { issues };
  }
  const productName = cell(row, mapping.productName) || productSku;
  const priceRaw = cell(row, mapping.price);
  const priceMinor = priceRaw ? amountToMinor(priceRaw, defaults.scale) : 0;
  if (priceMinor == null) {
    issues.push(`row ${rowNumber}: unreadable price "${priceRaw}"`);
    return { issues };
  }
  const value: ImportRowInput = {
    currency: defaults.currency,
    priceMinor,
    productName,
    productSku,
    rowNumber,
    scale: defaults.scale,
    trackingMode: defaults.trackingMode,
  };
  if (defaults.costingMethod) {
    value.costingMethod = defaults.costingMethod;
  }
  const explicitSkuCode = cell(row, mapping.skuCode);
  if (explicitSkuCode) {
    value.skuCode = explicitSkuCode;
  } else if (defaults.autoSku) {
    value.skuCode = productSku;
  }
  const uom = cell(row, mapping.baseUomCode);
  if (uom) {
    value.baseUomCode = uom;
  }
  const stockIssue = applyStockFields(value, row, rowNumber, mapping, defaults);
  if (stockIssue) {
    issues.push(stockIssue);
    return { issues };
  }
  const trackingIssue = applyTrackingFields(value, row, rowNumber, mapping);
  if (trackingIssue) {
    issues.push(trackingIssue);
    return { issues };
  }
  return { issues, value };
}

// Cost + opening quantity — returns an issue string on unreadable values.
function applyStockFields(
  value: ImportRowInput,
  row: string[],
  rowNumber: number,
  mapping: ColumnMapping,
  defaults: ImportDefaults
): string | null {
  const costRaw = cell(row, mapping.cost);
  if (costRaw) {
    const costMinor = amountToMinor(costRaw, defaults.scale);
    if (costMinor == null) {
      return `row ${rowNumber}: unreadable cost "${costRaw}"`;
    }
    value.unitCostMinor = costMinor;
  }
  const qtyRaw = cell(row, mapping.openingQty);
  if (qtyRaw) {
    const qty = quantityToInt(qtyRaw);
    if (qty == null) {
      return `row ${rowNumber}: unreadable quantity "${qtyRaw}"`;
    }
    if (qty > 0) {
      value.openingQtyBase = qty;
      if (value.unitCostMinor == null) {
        // Opening stock must be valued; a zero cost is honest-but-explicit.
        value.unitCostMinor = 0;
      }
    }
  }
  return null;
}

// Lot + expiry — returns an issue string on a malformed date.
function applyTrackingFields(
  value: ImportRowInput,
  row: string[],
  rowNumber: number,
  mapping: ColumnMapping
): string | null {
  const lotNumber = cell(row, mapping.lotNumber);
  if (lotNumber) {
    value.lotNumber = lotNumber;
  }
  const expiry = cell(row, mapping.expiryDate);
  if (expiry) {
    if (!ISO_DATE_RE.test(expiry)) {
      return `row ${rowNumber}: expiry date "${expiry}" must be YYYY-MM-DD`;
    }
    value.expiryDate = expiry;
  }
  return null;
}

// Converts parsed+mapped CSV rows into the catalog.importPreview/importCommit
// row contract. Rows with unreadable values become issues (they block the
// preview) rather than silently-guessed data.
export function buildImportRows(
  parsed: ParsedCsv,
  mapping: ColumnMapping,
  defaults: ImportDefaults
): BuildResult {
  const rows: ImportRowInput[] = [];
  const issues: string[] = [];
  for (const [index, row] of parsed.rows.entries()) {
    const rowNumber = index + 1;
    const built = buildImportRow(row, rowNumber, mapping, defaults);
    issues.push(...built.issues);
    if (built.value) {
      rows.push(built.value);
    }
  }
  return { issues, rows };
}
