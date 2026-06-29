import type { AppRouterClient } from "@RetailOS/api/routers/index";
import { Badge } from "@RetailOS/ui/components/badge";
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
import { Ruler, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, ErrorState } from "@/components/states";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/units")({
  component: UnitsScreen,
});

type CatalogClient = AppRouterClient["catalog"];
type UnitRow = Awaited<ReturnType<CatalogClient["uomList"]>>[number];

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;
const KIND_LABELS: Record<string, string> = {
  count: "Count",
  length: "Length",
  volume: "Volume",
  weight: "Weight",
};

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
        placeholder="Search units"
        value={value}
      />
    </div>
  );
}

function UnitsTable({ rows }: { rows: UnitRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[260px]">Unit</TableHead>
          <TableHead>Code</TableHead>
          <TableHead>Kind</TableHead>
          <TableHead className="text-right">Scale</TableHead>
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
                  Inventory normalizes quantities to base units.
                </p>
              </div>
            </TableCell>
            <TableCell>
              <span className="font-mono text-muted-foreground text-xs">
                {row.code}
              </span>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">
                {KIND_LABELS[row.kind] ?? row.kind}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {row.decimalScale}
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

function UnitsContent({
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
  rows: UnitRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load units of measure."}
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
        description="Units created in the catalog will appear here."
        icon={Ruler}
        title="No units found"
      />
    );
  }

  return <UnitsTable rows={rows} />;
}

function UnitsScreen() {
  const [query, setQuery] = useState("");
  const units = useQuery(orpc.catalog.uomList.queryOptions({ input: {} }));
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const data = units.data ?? [];
    if (!q) {
      return data;
    }
    return data.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q) ||
        row.kind.toLowerCase().includes(q)
    );
  }, [units.data, query]);
  const settled = !(units.isLoading || units.isError);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Units</h1>
        <p className="text-muted-foreground">
          Units of measure used by products, SKUs, purchasing, and stock.
        </p>
      </div>

      <DataTableCard
        actions={<SearchBox onChange={setQuery} value={query} />}
        count={settled ? rows.length : undefined}
        title="Units of measure"
      >
        <UnitsContent
          errorMessage={units.error?.message}
          isError={units.isError}
          isLoading={units.isLoading}
          onRetry={() => units.refetch()}
          rows={rows}
        />
      </DataTableCard>
    </div>
  );
}
