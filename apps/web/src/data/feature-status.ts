// FEATURE STATUS REGISTRY
// -----------------------------------------------------------------------------
// The frontend rebuild wires every surface to real oRPC endpoints where they
// exist and work, and to a typed mock layer where the backend is missing or
// buggy. This registry is the single source of truth for which surfaces are
// which, so the UI can render an honest "Preview data" marker and the backend
// team has one checklist of contracts still owed. Keep it in sync with
// docs/architecture/frontend-implementation.md.

export type DataSource =
  // Fully wired to a stable, approved oRPC procedure.
  | "real"
  // No/partial/buggy backend — rendered from the typed mock layer. Marked in UI.
  | "mock"
  // Real reads, mocked writes (or vice-versa) — partially wired.
  | "partial";

export interface FeatureStatus {
  // oRPC procedures this surface consumes (for traceability / backend TODO).
  contracts?: string[];
  key: string;
  // One-line note on what's missing when not "real".
  note?: string;
  source: DataSource;
  title: string;
}

// NOTE: this reflects the frontend's view of backend readiness at rebuild time.
// It is intentionally conservative — a surface is only "real" once its endpoint
// is confirmed stable. Flip entries to "real" as the backend lands.
export const FEATURE_STATUS = {
  "dashboard.exec": {
    key: "dashboard.exec",
    title: "Executive dashboard",
    source: "partial",
    note: "KPIs from reports.* where available; some tiles use preview data.",
    contracts: ["reports.salesSummary", "reports.inventoryValuation"],
  },
  "catalog.products": {
    key: "catalog.products",
    title: "Product catalog",
    source: "real",
    contracts: ["product.list", "product.get", "catalog.*"],
  },
  "inventory.stock": {
    key: "inventory.stock",
    title: "Inventory on-hand",
    source: "real",
    contracts: ["inventory.list", "inventory.adjust"],
  },
  "inventory.negativeStock": {
    key: "inventory.negativeStock",
    title: "Negative stock report",
    source: "real",
    contracts: ["inventory.stockByLocation", "inventory.adjust"],
  },
  "inventory.ledger": {
    key: "inventory.ledger",
    title: "Stock movement ledger",
    source: "partial",
    note: "Timeline reads real movements; some movement types are mocked.",
    contracts: ["inventory.movements"],
  },
  "warehouse.locations": {
    key: "warehouse.locations",
    title: "Location hierarchy",
    source: "real",
    contracts: ["location.tree", "location.list"],
  },
  "procurement.po": {
    key: "procurement.po",
    title: "Purchase orders",
    source: "real",
    contracts: ["procurement.*"],
  },
  "procurement.suppliers": {
    key: "procurement.suppliers",
    title: "Suppliers",
    source: "partial",
    note: "Supplier CRUD is thin on the backend; profile fields mocked.",
  },
  "finance.gl": {
    key: "finance.gl",
    title: "General ledger",
    source: "real",
    contracts: ["accounting.*"],
  },
  "finance.ar": {
    key: "finance.ar",
    title: "Accounts receivable",
    source: "mock",
    note: "No AR aging/collections endpoints yet — full preview data.",
  },
  "finance.ap": {
    key: "finance.ap",
    title: "Accounts payable",
    source: "mock",
    note: "No AP aging/payment-run endpoints yet — full preview data.",
  },
  "crm.customers": {
    key: "crm.customers",
    title: "Customers / CRM",
    source: "mock",
    note: "No dedicated CRM router yet — preview data with realistic shape.",
  },
  "sales.hirePurchase": {
    key: "sales.hirePurchase",
    title: "Hire purchase / layaway",
    source: "mock",
    note: "No financing router yet — preview data with realistic schedules.",
  },
  "pos.register": {
    key: "pos.register",
    title: "POS register",
    source: "real",
    contracts: ["pos.quote", "pos.createSale", "pos.receipt"],
  },
  "reports.analytics": {
    key: "reports.analytics",
    title: "Reports & analytics",
    source: "partial",
    note: "Core reports real; advanced cohort/forecast tiles mocked.",
    contracts: ["reports.*"],
  },
  "admin.staff": {
    key: "admin.staff",
    title: "Staff & roles (RBAC)",
    source: "real",
    contracts: ["membership.*"],
  },
  "admin.audit": {
    key: "admin.audit",
    title: "Audit trail",
    source: "real",
    contracts: ["audit.list"],
  },
  "admin.settings": {
    key: "admin.settings",
    title: "Settings",
    source: "partial",
    note: "Company/tax/numbering real; branding + notifications mocked.",
    contracts: ["company.*", "tax.*", "numbering.*"],
  },
  "promotions.campaigns": {
    key: "promotions.campaigns",
    title: "Promotions & pricing rules",
    source: "mock",
    note: "No promotions engine yet — preview data.",
  },
  "notifications.center": {
    key: "notifications.center",
    title: "Notifications",
    source: "mock",
    note: "No notifications service yet — preview data.",
  },
  "pricing.lists": {
    key: "pricing.lists",
    title: "Pricing & price lists",
    source: "mock",
    note: "No pricing engine yet — preview data.",
  },
  "inventory.adjustments": {
    key: "inventory.adjustments",
    title: "Stock adjustments",
    source: "mock",
    note: "Adjustment posting not wired yet — preview data.",
  },
  "branding.whitelabel": {
    key: "branding.whitelabel",
    title: "White-label branding",
    source: "mock",
    note: "Branding is stored locally in this preview; tenant persistence pending.",
  },
} satisfies Record<string, FeatureStatus>;

export type FeatureKey = keyof typeof FEATURE_STATUS;

export function getFeatureStatus(key: FeatureKey): FeatureStatus {
  return FEATURE_STATUS[key];
}

export function isPreview(key: FeatureKey): boolean {
  return FEATURE_STATUS[key].source !== "real";
}
