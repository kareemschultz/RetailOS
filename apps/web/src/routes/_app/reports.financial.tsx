import { Card, CardContent } from "@RetailOS/ui/components/card";
import { DataTableCard } from "@RetailOS/ui/components/data-table-card";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
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
import { useMemo } from "react";

import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/reports/financial")({
  component: FinancialOverviewScreen,
});

const KPI_SKELETON_KEYS = ["a", "b", "c", "d"] as const;
const ROW_SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;

// A normalized valuation row for display. All figures are backend-computed —
// the page never sums or values anything; it combines the two backend arrays
// (AVCO + FIFO) into display rows and renders each field as-is.
interface ValuationRow {
  currency: string;
  key: string;
  locationId: string;
  method: "AVCO" | "FIFO";
  qtyOnHand: number;
  scale: number;
  skuId: string;
  totalValueMinor: number;
}

interface LowStockRow {
  key: string;
  locationId: string;
  minQty: number;
  onHand: number;
  skuId: string;
  suggestedQty: number;
}

// Display shape of the dashboardSummary DTO. Typing the prop with this makes the
// (structural) assignment fail check-types if the endpoint drops/renames a field
// this page renders — drift safety without re-declaring the whole endpoint type.
interface SummaryData {
  inventoryValue: {
    currency: string;
    scale: number;
    totalValueMinor: number;
  } | null;
  lowStockCount: number;
  sales: { currency: string; scale: number; totalMinor: number } | null;
  transactionCount: number;
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

// Shared empty/loading/error states for the table cards (mirrors the catalog
// CatalogContent pattern). `colSpan` keeps the message centered across columns.
function TableStateMessage({
  icon: Icon,
  title,
  detail,
  tone = "muted",
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  tone?: "muted" | "destructive";
}) {
  const isDestructive = tone === "destructive";
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div
        className={
          isDestructive
            ? "flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive"
            : "flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"
        }
      >
        <Icon className="size-5" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground text-sm">{detail}</p>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-px">
      {ROW_SKELETON_KEYS.map((k) => (
        <Skeleton className="h-[60px] rounded-none" key={k} />
      ))}
    </div>
  );
}

function ShortId({ value }: { value: string }) {
  return (
    <span className="font-mono text-muted-foreground text-xs" title={value}>
      {value.slice(0, 8)}
    </span>
  );
}

