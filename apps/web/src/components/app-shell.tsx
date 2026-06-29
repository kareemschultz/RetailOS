import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@RetailOS/ui/components/sidebar";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BadgeCheck,
  Barcode,
  Boxes,
  CircleDollarSign,
  FileClock,
  FolderTree,
  History,
  LayoutDashboard,
  MapPin,
  Package,
  ReceiptText,
  Ruler,
  ScanLine,
  ShieldCheck,
  Store,
  Tags,
  TrendingUp,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";

import { ConnectionStatus } from "./connection-status";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

// RetailOS application shell — composed from the owned shadcn `sidebar` block
// (the canonical AdminCN-style shell primitive), re-themed via the RetailOS
// sidebar tokens already in globals.css. Adapted to TanStack Start: nav items
// are TanStack <Link>s via the Base UI `render` prop (no Next.js routing).
const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Sell",
    items: [
      { to: "/pos", label: "Point of Sale", icon: ScanLine },
      { to: "/sales", label: "Sales", icon: ReceiptText },
      { to: "/shifts", label: "Shifts", icon: CircleDollarSign },
    ],
  },
  {
    label: "Catalog",
    items: [
      { to: "/products", label: "Products", icon: Package },
      { to: "/variants", label: "Variants", icon: Tags },
      { to: "/skus", label: "SKUs", icon: Barcode },
      { to: "/barcodes", label: "Barcodes", icon: ScanLine },
      { to: "/categories", label: "Categories", icon: FolderTree },
      { to: "/brands", label: "Brands", icon: BadgeCheck },
      { to: "/units", label: "Units", icon: Ruler },
      { to: "/uom-conversions", label: "Conversions", icon: Workflow },
    ],
  },
  {
    label: "Inventory",
    items: [
      { to: "/inventory", label: "Stock", icon: Boxes },
      { to: "/stock-ledger", label: "Stock ledger", icon: History },
      { to: "/transfers", label: "Transfers", icon: ArrowLeftRight },
      { to: "/bonds", label: "Bonded goods", icon: ShieldCheck },
    ],
  },
  {
    label: "Network",
    items: [{ to: "/locations", label: "Locations", icon: MapPin }],
  },
  {
    label: "Reports",
    items: [
      { to: "/reports/financial", label: "Financial", icon: TrendingUp },
      { to: "/reports/number-leases", label: "Number leases", icon: FileClock },
    ],
  },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Store className="size-4" />
            </div>
            <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
              RetailOS
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(item.to)}
                      render={<Link to={item.to} />}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex flex-1 items-center justify-end gap-2">
            <ConnectionStatus />
            <ModeToggle />
            <UserMenu />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
