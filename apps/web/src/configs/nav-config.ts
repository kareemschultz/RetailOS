import type { LinkProps } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  FolderTree,
  History,
  Landmark,
  Layers,
  LayoutDashboard,
  type LucideIcon,
  MapPin,
  Package,
  ReceiptText,
  Ruler,
  ScanLine,
  ShieldCheck,
  Store,
  Workflow,
} from "lucide-react";

// RetailOS navigation config — the data the AdminCN-sourced Sidebar renders.
// Source of truth: docs/architecture/navigation-ia.md (research-backed +
// owner blueprint). Hybrid model: workspace -> group -> nested (max depth 2)
// -> tabs. Sidebar items = different workflows; tabs (inside a page) = views
// of one workflow. `to` is a TanStack Router path (typed against the route
// tree). For client-facing builds, sidebar + command palette expose only surfaces
// backed by RetailOS APIs. AdminCN showcase routes can remain in source as owned
// design assets, but they must not be promoted as production modules until they
// are normalized, wired to oRPC, and verified against the backend contract.

export interface NavLeaf {
  badge?: string;
  label: string;
  to: LinkProps["to"];
}

export type NavMenuItem = {
  icon: LucideIcon;
  label: string;
} & (
  | { to: LinkProps["to"]; childItems?: never }
  | { to?: never; childItems: NavLeaf[] }
);

export interface NavGroup {
  groupLabel: string;
  items: NavMenuItem[];
}

export const navGroups: NavGroup[] = [
  {
    groupLabel: "Dashboards",
    items: [
      {
        icon: LayoutDashboard,
        label: "Command",
        childItems: [
          { label: "Executive overview", to: "/dashboard" },
          { label: "Operations cockpit", to: "/operations" },
        ],
      },
    ],
  },
  {
    groupLabel: "Sales",
    items: [
      { icon: ScanLine, label: "Point of Sale", to: "/pos" },
      { icon: ReceiptText, label: "Sales", to: "/sales" },
      { icon: CircleDollarSign, label: "Shifts", to: "/shifts" },
    ],
  },
  {
    groupLabel: "Catalog",
    items: [
      {
        icon: Package,
        label: "Products",
        // Nested feature level (depth 2): the product-attribute pages.
        // (Long-term these also become TABS inside a Product detail.)
        childItems: [
          { label: "All products", to: "/products" },
          { label: "Variants", to: "/variants" },
          { label: "SKUs", to: "/skus" },
          { label: "Barcodes", to: "/barcodes" },
        ],
      },
      { icon: FolderTree, label: "Categories", to: "/categories" },
      { icon: BadgeCheck, label: "Brands", to: "/brands" },
      { icon: Ruler, label: "Units", to: "/units" },
      { icon: Workflow, label: "Conversions", to: "/uom-conversions" },
    ],
  },
  {
    groupLabel: "Inventory & Warehouse",
    items: [
      { icon: Boxes, label: "Stock", to: "/inventory" },
      { icon: Layers, label: "Lots", to: "/lots" },
      { icon: History, label: "Stock ledger", to: "/stock-ledger" },
      { icon: ArrowLeftRight, label: "Transfers", to: "/transfers" },
      { icon: ShieldCheck, label: "Bonded goods", to: "/bonds" },
      { icon: MapPin, label: "Locations", to: "/locations" },
    ],
  },
  {
    groupLabel: "Procurement",
    items: [
      { icon: ClipboardList, label: "Purchase orders", to: "/procurement" },
    ],
  },
  {
    groupLabel: "Commerce",
    items: [{ icon: Store, label: "Storefront", to: "/commerce" }],
  },
  {
    groupLabel: "Financials",
    items: [{ icon: Landmark, label: "Accounting", to: "/financials" }],
  },
  {
    groupLabel: "Reports",
    items: [
      {
        icon: BarChart3,
        label: "Reports",
        childItems: [
          { label: "Overview", to: "/reports" },
          { label: "Number leases", to: "/reports/number-leases" },
          { label: "Financial status", to: "/reports/financial" },
        ],
      },
    ],
  },
];