function ValuationContent({
  isLoading,
  isError,
  errorMessage,
  rows,
}: {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  rows: ValuationRow[];
}) {
  if (isError) {
    return (
      <TableStateMessage
        detail={
          errorMessage ?? "Check your connection or permissions and retry."
        }
        icon={TriangleAlert}
        title="Couldn’t load valuation"
        tone="destructive"
      />
    );
  }

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (rows.length === 0) {
    return (
      <TableStateMessage
        detail="Receive stock to build an inventory valuation."
        icon={Package}
        title="No valued stock yet"
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Method</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead>Location</TableHead>
          <TableHead className="text-right">Qty on hand</TableHead>
          <TableHead className="text-right">Total value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell>
              <span className="font-medium text-xs">{row.method}</span>
            </TableCell>
            <TableCell>
              <ShortId value={row.skuId} />
            </TableCell>
            <TableCell>
              <ShortId value={row.locationId} />
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {row.qtyOnHand}
            </TableCell>
            <TableCell className="text-right font-medium font-mono tabular-nums">
              {formatMoney(row.totalValueMinor, row.currency, row.scale)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LowStockContent({
  isLoading,
  isError,
  errorMessage,
  rows,
}: {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  rows: LowStockRow[];
}) {
  if (isError) {
    return (
      <TableStateMessage
        detail={
          errorMessage ?? "Check your connection or permissions and retry."
        }
        icon={TriangleAlert}
        title="Couldn’t load low stock"
        tone="destructive"
      />
    );
  }

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (rows.length === 0) {
    return (
      <TableStateMessage
        detail="Everything is above its reorder point."
        icon={Package}
        title="Nothing to reorder"
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>SKU</TableHead>
          <TableHead>Location</TableHead>
          <TableHead className="text-right">On hand</TableHead>
          <TableHead className="text-right">Min</TableHead>
          <TableHead className="text-right">Suggested reorder</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell>
              <ShortId value={row.skuId} />
            </TableCell>
            <TableCell>
              <ShortId value={row.locationId} />
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {row.onHand}
            </TableCell>
            <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
              {row.minQty}
            </TableCell>
            <TableCell className="text-right font-medium font-mono tabular-nums">
              {row.suggestedQty}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function FinancialKpis({ summary }: { summary: UseQueryResult<SummaryData> }) {
  if (summary.isError) {
    return (
      <Card className="border-destructive/30 shadow-sm">
        <CardContent className="flex items-center gap-3 p-5 text-sm">
          <TriangleAlert className="size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Couldn’t load financial summary</p>
            <p className="text-muted-foreground">
              {summary.error.message}. Check your connection or permissions and
              retry.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (summary.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_SKELETON_KEYS.map((k) => (
          <Skeleton className="h-28 rounded-2xl" key={k} />
        ))}
      </div>
    );
  }

  const data = summary.data;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        hint={data?.sales ? "Completed sales" : "No sales yet"}
        icon={Wallet}
        label="Total sales"
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
        label="Inventory value"
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
        label="Low-stock items"
        value={data?.lowStockCount ?? 0}
      />
    </div>
  );
}

function FinancialOverviewScreen() {
  // Every figure on this page is computed by the backend. The client only picks
  // a query, renders the returned DTO fields, and uses formatMoney for display —
  // no summing, no margin, no tax, no FX on the client (backend owns the math).
  const summary = useQuery(
    orpc.reports.dashboardSummary.queryOptions({ input: {} })
  );
  const valuation = useQuery(
    orpc.reports.valuation.queryOptions({ input: {} })
  );
  const lowStock = useQuery(orpc.reports.lowStock.queryOptions({ input: {} }));

  // Combine the backend's AVCO + FIFO arrays into uniform display rows. The raw
  // FIFO/low-stock rows come from a raw SQL result, so their id/currency fields
  // are typed `unknown` — coerce to string for rendering only (no computation).
  const valuationRows = useMemo<ValuationRow[]>(() => {
    const v = valuation.data;
    if (!v) {
      return [];
    }
    const avco: ValuationRow[] = v.avco.map((row) => ({
      key: `AVCO:${row.skuId}:${row.locationId}:${row.currency}`,
      method: "AVCO",
      skuId: String(row.skuId),
      locationId: String(row.locationId),
      currency: String(row.currency),
      scale: row.scale,
      qtyOnHand: row.qtyOnHand,
      totalValueMinor: row.totalValueMinor,
    }));
    const fifo: ValuationRow[] = v.fifo.map((row) => ({
      key: `FIFO:${String(row.skuId)}:${String(row.locationId)}:${String(row.currency)}`,
      method: "FIFO",
      skuId: String(row.skuId),
      locationId: String(row.locationId),
      currency: String(row.currency),
      scale: row.scale,
      qtyOnHand: row.qtyOnHand,
      totalValueMinor: row.totalValueMinor,
    }));
    return [...avco, ...fifo];
  }, [valuation.data]);

  const lowStockRows = useMemo<LowStockRow[]>(
    () =>
      (lowStock.data ?? []).map((row, index) => ({
        key: `${String(row.skuId)}:${String(row.locationId)}:${index}`,
        skuId: String(row.skuId),
        locationId: String(row.locationId),
        onHand: row.onHand,
        minQty: row.minQty,
        suggestedQty: row.suggestedQty,
      })),
    [lowStock.data]
  );

  const valuationSettled = !(valuation.isLoading || valuation.isError);
  const lowStockSettled = !(lowStock.isLoading || lowStock.isError);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">
          Financial overview
        </h1>
        <p className="text-muted-foreground">
          Revenue, cost of goods, and inventory value — computed by the backend.
        </p>
      </div>

      <FinancialKpis summary={summary} />

      <DataTableCard
        count={valuationSettled ? valuationRows.length : undefined}
        footer={
          valuationSettled && valuationRows.length > 0
            ? "On-hand quantity and value per SKU and location, by costing method."
            : undefined
        }
        title="Inventory valuation"
      >
        <ValuationContent
          errorMessage={valuation.error?.message}
          isError={valuation.isError}
          isLoading={valuation.isLoading}
          rows={valuationRows}
        />
      </DataTableCard>

      <DataTableCard
        count={lowStockSettled ? lowStockRows.length : undefined}
        footer={
          lowStockSettled && lowStockRows.length > 0
            ? "Items below their reorder point, with a suggested reorder quantity."
            : undefined
        }
        title="Low stock"
      >
        <LowStockContent
          errorMessage={lowStock.error?.message}
          isError={lowStock.isError}
          isLoading={lowStock.isLoading}
          rows={lowStockRows}
        />
      </DataTableCard>
    </div>
  );
}
