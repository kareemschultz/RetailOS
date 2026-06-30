import type { LinkProps } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  Boxes,
  CalendarDays,
  CircleDollarSign,
  CircleHelp,
  Columns3,
  CreditCard,
  FileClock,
  FolderTree,
  History,
  Inbox,
  KeyRound,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  type LucideIcon,
  MapPin,
  Megaphone,
  MessageSquare,
  Package,
  ReceiptText,
  Rocket,
  Ruler,
  ScanLine,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Table,
  Tag,
  TextCursorInput,
  TrendingUp,
  Truck,
  UserCog,
  UserRound,
  Users,
  Workflow,
} from "lucide-react";

// RetailOS navigation config — the data the AdminCN-sourced Sidebar renders.
// Source of truth: docs/architecture/navigation-ia.md (research-backed +
// owner blueprint). Hybrid model: workspace -> group -> nested (max depth 2)
// -> tabs. Sidebar items = different workflows; tabs (inside a page) = views
// of one workflow. `to` is a TanStack Router path (typed against the route
// tree). RetailOS-relevant pages are promoted; AdminCN showcase pages are
// demoted to "Design system"; error/hidden pages are not in nav (reachable by
// URL / command palette / router error boundaries) per the IA doc.

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
      { icon: LayoutDashboard, label: "Overview", to: "/dashboard" },
      { icon: TrendingUp, label: "Sales", to: "/sales-overview" },
      { icon: Banknote, label: "Finance", to: "/finance" },
      { icon: BarChart3, label: "Analytics", to: "/analytics" },
      { icon: Truck, label: "Logistics", to: "/logistics" },
    ],
  },
  {
    groupLabel: "Sales",
    items: [
      { icon: ScanLine, label: "Point of Sale", to: "/pos" },
      { icon: ReceiptText, label: "Sales", to: "/sales" },
      { icon: ShoppingCart, label: "Orders", to: "/orders" },
      { icon: UserRound, label: "Customers", to: "/contacts" },
      { icon: Megaphone, label: "Promotions", to: "/campaigns" },
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
    groupLabel: "Commerce",
    items: [
      { icon: ShoppingBag, label: "eCommerce", to: "/commerce-dashboard" },
      { icon: CreditCard, label: "Payments", to: "/payments" },
    ],
  },
  {
    groupLabel: "Reports",
    items: [
      { icon: TrendingUp, label: "Financial", to: "/reports/financial" },
      { icon: FileClock, label: "Number leases", to: "/reports/number-leases" },
    ],
  },
  {
    groupLabel: "Workspace",
    items: [
      { icon: CalendarDays, label: "Calendar", to: "/calendar" },
      { icon: Columns3, label: "Procurement board", to: "/kanban" },
      { icon: MessageSquare, label: "Messages", to: "/chat" },
      { icon: Inbox, label: "Inbox", to: "/mail" },
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
    // Demoted AdminCN showcase surfaces — owned component patterns reused
    // across the app, kept reachable but out of the operational flow
    // (navigation-ia.md "hide / demote"). Tighten/remove as each pattern is
    // absorbed into its real module.
    groupLabel: "Design system",
    items: [
      {
        icon: TextCursorInput,
        label: "Forms",
        childItems: [
          { label: "Form layouts", to: "/form-layouts" },
          { label: "Form validation", to: "/form-validation" },
          { label: "Setup wizard", to: "/form-wizard" },
        ],
      },
      { icon: Table, label: "Data tables", to: "/data-tables" },
      { icon: LayoutTemplate, label: "Empty states", to: "/empty-states" },
      { icon: Tag, label: "Pricing", to: "/pricing" },
      { icon: CircleHelp, label: "FAQ", to: "/faq" },
      { icon: Rocket, label: "Onboarding", to: "/onboarding" },
    ],
  },
];
