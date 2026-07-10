import type { LinkProps } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Boxes,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  FolderTree,
  History,
  Landmark,
  Layers,
  LayoutDashboard,
  type LucideIcon,
  MapPin,
  Package,
  Percent,
  ReceiptText,
  ScanLine,
  ScrollText,
  Settings2,
  Store,
  Tags,
  TriangleAlert,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import type { WorkspaceId } from "./workspaces";

// RetailOS navigation config — the single source the sidebar AND command
// palette render from. Source of truth: docs/architecture/navigation-ia.md.
//
// Model (load-bearing rule): a sidebar ITEM = a distinct workflow; TABS (inside
// a page) = different views of one workflow. Depth is capped at 2 (one expand
// level); anything deeper lives in tabs or search. Each group declares which
// WORKSPACES it appears in, so the workspace switcher re-scopes the same
// sidebar to the user's role rather than presenting parallel IAs.
//
// `to` is a typed TanStack Router path. Some destinations are new surfaces in
// the rebuild that are backed by the typed mock layer until their backend lands
// (see src/data/feature-status.ts) — they are real navigable routes, marked in
// the UI as preview data, never dead links.

export interface NavLeaf {
  badge?: string;
  label: string;
  permission?: string;
  to: LinkProps["to"];
}

export type NavMenuItem = {
  icon: LucideIcon;
  label: string;
  permission?: string;
} & (
  | { to: LinkProps["to"]; childItems?: never }
  | { to?: never; childItems: NavLeaf[] }
);

export interface NavGroup {
  groupLabel: string;
  items: NavMenuItem[];
  // Workspaces this group appears in. "admin" (All Modules) always sees every
  // group, so it need not be listed explicitly.
  workspaces: WorkspaceId[];
}

export const navGroups: NavGroup[] = [
  {
    groupLabel: "Home",
    workspaces: ["retail", "inventory", "finance", "commerce"],
    items: [
      {
        icon: LayoutDashboard,
        label: "Dashboards",
        childItems: [
          { label: "Executive overview", to: "/dashboard" },
          { label: "Operations cockpit", to: "/operations" },
        ],
      },
    ],
  },
  {
    groupLabel: "Sales",
    workspaces: ["retail", "commerce"],
    items: [
      { icon: ScanLine, label: "Point of Sale", to: "/pos" },
      { icon: ReceiptText, label: "Orders & Receipts", to: "/sales" },
      { icon: CreditCard, label: "Hire Purchase", to: "/hire-purchase" },
      { icon: Users, label: "Customers", to: "/customers" },
      {
        icon: Percent,
        label: "Pricing & Promotions",
        childItems: [
          { label: "Price lists", to: "/pricing" },
          { label: "Promotions", to: "/promotions" },
        ],
      },
      {
        icon: CircleDollarSign,
        label: "Shifts & Cash",
        permission: "pos.open_shift",
        to: "/shifts",
      },
    ],
  },
  {
    groupLabel: "Catalog",
    workspaces: ["retail", "inventory", "commerce"],
    items: [
      { icon: Package, label: "Products", to: "/products" },
      { icon: FolderTree, label: "Categories", to: "/categories" },
      { icon: BadgeCheck, label: "Brands", to: "/brands" },
      { icon: Tags, label: "Units & Conversions", to: "/units" },
    ],
  },
  {
    groupLabel: "Inventory & Warehouse",
    workspaces: ["retail", "inventory"],
    items: [
      { icon: Boxes, label: "Stock on hand", to: "/inventory" },
      {
        icon: TriangleAlert,
        label: "Negative stock",
        permission: "inventory.adjust",
        to: "/negative-stock",
      },
      { icon: History, label: "Stock ledger", to: "/stock-ledger" },
      {
        icon: ClipboardCheck,
        label: "Adjustments & Counts",
        permission: "inventory.adjust",
        to: "/adjustments",
      },
      {
        icon: ArrowLeftRight,
        label: "Transfers",
        permission: "inventory.transfer",
        to: "/transfers",
      },
      { icon: Layers, label: "Lots & Expiry", to: "/lots" },
      {
        icon: MapPin,
        label: "Locations",
        childItems: [
          { label: "Locations & Warehouses", to: "/locations" },
          { label: "Bonded goods", permission: "bond.receive", to: "/bonds" },
        ],
      },
    ],
  },
  {
    groupLabel: "Purchasing",
    workspaces: ["inventory", "finance"],
    items: [
      { icon: Truck, label: "Suppliers", to: "/suppliers" },
      { icon: ClipboardList, label: "Purchase orders", to: "/procurement" },
    ],
  },
  {
    groupLabel: "Finance",
    workspaces: ["finance"],
    items: [
      {
        icon: Landmark,
        label: "Accounting",
        permission: "reports.view",
        to: "/financials",
      },
      { icon: Wallet, label: "Receivables (AR)", to: "/receivables" },
      { icon: FileText, label: "Payables (AP)", to: "/payables" },
    ],
  },
  {
    groupLabel: "Online Store",
    workspaces: ["commerce"],
    items: [{ icon: Store, label: "Storefront", to: "/commerce" }],
  },
  {
    groupLabel: "Reports",
    workspaces: ["retail", "inventory", "finance", "commerce"],
    items: [
      {
        icon: BarChart3,
        label: "Reports",
        permission: "reports.view",
        to: "/reports",
      },
    ],
  },
];

// Settings + utility items are pinned at the BOTTOM of the sidebar, visually
// separated from operational nav, and shown in every workspace.
export const navFooterGroup: NavGroup = {
  groupLabel: "Administration",
  workspaces: ["retail", "inventory", "finance", "commerce"],
  items: [
    {
      icon: Bell,
      label: "Notifications",
      to: "/notifications",
    },
    {
      icon: Users,
      label: "Staff & Access",
      permission: "users.manage",
      to: "/staff",
    },
    {
      icon: ScrollText,
      label: "Audit trail",
      permission: "audit.view",
      to: "/audit-log",
    },
    {
      icon: Settings2,
      label: "Settings",
      permission: "settings.manage",
      childItems: [
        { label: "Overview", to: "/settings" },
        { label: "Companies & Locations", to: "/settings/companies" },
        { label: "White-label & Branding", to: "/settings/branding" },
        { label: "Tax rates", to: "/settings/tax" },
        { label: "Numbering", to: "/settings/numbering" },
      ],
    },
  ],
};

// Scope the operational groups to the active workspace. "admin" sees all.
export function groupsForWorkspace(
  groups: NavGroup[],
  workspace: WorkspaceId
): NavGroup[] {
  if (workspace === "admin") {
    return groups;
  }
  return groups.filter((g) => g.workspaces.includes(workspace));
}

// UX-only visibility filter. Backend assertPermission remains the enforcement;
// hiding a nav item is never a security boundary.
export function filterNavGroups(
  groups: NavGroup[],
  permissions: string[]
): NavGroup[] {
  const allowed = (p?: string) => !p || permissions.includes(p);
  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => allowed(item.permission))
        .map((item) =>
          item.childItems
            ? {
                ...item,
                childItems: item.childItems.filter((leaf) =>
                  allowed(leaf.permission)
                ),
              }
            : item
        )
        .filter((item) => !item.childItems || item.childItems.length > 0),
    }))
    .filter((group) => group.items.length > 0);
}
