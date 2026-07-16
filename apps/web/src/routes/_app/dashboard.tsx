import type { AppRouterClient } from "@RetailOS/api/routers/index";
import { Badge } from "@RetailOS/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import {
  PageBody,
  PageHeader,
  PageMetrics,
} from "@RetailOS/ui/components/page-header";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import { StatCard } from "@RetailOS/ui/components/stat-card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ImageIcon,
  Package,
  Receipt,
  ReceiptText,
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
const RECENT_SALES_LIMIT = 8;

type PosClient = AppRouterClient["pos"];
type RecentSaleRow = Awaited<ReturnType<PosClient["saleSearch"]>>[number];

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

function RecentSales({
  isError,
  isLoading,
  sales,
}: {
  isError: boolean;
  isLoading: boolean;
  sales: RecentSaleRow[];
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {SKELETON_KEYS.slice(0, 3).map((key) => (
          <Skeleton className="h-12 rounded-lg" key={key} />
        ))}
      </div>
    );
  }

  if (isError) {
    // A back-office role without POS access simply doesn't get this panel's
    // data — degrade quietly rather than surfacing a permission error.
    return (
      <p className="py-8 text-center text-muted-foreground text-sm">
        Sales history needs point-of-sale access.
      </p>
    );
  }

  if (sales.length === 0) {
    return (
      <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center">
        <ReceiptText className="size-5 text-muted-foreground" />
        <p className="font-medium text-sm">No sales in the last 30 days</p>
        <p className="text-muted-foreground text-xs">
          Sales rung up at the register or placed online will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y">
      {sales.map((sale) => (
        <div className="flex items-center gap-3 py-2.5" key={sale.id}>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium font-mono text-xs">
              {sale.number}
            </p>
            <p className="text-muted-foreground text-xs">
              {new Date(sale.createdAt).toLocaleString()}
            </p>
          </div>
          {sale.status === "void" ? (
            <Badge variant="secondary">Voided</Badge>
          ) : null}
          {sale.saleType === "return" ? (
            <Badge variant="outline">Return</Badge>
          ) : null}
          <p className="font-medium font-mono text-sm tabular-nums">
            {formatMoney(sale.totalMinor, sale.currency, sale.scale)}
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
  const recentSales = useQuery(
    orpc.pos.saleSearch.queryOptions({
      input: { limit: RECENT_SALES_LIMIT },
    })
  );

  const data = summary.data;
  const productPreview = (catalog.data ?? []).slice(0, PRODUCT_PREVIEW_LIMIT);

  return (
    <PageBody className="mx-auto w-full max-w-7xl p-6">
      <PageHeader
        description="A live snapshot of sales and inventory across your stores."
        title="Dashboard"
      />

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
        <PageMetrics>
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
        </PageMetrics>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <CardTitle>Recent sales</CardTitle>
            <Link
              className="font-medium text-primary text-sm hover:underline"
              to="/sales"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <RecentSales
              isError={recentSales.isError}
              isLoading={recentSales.isLoading}
              sales={recentSales.data ?? []}
            />
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <CardTitle>Catalog spotlight</CardTitle>
            <Link
              className="font-medium text-primary text-sm hover:underline"
              to="/products"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <CatalogPreview
              isLoading={catalog.isLoading}
              products={productPreview}
            />
          </CardContent>
        </Card>
      </div>
    </PageBody>
  );
}
