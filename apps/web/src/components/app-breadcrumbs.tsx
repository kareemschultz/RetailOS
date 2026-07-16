import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

import { ROUTE_LABELS } from "@/configs/route-labels";

// Header breadcrumbs — orient the user inside the consolidated IA (the design
// law's "Context" band). Labels resolve from a shared registry so the sidebar,
// command palette, and breadcrumbs all name a destination identically. Segments
// with no known label are title-cased as a fallback (e.g. an :id param).
function labelFor(segment: string, path: string): string {
  return (
    ROUTE_LABELS[path] ??
    ROUTE_LABELS[segment] ??
    segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function AppBreadcrumbs() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const segments = pathname.split("/").filter(Boolean);

  // Root / dashboard → just the app context word, no crumbs.
  if (segments.length === 0) {
    return <span className="truncate font-medium text-sm">Dashboard</span>;
  }

  const crumbs = segments.map((segment, index) => {
    const path = `/${segments.slice(0, index + 1).join("/")}`;
    return { label: labelFor(segment, path), path };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <Fragment key={crumb.path}>
              {index > 0 && (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
              )}
              <li className="min-w-0">
                {isLast ? (
                  <span
                    aria-current="page"
                    className="truncate font-medium text-foreground"
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    className="truncate text-muted-foreground transition-colors hover:text-foreground"
                    to={crumb.path}
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
