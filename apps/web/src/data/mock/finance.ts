// Typed mock data for finance surfaces (AR/AP) pending backend wiring. Money is
// carried as minor units + scale to match the backend money convention.

export type ReceivableInvoice = {
  id: string;
  number: string;
  customer: string;
  issuedAt: string;
  dueAt: string;
  status: "paid" | "unpaid" | "overdue" | "draft";
  totalMinor: number;
  balanceMinor: number;
  currency: string;
  scale: number;
};

export const MOCK_RECEIVABLES: ReceivableInvoice[] = [
  {
    id: "ar_01",
    number: "INV-2026-0481",
    customer: "Sunrise Grocery Ltd",
    issuedAt: "2026-06-20T09:00:00Z",
    dueAt: "2026-07-20T09:00:00Z",
    status: "unpaid",
    totalMinor: 1_120_000,
    balanceMinor: 1_120_000,
    currency: "GYD",
    scale: 2,
  },
  {
    id: "ar_02",
    number: "INV-2026-0479",
    customer: "Marlon Persaud",
    issuedAt: "2026-06-01T09:00:00Z",
    dueAt: "2026-07-01T09:00:00Z",
    status: "overdue",
    totalMinor: 235_000,
    balanceMinor: 235_000,
    currency: "GYD",
    scale: 2,
  },
  {
    id: "ar_03",
    number: "INV-2026-0475",
    customer: "Priya Ramnarine",
    issuedAt: "2026-06-28T09:00:00Z",
    dueAt: "2026-07-28T09:00:00Z",
    status: "paid",
    totalMinor: 48_900,
    balanceMinor: 0,
    currency: "GYD",
    scale: 2,
  },
  {
    id: "ar_04",
    number: "INV-2026-0488",
    customer: "Ada Okoye",
    issuedAt: "2026-07-06T09:00:00Z",
    dueAt: "2026-08-05T09:00:00Z",
    status: "draft",
    totalMinor: 89_500,
    balanceMinor: 89_500,
    currency: "GYD",
    scale: 2,
  },
];

export type PayableBill = {
  id: string;
  number: string;
  supplier: string;
  issuedAt: string;
  dueAt: string;
  status: "paid" | "unpaid" | "overdue" | "draft";
  totalMinor: number;
  balanceMinor: number;
  currency: string;
  scale: number;
};

export const MOCK_PAYABLES: PayableBill[] = [
  {
    id: "ap_01",
    number: "BILL-4821",
    supplier: "Caribbean Wholesale Co.",
    issuedAt: "2026-06-15T09:00:00Z",
    dueAt: "2026-07-15T09:00:00Z",
    status: "unpaid",
    totalMinor: 3_450_000,
    balanceMinor: 3_450_000,
    currency: "GYD",
    scale: 2,
  },
  {
    id: "ap_02",
    number: "BILL-4805",
    supplier: "Demerara Distributors",
    issuedAt: "2026-05-30T09:00:00Z",
    dueAt: "2026-06-29T09:00:00Z",
    status: "overdue",
    totalMinor: 780_000,
    balanceMinor: 780_000,
    currency: "GYD",
    scale: 2,
  },
  {
    id: "ap_03",
    number: "BILL-4830",
    supplier: "Local Farms Cooperative",
    issuedAt: "2026-07-08T09:00:00Z",
    dueAt: "2026-07-18T09:00:00Z",
    status: "unpaid",
    totalMinor: 145_000,
    balanceMinor: 145_000,
    currency: "GYD",
    scale: 2,
  },
];

export type PriceListEntry = {
  id: string;
  sku: string;
  product: string;
  priceList: string;
  basePriceMinor: number;
  listPriceMinor: number;
  marginPct: number;
  currency: string;
  scale: number;
  effectiveFrom: string;
};

