// Typed mock data for CRM / relationship surfaces whose backend is not yet
// wired. Shapes mirror the intended DTOs so swapping to real oRPC later is a
// registry flip, not a page rewrite. Money is minor units + scale, matching
// the backend money convention (formatMoney does the display conversion).

export interface Customer {
  balanceMinor: number;
  createdAt: string;
  currency: string;
  email: string;
  id: string;
  lastOrderAt: string;
  lifetimeSpendMinor: number;
  name: string;
  ordersCount: number;
  phone: string;
  scale: number;
  segment: "retail" | "wholesale" | "vip";
  status: "active" | "inactive";
}

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: "cus_01",
    name: "Ada Okoye",
    email: "ada.okoye@example.com",
    phone: "+592 612 0001",
    segment: "vip",
    status: "active",
    ordersCount: 48,
    lifetimeSpendMinor: 1_284_500,
    balanceMinor: 0,
    currency: "GYD",
    scale: 2,
    lastOrderAt: "2026-07-06T14:20:00Z",
    createdAt: "2024-02-11T09:00:00Z",
  },
  {
    id: "cus_02",
    name: "Marlon Persaud",
    email: "marlon.persaud@example.com",
    phone: "+592 612 0002",
    segment: "wholesale",
    status: "active",
    ordersCount: 132,
    lifetimeSpendMinor: 8_940_000,
    balanceMinor: 235_000,
    currency: "GYD",
    scale: 2,
    lastOrderAt: "2026-07-09T11:05:00Z",
    createdAt: "2023-08-02T09:00:00Z",
  },
  {
    id: "cus_03",
    name: "Priya Ramnarine",
    email: "priya.r@example.com",
    phone: "+592 612 0003",
    segment: "retail",
    status: "active",
    ordersCount: 12,
    lifetimeSpendMinor: 148_900,
    balanceMinor: 0,
    currency: "GYD",
    scale: 2,
    lastOrderAt: "2026-06-28T16:45:00Z",
    createdAt: "2025-01-19T09:00:00Z",
  },
  {
    id: "cus_04",
    name: "Devon Cato",
    email: "devon.cato@example.com",
    phone: "+592 612 0004",
    segment: "retail",
    status: "inactive",
    ordersCount: 3,
    lifetimeSpendMinor: 32_400,
    balanceMinor: 0,
    currency: "GYD",
    scale: 2,
    lastOrderAt: "2025-11-02T10:15:00Z",
    createdAt: "2025-09-30T09:00:00Z",
  },
  {
    id: "cus_05",
    name: "Sunrise Grocery Ltd",
    email: "accounts@sunrisegrocery.gy",
    phone: "+592 612 0005",
    segment: "wholesale",
    status: "active",
    ordersCount: 210,
    lifetimeSpendMinor: 21_450_000,
    balanceMinor: 1_120_000,
    currency: "GYD",
    scale: 2,
    lastOrderAt: "2026-07-08T08:30:00Z",
    createdAt: "2022-05-14T09:00:00Z",
  },
];

export interface Supplier {
  contact: string;
  createdAt: string;
  currency: string;
  email: string;
  id: string;
  leadTimeDays: number;
  name: string;
  openPurchaseOrders: number;
  payableMinor: number;
  phone: string;
  scale: number;
  status: "active" | "pending" | "inactive";
}

export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: "sup_01",
    name: "Caribbean Wholesale Co.",
    contact: "R. Baksh",
    email: "orders@caribwholesale.com",
    phone: "+592 220 4410",
    status: "active",
    leadTimeDays: 7,
    openPurchaseOrders: 4,
    payableMinor: 3_450_000,
    currency: "GYD",
    scale: 2,
    createdAt: "2023-01-10T09:00:00Z",
  },
  {
    id: "sup_02",
    name: "Demerara Distributors",
    contact: "S. Ali",
    email: "supply@demdist.gy",
    phone: "+592 220 8890",
    status: "active",
    leadTimeDays: 3,
    openPurchaseOrders: 2,
    payableMinor: 780_000,
    currency: "GYD",
    scale: 2,
    createdAt: "2023-03-22T09:00:00Z",
  },
  {
    id: "sup_03",
    name: "Global Imports Inc.",
    contact: "M. Chen",
    email: "sales@globalimports.com",
    phone: "+1 305 555 0132",
    status: "pending",
    leadTimeDays: 21,
    openPurchaseOrders: 1,
    payableMinor: 0,
    currency: "USD",
    scale: 2,
    createdAt: "2026-06-30T09:00:00Z",
  },
  {
    id: "sup_04",
    name: "Local Farms Cooperative",
    contact: "J. Singh",
    email: "coop@localfarms.gy",
    phone: "+592 231 1200",
    status: "active",
    leadTimeDays: 1,
    openPurchaseOrders: 6,
    payableMinor: 145_000,
    currency: "GYD",
    scale: 2,
    createdAt: "2024-07-01T09:00:00Z",
  },
];
