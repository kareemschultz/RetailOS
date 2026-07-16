import { Separator } from "@RetailOS/ui/components/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@RetailOS/ui/components/sidebar";
import type { ReactNode } from "react";

import { WorkspaceProvider } from "@/configs/workspace-store";

import { AppBreadcrumbs } from "./app-breadcrumbs";
import { AppSidebar } from "./app-sidebar";
import { CommandMenu } from "./command-menu";
import { ConnectionStatus } from "./connection-status";
import { ModeToggle } from "./mode-toggle";
import { NotificationsBell } from "./notifications-bell";
import { ThemeCustomizer } from "./theme-customizer";
import UserMenu from "./user-menu";

// RetailOS application shell — dropped in from the AdminCN template: the Sidebar
// (app-sidebar.tsx, nested/collapsible) + the polished sticky card-style Header
// bar with the command palette (command-menu.tsx). Re-themed to RetailOS tokens;
// TanStack Start under it. AdminCN's notification/activity/theme-customizer header
// widgets are deferred until their backing subsystems exist (they truly can't
// apply yet — no notifications/activity data); the header polish + command
// palette + mode toggle are kept.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="before:mask-[linear-gradient(var(--background),var(--background)_18%,transparent_100%)] sticky top-0 z-50 px-4 before:absolute before:inset-0 before:backdrop-blur-md sm:px-6">
            <div className="relative z-[51] mx-auto mt-3 flex w-full items-center justify-between gap-2 rounded-xl border bg-card px-4 py-2">
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
                <SidebarTrigger className="[&_svg]:size-5!" />
                <Separator
                  className="self-center! hidden h-4! sm:block"
                  orientation="vertical"
                />
                <AppBreadcrumbs />
              </div>
              <div className="flex items-center gap-1.5">
                <CommandMenu />
                <ConnectionStatus />
                <NotificationsBell />
                <ThemeCustomizer />
                <ModeToggle />
                <UserMenu />
              </div>
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </WorkspaceProvider>
  );
}
