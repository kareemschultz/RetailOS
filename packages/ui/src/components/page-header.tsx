import { cn } from "@RetailOS/ui/lib/utils";
import type { ReactNode } from "react";

// RetailOS PageHeader — enforces the design-language screen flow at the top of
// every module page: Title + description (what am I looking at?) on the left,
// primary/secondary Actions on the right, an optional Context row (breadcrumb,
// tenant/location scope) above, and an optional Metrics/Tabs row below. This is
// the "never header-then-100-buttons-then-table" guardrail expressed as a
// component: actions live in one designated slot, advanced actions go behind a
// kebab the caller passes in.
interface PageHeaderProps {
  // Row rendered ABOVE the title — breadcrumbs, scope context. Optional.
  context?: ReactNode;
  // Right-aligned action slot — primary button + kebab/secondary. Optional.
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  title: ReactNode;
  // Row rendered BELOW the header — in-page tabs or KPI strip. Optional.
  children?: ReactNode;
}

export function PageHeader({
  context,
  title,
  description,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {context ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          {context}
        </div>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-balance font-semibold text-2xl tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="text-pretty text-muted-foreground text-sm leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

// A KPI strip that sits directly under a PageHeader — a responsive grid so the
// "Metrics" band of the screen flow is one consistent row of StatCards across
// every module (consolidated, not 50 random cards).
export function PageMetrics({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}

// The standard page body wrapper — consistent max width + vertical rhythm on
// the 4-pt grid so every module page breathes identically.
export function PageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>{children}</div>
  );
}
