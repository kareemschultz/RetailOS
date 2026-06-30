import type { LinkProps } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  Boxes,
  CircleDollarSign,
  CircleHelp,
  FileClock,
  FolderTree,
  History,
  Inbox,
  KeyRound,
  Layers,
  LayoutDashboard,
  type LucideIcon,
  MapPin,
  Package,
  ReceiptText,
  Rocket,
  Ruler,
  ScanLine,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Truck,
  UserCog,
  UserRound,
  Users,
  Workflow,
} from "lucide-react";

// RetailOS navigation config — the data the AdminCN-sourced Sidebar renders.
// Hybrid model (owner spec): workspace → group → nested (max depth 2) → tabs.
// Sidebar items = different workflows; tabs (inside a page) = views of one
// workflow. `to` is a TanStack Router path (typed against the route tree).

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
    groupLabel: "Operations",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
      { icon: ScanLine, label: "Point of Sale", to: "/pos" },
      { icon: ReceiptText, label: "Sales", to: "/sales" },
      { icon: CircleDollarSign, label: "Shifts", to: "/shifts" },
    ],
  },
  {
    groupLabel: "Insights",
    items: [
      { icon: Banknote, label: "Finance", to: "/finance" },
      { icon: BarChart3, label: "Analytics", to: "/analytics" },
      { icon: Truck, label: "Logistics", to: "/logistics" },
    ],
  },
  {
    groupLabel: "Commerce",
    items: [
      { icon: ShoppingCart, label: "Orders", to: "/orders" },
      { icon: ShoppingBag, label: "eCommerce", to: "/commerce-dashboard" },
    ],
  },
  {
    groupLabel: "Catalog",
    items: [
      {
        icon: Package,
        label: "Products",
        // Nested feature level (depth 2): the product-attribute pages.
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
    groupLabel: "Inventory",
    items: [
      { icon: Boxes, label: "Stock", to: "/inventory" },
      { icon: Layers, label: "Lots", to: "/lots" },
      { icon: History, label: "Stock ledger", to: "/stock-ledger" },
      { icon: ArrowLeftRight, label: "Transfers", to: "/transfers" },
      { icon: ShieldCheck, label: "Bonded goods", to: "/bonds" },
    ],
  },
  {
    groupLabel: "Network",
    items: [{ icon: MapPin, label: "Locations", to: "/locations" }],
  },
  {
    groupLabel: "Reports",
    items: [
      { icon: TrendingUp, label: "Financial", to: "/reports/financial" },
      { icon: FileClock, label: "Number leases", to: "/reports/number-leases" },
    ],
  },
  {
    groupLabel: "Administration",
    items: [
      { icon: Users, label: "Users", to: "/users" },
      { icon: UserCog, label: "Roles", to: "/roles" },
      { icon: KeyRound, label: "Permissions", to: "/permissions" },
      { icon: Settings, label: "Settings", to: "/settings" },
      { icon: UserRound, label: "Profile", to: "/profile" },
    ],
  },
  {
    groupLabel: "Pages",
    items: [
      { icon: Banknote, label: "Pricing", to: "/pricing" },
      { icon: CircleHelp, label: "FAQ", to: "/faq" },
      { icon: Rocket, label: "Onboarding", to: "/onboarding" },
      { icon: Inbox, label: "Empty states", to: "/empty-states" },
    ],
  },
];