export const MOCK_PRICE_LIST: PriceListEntry[] = [
  {
    id: "pl_01",
    sku: "BEV-COLA-500",
    product: "Cola 500ml",
    priceList: "Retail",
    basePriceMinor: 18_000,
    listPriceMinor: 25_000,
    marginPct: 28,
    currency: "GYD",
    scale: 2,
    effectiveFrom: "2026-07-01T00:00:00Z",
  },
  {
    id: "pl_02",
    sku: "BEV-COLA-500",
    product: "Cola 500ml",
    priceList: "Wholesale",
    basePriceMinor: 18_000,
    listPriceMinor: 21_000,
    marginPct: 14,
    currency: "GYD",
    scale: 2,
    effectiveFrom: "2026-07-01T00:00:00Z",
  },
  {
    id: "pl_03",
    sku: "SNK-CHIP-200",
    product: "Potato Chips 200g",
    priceList: "Retail",
    basePriceMinor: 22_000,
    listPriceMinor: 32_000,
    marginPct: 31,
    currency: "GYD",
    scale: 2,
    effectiveFrom: "2026-06-15T00:00:00Z",
  },
];

export type Promotion = {
  id: string;
  name: string;
  code: string;
  type: "percentage" | "fixed" | "bogo";
  value: string;
  status: "active" | "draft" | "expired";
  redemptions: number;
  startsAt: string;
  endsAt: string;
};

export const MOCK_PROMOTIONS: Promotion[] = [
  {
    id: "promo_01",
    name: "Weekend Saver",
    code: "WEEKEND10",
    type: "percentage",
    value: "10% off",
    status: "active",
    redemptions: 342,
    startsAt: "2026-07-01T00:00:00Z",
    endsAt: "2026-07-31T23:59:59Z",
  },
  {
    id: "promo_02",
    name: "Buy One Get One - Chips",
    code: "BOGOCHIP",
    type: "bogo",
    value: "BOGO",
    status: "active",
    redemptions: 88,
    startsAt: "2026-07-05T00:00:00Z",
    endsAt: "2026-07-15T23:59:59Z",
  },
  {
    id: "promo_03",
    name: "New Year Clearance",
    code: "NY2026",
    type: "fixed",
    value: "G$500 off",
    status: "expired",
    redemptions: 1204,
    startsAt: "2026-01-01T00:00:00Z",
    endsAt: "2026-01-15T23:59:59Z",
  },
  {
    id: "promo_04",
    name: "Back to School",
    code: "SCHOOL26",
    type: "percentage",
    value: "15% off",
    status: "draft",
    redemptions: 0,
    startsAt: "2026-08-15T00:00:00Z",
    endsAt: "2026-09-15T23:59:59Z",
  },
];

export type StockAdjustment = {
  id: string;
  reference: string;
  location: string;
  reason: "damage" | "count" | "theft" | "expiry" | "correction";
  status: "draft" | "pending" | "completed";
  itemsCount: number;
  valueChangeMinor: number;
  currency: string;
  scale: number;
  createdBy: string;
  createdAt: string;
};

export const MOCK_ADJUSTMENTS: StockAdjustment[] = [
  {
    id: "adj_01",
    reference: "ADJ-2026-0034",
    location: "Main Warehouse",
    reason: "damage",
    status: "completed",
    itemsCount: 12,
    valueChangeMinor: -45_000,
    currency: "GYD",
    scale: 2,
    createdBy: "K. Thomas",
    createdAt: "2026-07-08T13:00:00Z",
  },
  {
    id: "adj_02",
    reference: "ADJ-2026-0035",
    location: "Store #2 - Regent St",
    reason: "count",
    status: "pending",
    itemsCount: 45,
    valueChangeMinor: 12_500,
    currency: "GYD",
    scale: 2,
    createdBy: "A. Persaud",
    createdAt: "2026-07-09T10:30:00Z",
  },
  {
    id: "adj_03",
    reference: "ADJ-2026-0036",
    location: "Main Warehouse",
    reason: "expiry",
    status: "draft",
    itemsCount: 8,
    valueChangeMinor: -28_900,
    currency: "GYD",
    scale: 2,
    createdBy: "K. Thomas",
    createdAt: "2026-07-10T08:15:00Z",
  },
];
