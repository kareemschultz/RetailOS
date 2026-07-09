import {
  Boxes,
  Landmark,
  LayoutGrid,
  type LucideIcon,
  ScanLine,
  Store,
  Warehouse,
} from "lucide-react";

// WORKSPACES — the role/context switcher at the top of the sidebar. Per the
// navigation-IA decision, workspaces RE-SCOPE the same sidebar to the user's
// job (NetSuite "Centers" / Dynamics "Role Centers" / Odoo app switcher), they
// are NOT parallel IAs. A group is shown in a workspace when its `workspaces`
// list includes that workspace id (or the group opts into "all"). Settings is
// always pinned at the bottom regardless of workspace.
//
// POS is deliberately NOT a sidebar workspace — it launches the full-screen
// register (its own route with no module chrome), so it lives here only as a
// switch target that navigates to /pos.

export type WorkspaceId =
  | "retail"
  | "inventory"
  | "finance"
  | "commerce"
  | "admin";

export interface WorkspaceDef {
  description: string;
  icon: LucideIcon;
  id: WorkspaceId;
  label: string;
  // Optional permission gate (UX only; backend is the real enforcement).
  permission?: string;
}

export const WORKSPACES: WorkspaceDef[] = [
  {
    id: "retail",
    label: "Store Retail",
    description: "Selling, orders, customers, and the shop floor",
    icon: Store,
  },
  {
    id: "inventory",
    label: "Inventory & Warehouse",
    description: "Stock, movements, transfers, and locations",
    icon: Warehouse,
  },
  {
    id: "finance",
    label: "Finance & Back-office",
    description: "Ledgers, receivables, payables, and tax",
    icon: Landmark,
    permission: "reports.view",
  },
  {
    id: "commerce",
    label: "Online Store",
    description: "Storefront, online orders, and content",
    icon: Boxes,
  },
  {
    id: "admin",
    label: "All Modules",
    description: "Everything you have access to, ungrouped by role",
    icon: LayoutGrid,
  },
];

export const DEFAULT_WORKSPACE: WorkspaceId = "retail";

// A pseudo-workspace target for the POS register (full-screen, no sidebar).
export const POS_WORKSPACE = {
  id: "pos" as const,
  label: "Point of Sale",
  description: "Full-screen cashier register",
  icon: ScanLine,
  to: "/pos" as const,
};

export function getWorkspace(id: WorkspaceId): WorkspaceDef {
  return WORKSPACES.find((w) => w.id === id) ?? WORKSPACES[0];
}
