import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@RetailOS/ui/components/collapsible";
import {
  Sidebar,
  SidebarContent,
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
} from "@RetailOS/ui/components/sidebar";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRightIcon, Store } from "lucide-react";

import { type NavMenuItem, navGroups } from "@/configs/nav-config";

// RetailOS application sidebar — dropped in from the AdminCN template
// `Sidebar.tsx` (Assembly Law: their structure + collapsible nesting, badges,
// active-state), edited only for our stack: next/link → TanStack <Link>,
// next/navigation usePathname → useRouterState, their settings/logo → ours.
// Renders the hybrid nav model (workspace → group → nested, depth 2).

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

export function AppSidebar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
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
      <SidebarContent className="group-data-[collapsible=icon]:overflow-y-auto">
        {navGroups.map((group) => (
          <SidebarGroup key={group.groupLabel}>
            <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider">
              {group.groupLabel}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <MenuItemNode
                    item={item}
                    key={item.label}
                    pathname={pathname}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
