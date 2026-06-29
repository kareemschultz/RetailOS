import type { AppRouterClient } from "@RetailOS/api/routers/index";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { DataTableCard } from "@RetailOS/ui/components/data-table-card";
import { Input } from "@RetailOS/ui/components/input";
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
import { Barcode, RefreshCw, Search } from "lucide-react";
import { useState } from "react";

import { EmptyState, ErrorState } from "@/components/states";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/skus")({
  component: SkusScreen,
});

type CatalogClient = AppRouterClient["catalog"];
type SkuRow = Awaited<ReturnType<CatalogClient["skuCatalogList"]>>[number];

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;
const TRACKING_LABELS: Record<string, string> = {
  expiry: "Expiry",
  lot: "Lot",
  mixed: "Mixed",
  none: "None",
  serial: "Serial",
};
const COSTING_LABELS: Record<string, string> = {
  avco: "AVCO",
  fifo: "FIFO",
};

function SearchBox({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-9 rounded-lg pl-9"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search SKUs"
        value={value}
      />
    </div>
  );
}

function SkusTable({ rows }: { rows: SkuRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[260px]">SKU</TableHead>
          <TableHead className="min-w-[220px]">Product</TableHead>
          <TableHead>Tracking</TableHead>
          <TableHead>Costing</TableHead>
          <TableHead>Base unit</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="min-w-0">
                <p className="truncate font-medium">{row.name ?? row.code}</p>
                <p className="font-mono text-muted-foreground text-xs">
                  {row.code}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <div className="min-w-0">
                <p className="truncate font-medium">{row.productName}</p>
                <p className="font-mono text-muted-foreground text-xs">
                  {row.productSku}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">
                {TRACKING_LABELS[row.trackingMode] ?? row.trackingMode}
              </Badge>
            </TableCell>
            <TableCell>
              {row.costingMethod ? (
                <Badge variant="outline">
                  {COSTING_LABELS[row.costingMethod] ?? row.costingMethod}
                </Badge>
              ) : (
                <span className="text-muted-foreground text-sm">Inherited</span>
              )}
            </TableCell>
            <TableCell>
              {row.baseUomCode ? (
                <span className="font-mono text-muted-foreground text-xs">
                  {row.baseUomCode}
                </span>
              ) : (
                <span className="text-muted-foreground text-sm">Inherited</span>
              )}
            </TableCell>
            <TableCell>
              <Badge variant={row.isActive ? "secondary" : "destructive"}>
                {row.isActive ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
            <TableCell className="text-right text-muted-foreground text-sm tabular-nums">
              {new Date(row.createdAt).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SkusContent({
  errorMessage,
  isError,
  isLoading,
  onRetry,
  rows,
}: {
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  rows: SkuRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load catalog SKUs."}
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-px">
        {SKELETON_KEYS.map((key) => (
          <Skeleton className="h-[64px] rounded-none" key={key} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        description="Product SKUs created in the catalog will appear here."
        icon={Barcode}
        title="No SKUs found"
      />
    );
  }

  return <SkusTable rows={rows} />;
}

function SkusScreen() {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const skus = useQuery(
    orpc.catalog.skuCatalogList.queryOptions({
      input: trimmedQuery ? { q: trimmedQuery } : {},
    })
  );
  const rows = skus.data ?? [];
  const settled = !(skus.isLoading || skus.isError);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">SKUs</h1>
        <p className="text-muted-foreground">
          Sellable and stockable SKU records joined to their catalog products.
        </p>
      </div>

      <DataTableCard
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <SearchBox onChange={setQuery} value={query} />
            <Button
              aria-label="Refresh SKUs"
              onClick={() => skus.refetch()}
              size="icon"
              type="button"
              variant="outline"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        }
        count={settled ? rows.length : undefined}
        title="SKU catalog"
      >
        <SkusContent
          errorMessage={skus.error?.message}
          isError={skus.isError}
          isLoading={skus.isLoading}
          onRetry={() => skus.refetch()}
          rows={rows}
        />
      </DataTableCard>
    </div>
  );
}
