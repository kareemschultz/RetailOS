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

export const Route = createFileRoute("/_app/barcodes")({
  component: BarcodesScreen,
});

type CatalogClient = AppRouterClient["catalog"];
type BarcodeRow = Awaited<
  ReturnType<CatalogClient["barcodeCatalogList"]>
>[number];

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;
const SYMBOLOGY_LABELS: Record<string, string> = {
  code128: "Code 128",
  ean13: "EAN-13",
  ean8: "EAN-8",
  gs1: "GS1",
  qr: "QR",
  upca: "UPC-A",
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
        placeholder="Search barcodes"
        value={value}
      />
    </div>
  );
}

function BarcodesTable({ rows }: { rows: BarcodeRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[260px]">Barcode</TableHead>
          <TableHead>Symbology</TableHead>
          <TableHead className="min-w-[220px]">SKU</TableHead>
          <TableHead className="min-w-[220px]">Product</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <span className="font-mono text-sm tabular-nums">
                {row.value}
              </span>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">
                {SYMBOLOGY_LABELS[row.symbology] ?? row.symbology}
              </Badge>
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
              <div className="min-w-0">
                <p className="truncate font-medium">{row.productName}</p>
                <p className="font-mono text-muted-foreground text-xs">
                  {row.productSku}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={row.isPrimary ? "default" : "outline"}>
                {row.isPrimary ? "Primary" : "Alternate"}
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

function BarcodesContent({
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
  rows: BarcodeRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load catalog barcodes."}
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
        description="Barcode assignments created in the catalog will appear here."
        icon={Barcode}
        title="No barcodes found"
      />
    );
  }

  return <BarcodesTable rows={rows} />;
}

function BarcodesScreen() {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const barcodes = useQuery(
    orpc.catalog.barcodeCatalogList.queryOptions({
      input: trimmedQuery ? { q: trimmedQuery } : {},
    })
  );
  const rows = barcodes.data ?? [];
  const settled = !(barcodes.isLoading || barcodes.isError);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Barcodes</h1>
        <p className="text-muted-foreground">
          Scan codes mapped to SKU and product records for POS lookup.
        </p>
      </div>

      <DataTableCard
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <SearchBox onChange={setQuery} value={query} />
            <Button
              aria-label="Refresh barcodes"
              onClick={() => barcodes.refetch()}
              size="icon"
              type="button"
              variant="outline"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        }
        count={settled ? rows.length : undefined}
        title="Barcode registry"
      >
        <BarcodesContent
          errorMessage={barcodes.error?.message}
          isError={barcodes.isError}
          isLoading={barcodes.isLoading}
          onRetry={() => barcodes.refetch()}
          rows={rows}
        />
      </DataTableCard>
    </div>
  );
}
