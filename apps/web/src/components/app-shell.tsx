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
import { ScanLine, Store } from "lucide-react";
import type { ReactNode } from "react";

import { ConnectionStatus } from "./connection-status";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

// RetailOS application shell — composed from the owned shadcn `sidebar` block
// (the canonical AdminCN-style shell primitive), re-themed via the RetailOS
// sidebar tokens already in globals.css. Adapted to TanStack Start: nav items
// are TanStack <Link>s via the Base UI `render` prop (no Next.js routing).
// Progressive disclosure: the cashier persona sees only the sale surfaces.
const NAV_ITEMS = [
  { to: "/pos", label: "Point of Sale", icon: ScanLine },
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
          <SidebarGroup>
            <SidebarGroupLabel>Sell</SidebarGroupLabel>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
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
