import { Card, CardContent } from "@RetailOS/ui/components/card";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  type LucideIcon,
  Package,
  Receipt,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";

import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardScreen,
});

const SKELETON_KEYS = ["a", "b", "c", "d"] as const;

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="truncate font-mono font-semibold text-2xl tracking-tight">
            {value}
          </p>
          {hint ? (
            <p className="text-muted-foreground text-xs">{hint}</p>
          ) : null}
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardScreen() {
  // All KPI aggregation is server-side (reports.dashboardSummary). The client
  // only renders the returned figures — no money arithmetic in the browser.
  const summary = useQuery(
    orpc.reports.dashboardSummary.queryOptions({ input: {} })
  );

  const data = summary.data;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          A live snapshot of sales and inventory across your stores.
        </p>
      </div>

      {summary.isError ? (
        <Card className="border-destructive/30 shadow-sm">
          <CardContent className="flex items-center gap-3 p-5 text-sm">
            <TriangleAlert className="size-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">Couldn’t load dashboard data</p>
              <p className="text-muted-foreground">
                {summary.error.message}. Check your connection or permissions
                and retry.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {summary.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SKELETON_KEYS.map((k) => (
            <Skeleton className="h-28 rounded-2xl" key={k} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            hint={data?.sales ? "Completed sales" : "No sales yet"}
            icon={Wallet}
            label="Total Sales"
            value={
              data?.sales
                ? formatMoney(
                    data.sales.totalMinor,
                    data.sales.currency,
                    data.sales.scale
                  )
                : "—"
            }
          />
          <KpiCard
            hint="All time"
            icon={Receipt}
            label="Transactions"
            value={data?.transactionCount ?? 0}
          />
          <KpiCard
            hint={data?.inventoryValue ? "On hand, at cost" : "No stock valued"}
            icon={Package}
            label="Inventory Value"
            value={
              data?.inventoryValue
                ? formatMoney(
                    data.inventoryValue.totalValueMinor,
                    data.inventoryValue.currency,
                    data.inventoryValue.scale
                  )
                : "—"
            }
          />
          <KpiCard
            hint={
              (data?.lowStockCount ?? 0) > 0 ? "Need reordering" : "All stocked"
            }
            icon={AlertTriangle}
            label="Low-Stock Items"
            value={data?.lowStockCount ?? 0}
          />
        </div>
      )}

      <Card className="shadow-sm">
        <CardContent className="p-6">
          <h2 className="font-semibold text-lg tracking-tight">
            Welcome to RetailOS
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Ring up a sale from{" "}
            <span className="font-medium">Point of Sale</span>, or browse your
            catalog under <span className="font-medium">Products</span>. More
            dashboards (cashier, inventory, accounting) arrive as those modules
            ship.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
