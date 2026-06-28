import { Card, CardContent } from "@RetailOS/ui/components/card";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  type LucideIcon,
  Package,
  Receipt,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";

import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardScreen,
});

type CurrencyTotal = {
  currency: string;
  scale: number;
  totalMinor: number;
} | null;

// Pick the currency with the most activity as the headline figure; summing
// minor units across currencies would be meaningless (charter §12).
function topByValue(
  rows: { currency: string; scale: number; valueMinor: number }[]
): CurrencyTotal {
  if (rows.length === 0) {
    return null;
  }
  const byCurrency = new Map<
    string,
    { currency: string; scale: number; totalMinor: number }
  >();
  for (const row of rows) {
    const existing = byCurrency.get(row.currency) ?? {
      currency: row.currency,
      scale: row.scale,
      totalMinor: 0,
    };
    existing.totalMinor += row.valueMinor;
    byCurrency.set(row.currency, existing);
  }
  return [...byCurrency.values()].sort(
    (a, b) => b.totalMinor - a.totalMinor
  )[0];
}

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
  const sales = useQuery(orpc.reports.salesBasic.queryOptions({ input: {} }));
  const valuation = useQuery(
    orpc.reports.valuation.queryOptions({ input: {} })
  );
  const lowStock = useQuery(orpc.reports.lowStock.queryOptions({ input: {} }));

  const salesTop = topByValue(
    (sales.data?.byCurrency ?? []).map((r) => ({
      currency: r.currency,
      scale: r.scale,
      valueMinor: r.totalMinor,
    }))
  );
  const transactions = (sales.data?.byCurrency ?? []).reduce(
    (sum, r) => sum + r.saleCount,
    0
  );
  const inventoryTop = topByValue([
    ...(valuation.data?.avco ?? []).map((r) => ({
      currency: r.currency,
      scale: r.scale,
      valueMinor: r.totalValueMinor,
    })),
    ...(valuation.data?.fifo ?? []).map((r) => ({
      currency: String(r.currency),
      scale: Number(r.scale),
      valueMinor: Number(r.totalValueMinor),
    })),
  ]);
  const lowStockCount = lowStock.data?.length ?? 0;

  const loading = sales.isLoading || valuation.isLoading || lowStock.isLoading;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          A live snapshot of sales and inventory across your stores.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["a", "b", "c", "d"].map((k) => (
            <Skeleton className="h-28 rounded-2xl" key={k} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            hint={salesTop ? "Completed sales" : "No sales yet"}
            icon={Wallet}
            label="Total Sales"
            value={
              salesTop
                ? formatMoney(
                    salesTop.totalMinor,
                    salesTop.currency,
                    salesTop.scale
                  )
                : "—"
            }
          />
          <KpiCard
            hint="All time"
            icon={Receipt}
            label="Transactions"
            value={transactions}
          />
          <KpiCard
            hint={inventoryTop ? "On hand, at cost" : "No stock valued"}
            icon={Package}
            label="Inventory Value"
            value={
              inventoryTop
                ? formatMoney(
                    inventoryTop.totalMinor,
                    inventoryTop.currency,
                    inventoryTop.scale
                  )
                : "—"
            }
          />
          <KpiCard
            hint={lowStockCount > 0 ? "Need reordering" : "All stocked"}
            icon={AlertTriangle}
            label="Low-Stock Items"
            value={lowStockCount}
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
