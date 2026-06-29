import { Badge } from "@RetailOS/ui/components/badge";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import { cn } from "@RetailOS/ui/lib/utils";
import type { ReactNode } from "react";

interface DataTableCardProps {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  count?: number;
  footer?: ReactNode;
  title: string;
}

// Owned shadcn Studio "datatable" shell: a card with a flush toolbar (title +
// optional count badge on the left, actions/search on the right), a bordered
// content area for the table, and an optional footer. `gap-0` keeps the toolbar
// flush against the content — the Card primitive's default `gap-4` would float
// it off. Use for every dense operational list surface so a header can never be
// cramped by ad-hoc `Card p-0` composition (which inherits no header padding —
// the catalog-card bug). One owned shell = one consistent, re-themed look.
export function DataTableCard({
  title,
  count,
  actions,
  footer,
  className,
  children,
}: DataTableCardProps) {
  return (
    <Card className={cn("gap-0 overflow-hidden p-0 shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-sm">{title}</h2>
          {count == null ? null : <Badge variant="secondary">{count}</Badge>}
        </div>
        {actions}
      </div>
      <CardContent className="p-0">{children}</CardContent>
      {footer ? (
        <div className="border-t px-5 py-3 text-muted-foreground text-sm">
          {footer}
        </div>
      ) : null}
    </Card>
  );
}
