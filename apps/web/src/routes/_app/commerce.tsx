import type { AppRouterClient } from "@RetailOS/api/routers/index";
import { Badge } from "@RetailOS/ui/components/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import { DataTableCard } from "@RetailOS/ui/components/data-table-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@RetailOS/ui/components/dialog";
import { Input } from "@RetailOS/ui/components/input";
import { PageBody, PageHeader } from "@RetailOS/ui/components/page-header";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PackageSearch, Search, Store } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { EmptyState, ErrorState } from "@/components/states";
import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/commerce")({
  component: CommerceScreen,
});

type CommerceAdminClient = AppRouterClient["commerceAdmin"];
type OrderRow = Awaited<ReturnType<CommerceAdminClient["orderList"]>>[number];
type OrderDetail = Awaited<ReturnType<CommerceAdminClient["orderDetail"]>>;

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;

const ORDER_STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  cancelled: "destructive",
  completed: "default",
  fulfilled: "default",
  fulfilling: "secondary",
  paid: "default",
  payment_pending: "outline",
  unavailable: "destructive",
};

function statusLabel(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(value: Date | string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

function OrdersTable({
  onSelect,
  rows,
}: {
  onSelect: (id: string) => void;
  rows: OrderRow[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Fulfilment</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Placed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            className="cursor-pointer"
            key={row.id}
            onClick={() => onSelect(row.id)}
          >
            <TableCell className="font-medium font-mono text-xs">
              {row.number ?? "(unpaid)"}
            </TableCell>
            <TableCell>
              <Badge variant={ORDER_STATUS_VARIANTS[row.status] ?? "outline"}>
                {statusLabel(row.status)}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {statusLabel(row.fulfilmentType)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatMoney(row.totalMinor, row.currency, row.scale)}
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {formatDate(row.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OrderDetailBody({
  detail,
  isError,
  isLoading,
}: {
  detail: OrderDetail | undefined;
  isError: boolean;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }
  if (isError || !detail) {
    return <ErrorState message="Could not load order detail." />;
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-muted-foreground text-sm">
          {detail.locationName}
        </span>
        <Badge variant={ORDER_STATUS_VARIANTS[detail.status] ?? "outline"}>
          {statusLabel(detail.status)}
        </Badge>
        <Badge variant="outline">{statusLabel(detail.fulfilmentType)}</Badge>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">Line total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="text-sm">
                  {line.productName} · {line.skuCode}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {line.qty}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatMoney(
                    line.unitPriceMinor,
                    detail.currency,
                    detail.scale
                  )}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatMoney(
                    line.lineSubtotalMinor + line.lineTaxMinor,
                    detail.currency,
                    detail.scale
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end font-medium text-sm">
        Total: {formatMoney(detail.totalMinor, detail.currency, detail.scale)}
      </div>
    </div>
  );
}

function OrdersContent({
  errorMessage,
  isError,
  isLoading,
  onRetry,
  onSelect,
  rows,
}: {
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  onSelect: (id: string) => void;
  rows: OrderRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load orders."}
          onRetry={onRetry}
        />
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex flex-col gap-px">
        {SKELETON_KEYS.map((key) => (
          <Skeleton className="h-[52px] rounded-none" key={key} />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        description="Orders placed through the Shopix storefront checkout appear here once confirmed."
        icon={PackageSearch}
        title="No online orders yet"
      />
    );
  }
  return <OrdersTable onSelect={onSelect} rows={rows} />;
}

function OrdersPanel() {
  const searchFieldId = useId();
  const [queryText, setQueryText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const trimmedQuery = queryText.trim();

  const searchInput = useMemo(
    () => ({ q: trimmedQuery || undefined }),
    [trimmedQuery]
  );
  const orders = useQuery(
    orpc.commerceAdmin.orderList.queryOptions({ input: searchInput })
  );
  const detail = useQuery(
    orpc.commerceAdmin.orderDetail.queryOptions({
      enabled: selectedId != null,
      input: { orderId: selectedId ?? "" },
    })
  );

  const rows = orders.data ?? [];
  const settled = !(orders.isLoading || orders.isError);

  return (
    <>
      <DataTableCard
        actions={
          <div className="relative w-64">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              id={searchFieldId}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="Search order number"
              value={queryText}
            />
          </div>
        }
        count={settled ? rows.length : undefined}
        title="Online orders"
      >
        <OrdersContent
          errorMessage={orders.error?.message}
          isError={orders.isError}
          isLoading={orders.isLoading}
          onRetry={() => orders.refetch()}
          onSelect={setSelectedId}
          rows={rows}
        />
      </DataTableCard>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
          }
        }}
        open={selectedId != null}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order detail</DialogTitle>
            <DialogDescription>
              Lines, fulfilment, and total for this Shopix order.
            </DialogDescription>
          </DialogHeader>
          <OrderDetailBody
            detail={detail.data}
            isError={detail.isError}
            isLoading={detail.isLoading}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function CommerceScreen() {
  return (
    <PageBody className="mx-auto w-full max-w-7xl p-6">
      <PageHeader
        description="Shopix — the customer-facing storefront that shares this tenant's catalog, pricing, tax, and inventory ledger."
        title={
          <span className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Store className="size-5" />
            </span>
            Commerce
          </span>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Storefront status</CardTitle>
          <CardDescription>
            The storefront backend (hostname gateway, public catalog/PDP, real
            tax quotes, cart, checkout, and payment confirmation) is built and
            live — orders placed there show up below. The public-facing
            storefront web UI itself (product browsing, cart, checkout pages)
            has not been built yet; customers cannot shop until it exists.
          </CardDescription>
        </CardHeader>
      </Card>

      <OrdersPanel />
    </PageBody>
  );
}
