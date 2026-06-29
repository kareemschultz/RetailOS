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
import { Layers, RefreshCw, Search } from "lucide-react";
import { useState } from "react";

import { EmptyState, ErrorState } from "@/components/states";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/lots")({
  component: LotsScreen,
});

type InventoryClient = AppRouterClient["inventory"];
type LotRow = Awaited<ReturnType<InventoryClient["lotCatalogList"]>>[number];

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;
const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  depleted: "Depleted",
  expired: "Expired",
  quarantined: "Quarantined",
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
        placeholder="Search lots"
        value={value}
      />
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }
  return new Date(value).toLocaleDateString();
}

function LotsTable({ rows }: { rows: LotRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[220px]">Lot</TableHead>
          <TableHead className="min-w-[240px]">Product</TableHead>
          <TableHead className="min-w-[220px]">SKU</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Expiry</TableHead>
          <TableHead>Manufactured</TableHead>
          <TableHead className="text-right">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <span className="font-mono text-sm">{row.lotNumber}</span>
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
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {row.skuName ?? row.skuCode}
                </p>
                <p className="font-mono text-muted-foreground text-xs">
                  {row.skuCode}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant={row.status === "available" ? "secondary" : "outline"}
              >
                {STATUS_LABELS[row.status] ?? row.status}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm tabular-nums">
              {formatDate(row.expiryDate)}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm tabular-nums">
              {formatDate(row.manufacturedDate)}
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

function LotsContent({
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
  rows: LotRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load lots."}
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
        description="Batch, lot, and expiry-controlled stock will appear here after receiving."
        icon={Layers}
        title="No lots found"
      />
    );
  }

  return <LotsTable rows={rows} />;
}

function LotsScreen() {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const lots = useQuery(
    orpc.inventory.lotCatalogList.queryOptions({
      input: trimmedQuery ? { q: trimmedQuery } : {},
    })
  );
  const rows = lots.data ?? [];
  const settled = !(lots.isLoading || lots.isError);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Lots</h1>
        <p className="text-muted-foreground">
          Batch and expiry records joined to their product and SKU names.
        </p>
      </div>

      <DataTableCard
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <SearchBox onChange={setQuery} value={query} />
            <Button
              aria-label="Refresh lots"
              onClick={() => lots.refetch()}
              size="icon"
              type="button"
              variant="outline"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        }
        count={settled ? rows.length : undefined}
        title="Lot registry"
      >
        <LotsContent
          errorMessage={lots.error?.message}
          isError={lots.isError}
          isLoading={lots.isLoading}
          onRetry={() => lots.refetch()}
          rows={rows}
        />
      </DataTableCard>
    </div>
  );
}
