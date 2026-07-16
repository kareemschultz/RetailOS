import { Badge } from "@RetailOS/ui/components/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import { SidebarMenuButton, useSidebar } from "@RetailOS/ui/components/sidebar";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronsUpDown } from "lucide-react";

import { useTheme } from "next-themes";

import { useWorkspace } from "@/configs/workspace-store";
import { getWorkspace, POS_WORKSPACE, WORKSPACES } from "@/configs/workspaces";
import { useBranding } from "@/theme/branding-store";
import { orpc } from "@/utils/orpc";

// The role/context switcher pinned to the top of the sidebar. Selecting a
// workspace re-scopes the nav (see nav-config.groupsForWorkspace); selecting
// POS navigates to the full-screen register instead. Also renders the tenant's
// white-label logo + name so branding is present in the app's most prominent
// slot.
export function WorkspaceSwitcher() {
  const { workspace, setWorkspace } = useWorkspace();
  const { branding } = useBranding();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const active = getWorkspace(workspace);
  const ActiveIcon = active.icon;
  // Prefer the mode-specific logo, then the other, then the icon mark.
  const logoUrl =
    resolvedTheme === "dark"
      ? (branding.logoDarkUrl ?? branding.logoLightUrl)
      : (branding.logoLightUrl ?? branding.logoDarkUrl);

  // Permissions gate which workspaces are offered (UX only).
  const access = useQuery(orpc.membership.myAccess.queryOptions({ input: {} }));
  const permissions = access.data?.permissions ?? [];
  const grantedPermissions = permissions as readonly string[];
  const available = WORKSPACES.filter(
    (w) => !w.permission || grantedPermissions.includes(w.permission)
  );

  const collapsed = state === "collapsed";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            className="h-12 gap-2 data-[state=open]:bg-sidebar-accent"
            size="lg"
          />
        }
      >
        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary text-primary-foreground">
          {logoUrl ? (
            <img
              alt={`${branding.appName} logo`}
              className="size-full object-contain"
              height={32}
              src={logoUrl}
              width={32}
            />
          ) : (
            <ActiveIcon className="size-4" />
          )}
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-1 flex-col text-left leading-tight">
            <span className="truncate font-semibold text-sm">
              {branding.appName}
            </span>
            <span className="truncate text-muted-foreground text-xs">
              {active.label}
            </span>
          </div>
        )}
        {!collapsed && <ChevronsUpDown className="ml-auto size-4 opacity-60" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64" sideOffset={8}>
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Switch workspace
        </DropdownMenuLabel>
        {available.map((w) => {
          const Icon = w.icon;
          return (
            <DropdownMenuItem
              className="gap-2"
              key={w.id}
              onClick={() => setWorkspace(w.id)}
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-sm">{w.label}</span>
                <span className="truncate text-muted-foreground text-xs">
                  {w.description}
                </span>
              </div>
              {workspace === w.id && (
                <Check className="ml-auto size-4 text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2"
          onClick={() => navigate({ to: POS_WORKSPACE.to })}
        >
          <POS_WORKSPACE.icon className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-sm">
              {POS_WORKSPACE.label}
            </span>
            <span className="truncate text-muted-foreground text-xs">
              {POS_WORKSPACE.description}
            </span>
          </div>
          <Badge className="ml-auto" variant="secondary">
            Full screen
          </Badge>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
