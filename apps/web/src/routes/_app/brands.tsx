import type { AppRouterClient } from "@RetailOS/api/routers/index";
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
import { BadgeCheck, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, ErrorState } from "@/components/states";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/brands")({
  component: BrandsScreen,
});

type CatalogClient = AppRouterClient["catalog"];
type BrandRow = Awaited<ReturnType<CatalogClient["brandList"]>>[number];

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;

function SearchBox({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-9 rounded-lg pl-9"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search brands"
        value={value}
      />
    </div>
  );
}

function BrandsTable({ rows }: { rows: BrandRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[260px]">Brand</TableHead>
          <TableHead>Code</TableHead>
          <TableHead className="text-right">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="min-w-0">
                <p className="truncate font-medium">{row.name}</p>
                <p className="text-muted-foreground text-xs">
                  Shared catalog brand
                </p>
              </div>
            </TableCell>
            <TableCell>
              <span className="font-mono text-muted-foreground text-xs">
                {row.code ?? "-"}
              </span>
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

function BrandsContent({
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
  rows: BrandRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load catalog brands."}
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-px">
        {SKELETON_KEYS.map((key) => (
          <Skeleton className="h-[60px] rounded-none" key={key} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        description="Brands created in the catalog will appear here."
        icon={BadgeCheck}
        title="No brands found"
      />
    );
  }

  return <BrandsTable rows={rows} />;
}

function BrandsScreen() {
  const [query, setQuery] = useState("");
  const brands = useQuery(orpc.catalog.brandList.queryOptions({ input: {} }));
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const data = brands.data ?? [];
    if (!q) {
      return data;
    }
    return data.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        (row.code?.toLowerCase().includes(q) ?? false)
    );
  }, [brands.data, query]);
  const settled = !(brands.isLoading || brands.isError);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Brands</h1>
        <p className="text-muted-foreground">
          Shared brand records used by the product catalog.
        </p>
      </div>

      <DataTableCard
        actions={<SearchBox onChange={setQuery} value={query} />}
        count={settled ? rows.length : undefined}
        title="Brand catalog"
      >
        <BrandsContent
          errorMessage={brands.error?.message}
          isError={brands.isError}
          isLoading={brands.isLoading}
          onRetry={() => brands.refetch()}
          rows={rows}
        />
      </DataTableCard>
    </div>
  );
}
