import { Card, CardContent, CardHeader } from "@RetailOS/ui/components/card";
import { cn } from "@RetailOS/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// Owned RetailOS KPI/stat card — adapted from the AdminCN `statistics-card-01`
// pattern (icon tile + large value + label + sub-line) into RetailOS design
// tokens (Assembly Law: sourced from the real template, re-themed, owned here).
// `value` is a ReactNode so callers pass already-formatted Money/counts — the
// card does NO math (backend-owns-truth; the page formats DTOs for display).
interface StatCardProps {
  className?: string;
  hint?: string;
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}

export function StatCard({
  icon: Icon,
  value,
  label,
  hint,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("shadow-sm", className)}>
      <CardHeader className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <span className="truncate font-mono font-semibold text-2xl tabular-nums tracking-tight">
          {value}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <span className="font-medium text-sm">{label}</span>
        {hint ? (
          <span className="text-muted-foreground text-xs">{hint}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}
