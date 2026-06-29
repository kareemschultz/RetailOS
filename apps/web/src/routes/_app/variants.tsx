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
import { RefreshCw, Search, Tags } from "lucide-react";
import { useState } from "react";

import { EmptyState, ErrorState } from "@/components/states";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/variants")({
  component: VariantsScreen,
});

type CatalogClient = AppRouterClient["catalog"];
type VariantRow = Awaited<
  ReturnType<CatalogClient["variantCatalogList"]>
>[number];

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;

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
        placeholder="Search variants"
        value={value}
      />
    </div>
  );
}

function VariantsTable({ rows }: { rows: VariantRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[220px]">Option</TableHead>
          <TableHead className="min-w-[220px]">Product</TableHead>
          <TableHead>Value</TableHead>
          <TableHead className="text-right">Sort</TableHead>
          <TableHead className="text-right">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Badge variant="secondary">{row.name}</Badge>
            </TableCell>
            <TableCell>
              <div className="min-w-0">
                <p className="truncate font-medium">{row.productName}</p>
                <p className="font-mono text-muted-foreground text-xs">
                  {row.productSku}
                </p>
              </div>
            </TableCell>
            <TableCell className="font-medium">{row.value}</TableCell>
            <TableCell className="text-right font-mono text-muted-foreground text-sm tabular-nums">
              {row.sortOrder}
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

function VariantsContent({
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
  rows: VariantRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load catalog variants."}
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
        description="Product options such as size, pack, color, or material will appear here."
        icon={Tags}
        title="No variants found"
      />
    );
  }

  return <VariantsTable rows={rows} />;
}

function VariantsScreen() {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const variants = useQuery(
    orpc.catalog.variantCatalogList.queryOptions({
      input: trimmedQuery ? { q: trimmedQuery } : {},
    })
  );
  const rows = variants.data ?? [];
  const settled = !(variants.isLoading || variants.isError);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Variants</h1>
        <p className="text-muted-foreground">
          Product option values joined to their catalog products.
        </p>
      </div>

      <DataTableCard
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <SearchBox onChange={setQuery} value={query} />
            <Button
              aria-label="Refresh variants"
              onClick={() => variants.refetch()}
              size="icon"
              type="button"
              variant="outline"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        }
        count={settled ? rows.length : undefined}
        title="Variant registry"
      >
        <VariantsContent
          errorMessage={variants.error?.message}
          isError={variants.isError}
          isLoading={variants.isLoading}
          onRetry={() => variants.refetch()}
          rows={rows}
        />
      </DataTableCard>
    </div>
  );
}
