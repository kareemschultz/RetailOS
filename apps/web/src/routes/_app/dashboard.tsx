import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import { StatCard } from "@RetailOS/ui/components/stat-card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ImageIcon,
  Package,
  Receipt,
  TriangleAlert,
  Wallet,
} from "lucide-react";

import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardScreen,
});

const SKELETON_KEYS = ["a", "b", "c", "d"] as const;
const PRODUCT_PREVIEW_LIMIT = 5;

interface CatalogPreviewRow {
  currency: string;
  id: string;
  name: string;
  priceMinor: number;
  primaryImageAltText: string | null;
  primaryImageUrl: string | null;
  scale: number;
  sku: string;
}

// KPI cards now use the owned `StatCard` (adapted from the AdminCN
// statistics-card pattern, re-themed to RetailOS tokens — Assembly Law).

function ProductPreviewThumb({ product }: { product: CatalogPreviewRow }) {
  if (product.primaryImageUrl) {
    return (
      <img
        alt={product.primaryImageAltText ?? product.name}
        className="size-10 rounded-lg border object-cover"
        height={40}
        src={product.primaryImageUrl}
        width={40}
      />
    );
  }

  return (
    <div className="flex size-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
      <ImageIcon className="size-4" />
    </div>
  );
}

function CatalogPreview({
  isLoading,
  products,
}: {
  isLoading: boolean;
  products: CatalogPreviewRow[];
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {SKELETON_KEYS.slice(0, 3).map((key) => (
          <Skeleton className="h-14 rounded-lg" key={key} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center">
        <Package className="size-5 text-muted-foreground" />
        <p className="font-medium text-sm">No catalog items yet</p>
        <p className="text-muted-foreground text-xs">
          Products created in the catalog will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y">
      {products.map((product) => (
        <div className="flex items-center gap-3 py-3" key={product.id}>
          <ProductPreviewThumb product={product} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm">{product.name}</p>
            <p className="font-mono text-muted-foreground text-xs">
              {product.sku}
            </p>
          </div>
          <p className="font-medium font-mono text-sm">
            {formatMoney(product.priceMinor, product.currency, product.scale)}
          </p>
        </div>
      ))}
    </div>
  );
}

function DashboardScreen() {
  // All KPI aggregation is server-side (reports.dashboardSummary). The client
  // only renders the returned figures — no money arithmetic in the browser.
  const summary = useQuery(
    orpc.reports.dashboardSummary.queryOptions({ input: {} })
  );
  const catalog = useQuery(orpc.product.catalog.queryOptions({ input: {} }));

  const data = summary.data;
  const productPreview = (catalog.data ?? []).slice(0, PRODUCT_PREVIEW_LIMIT);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
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
          <StatCard
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
          <StatCard
            hint="All time"
            icon={Receipt}
            label="Transactions"
            value={data?.transactionCount ?? 0}
          />
          <StatCard
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
          <StatCard
            hint={
              (data?.lowStockCount ?? 0) > 0 ? "Need reordering" : "All stocked"
            }
            icon={AlertTriangle}
            label="Low-Stock Items"
            value={data?.lowStockCount ?? 0}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h2 className="font-semibold text-lg tracking-tight">
              Welcome to RetailOS
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Ring up a sale from{" "}
              <span className="font-medium">Point of Sale</span>, or browse your
              catalog under <span className="font-medium">Products</span>. More
              dashboards (cashier, inventory, accounting) arrive as those
              modules ship.
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="border-b">
            <CardTitle>Catalog spotlight</CardTitle>
          </CardHeader>
          <CardContent>
            <CatalogPreview
              isLoading={catalog.isLoading}
              products={productPreview}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
