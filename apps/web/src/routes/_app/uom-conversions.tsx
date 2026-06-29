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
import { ArrowRightLeft, RefreshCw, Search } from "lucide-react";
import { useState } from "react";

import { EmptyState, ErrorState } from "@/components/states";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/uom-conversions")({
  component: UomConversionsScreen,
});

type CatalogClient = AppRouterClient["catalog"];
type ConversionRow = Awaited<
  ReturnType<CatalogClient["uomConversionCatalogList"]>
>[number];

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;
const ROLE_LABELS: Record<string, string> = {
  purchase: "Purchase",
  reporting: "Reporting",
  sale: "Sale",
  stock: "Stock",
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
        placeholder="Search conversions"
        value={value}
      />
    </div>
  );
}

function ScopeLabel({ row }: { row: ConversionRow }) {
  if (row.skuId) {
    return (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.skuName ?? row.skuCode}</p>
        <p className="font-mono text-muted-foreground text-xs">{row.skuCode}</p>
      </div>
    );
  }

  if (row.productId) {
    return (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.productName}</p>
        <p className="font-mono text-muted-foreground text-xs">
          {row.productSku}
        </p>
      </div>
    );
  }

  if (row.categoryId) {
    return (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.categoryName}</p>
        <p className="font-mono text-muted-foreground text-xs">
          {row.categoryCode}
        </p>
      </div>
    );
  }

  return <span className="text-muted-foreground text-sm">Global</span>;
}

function UnitLabel({ code, name }: { code: string; name: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-sm">{code}</p>
      <p className="truncate text-muted-foreground text-xs">{name}</p>
    </div>
  );
}

function UomConversionsTable({ rows }: { rows: ConversionRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Role</TableHead>
          <TableHead className="min-w-[220px]">Scope</TableHead>
          <TableHead>From</TableHead>
          <TableHead>To</TableHead>
          <TableHead className="text-right">Factor</TableHead>
          <TableHead className="text-right">Scale</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Badge variant="secondary">
                {ROLE_LABELS[row.role] ?? row.role}
              </Badge>
            </TableCell>
            <TableCell>
              <ScopeLabel row={row} />
            </TableCell>
            <TableCell>
              <UnitLabel code={row.fromUomCode} name={row.fromUomName} />
            </TableCell>
            <TableCell>
              <UnitLabel code={row.toUomCode} name={row.toUomName} />
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {row.factor}
            </TableCell>
            <TableCell className="text-right font-mono text-muted-foreground text-sm tabular-nums">
              {row.factorScale}
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

function UomConversionsContent({
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
  rows: ConversionRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load UoM conversions."}
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
        description="Purchase, stock, sale, and reporting unit conversions will appear here."
        icon={ArrowRightLeft}
        title="No conversions found"
      />
    );
  }

  return <UomConversionsTable rows={rows} />;
}

function UomConversionsScreen() {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const conversions = useQuery(
    orpc.catalog.uomConversionCatalogList.queryOptions({
      input: trimmedQuery ? { q: trimmedQuery } : {},
    })
  );
  const rows = conversions.data ?? [];
  const settled = !(conversions.isLoading || conversions.isError);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">
          UoM conversions
        </h1>
        <p className="text-muted-foreground">
          Unit conversion rules joined to their product, SKU, category, and unit
          names.
        </p>
      </div>

      <DataTableCard
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <SearchBox onChange={setQuery} value={query} />
            <Button
              aria-label="Refresh UoM conversions"
              onClick={() => conversions.refetch()}
              size="icon"
              type="button"
              variant="outline"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        }
        count={settled ? rows.length : undefined}
        title="Unit conversion registry"
      >
        <UomConversionsContent
          errorMessage={conversions.error?.message}
          isError={conversions.isError}
          isLoading={conversions.isLoading}
          onRetry={() => conversions.refetch()}
          rows={rows}
        />
      </DataTableCard>
    </div>
  );
}
