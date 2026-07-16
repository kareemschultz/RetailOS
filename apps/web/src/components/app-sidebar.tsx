import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@RetailOS/ui/components/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@RetailOS/ui/components/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import {
  filterNavGroups,
  groupsForWorkspace,
  type NavGroup,
  type NavMenuItem,
  navFooterGroup,
  navGroups,
} from "@/configs/nav-config";
import { useWorkspace } from "@/configs/workspace-store";
import { useSettings } from "@/theme/settings-store";
import { orpc } from "@/utils/orpc";

// RetailOS application sidebar. Renders the hybrid nav model from nav-config
// (workspace → group → nested, depth 2): the workspace switcher re-scopes the
// operational groups, role permissions filter items (UX only), and the
// Administration group is pinned to the footer, visually separated from the
// operational nav. Source of truth: docs/architecture/navigation-ia.md.

function MenuItemNode({
  item,
  pathname,
}: {
  item: NavMenuItem;
  pathname: string;
}) {
  const Tag = item.icon;

  // Leaf item → a direct TanStack Link.
  if (!item.childItems) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          className="data-active:bg-primary/10!"
          isActive={pathname === item.to}
          render={<Link to={item.to} />}
          tooltip={item.label}
        >
          <Tag />
          <span>{item.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  // Parent with children → a collapsible group of sub-links (depth 2).
  const isChildActive = item.childItems.some((leaf) => pathname === leaf.to);
  return (
    <Collapsible className="group/collapsible" defaultOpen={isChildActive}>
      <SidebarMenuItem>
        <CollapsibleTrigger
          render={
            <SidebarMenuButton
              className="data-active:bg-primary/5!"
              isActive={isChildActive}
              tooltip={item.label}
            />
          }
        >
          <Tag />
          <span>{item.label}</span>
          <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-all duration-200 data-ending-style:h-0 data-starting-style:h-0">
          <SidebarMenuSub>
            {item.childItems.map((leaf) => (
              <SidebarMenuSubItem key={leaf.label}>
                <SidebarMenuSubButton
                  className="data-active:bg-primary/10!"
                  isActive={pathname === leaf.to}
                  render={<Link to={leaf.to} />}
                >
                  {leaf.label}
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function NavGroupSection({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider">
        {group.groupLabel}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item) => (
            <MenuItemNode item={item} key={item.label} pathname={pathname} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { settings } = useSettings();
  const { workspace } = useWorkspace();
  // Map our settings.variant (default/inset/floating) to the sidebar primitive's
  // variant (sidebar/inset/floating) so the customizer's controls apply live.
  const variant = settings.variant === "default" ? "sidebar" : settings.variant;
  // Role-filtered nav (UX only; backend assertPermission is the real gate).
  // Fallback [] hides gated items until access loads — nothing sensitive
  // flashes, items just appear once permissions arrive.
  const access = useQuery(orpc.membership.myAccess.queryOptions({ input: {} }));
  const permissions = access.data?.permissions ?? [];
  // Scope to the active workspace, then filter by permission.
  const scoped = groupsForWorkspace(navGroups, workspace);
  const groups = filterNavGroups(scoped, permissions);
  const footerGroups = filterNavGroups([navFooterGroup], permissions);

  return (
    <Sidebar collapsible={settings.collapsible} variant={variant}>
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent className="group-data-[collapsible=icon]:overflow-y-auto">
        {groups.map((group) => (
          <NavGroupSection
            group={group}
            key={group.groupLabel}
            pathname={pathname}
          />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator className="mb-1" />
        {footerGroups.map((group) => (
          <SidebarMenu key={group.groupLabel}>
            {group.items.map((item) => (
              <MenuItemNode item={item} key={item.label} pathname={pathname} />
            ))}
          </SidebarMenu>
        ))}
      </SidebarFooter>
    </Sidebar>
  );
}
