import type { AppRouterClient } from "@RetailOS/api/routers/index";
import { Badge } from "@RetailOS/ui/components/badge";
import { DataTableCard } from "@RetailOS/ui/components/data-table-card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
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
import { History, MapPin } from "lucide-react";
import { useState } from "react";

import { EmptyState, ErrorState } from "@/components/states";
import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/stock-ledger")({
  component: StockLedgerScreen,
});

type InventoryClient = AppRouterClient["inventory"];
type LocationClient = AppRouterClient["location"];
type LedgerRow = Awaited<
  ReturnType<InventoryClient["stockLedgerList"]>
>[number];
type LocationRow = Awaited<ReturnType<LocationClient["list"]>>[number];

const ALL_LOCATIONS = "all";
const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleString();
}

function signedQty(qty: number): string {
  return qty > 0 ? `+${qty}` : String(qty);
}

function unitCost(row: LedgerRow): string {
  if (row.unitCostMinor == null || row.costCurrency == null) {
    return "-";
  }
  return formatMoney(row.unitCostMinor, row.costCurrency, row.costScale ?? 2);
}

function LocationFilter({
  locations,
  onChange,
  value,
}: {
  locations: LocationRow[];
  onChange: (next: string) => void;
  value: string;
}) {
  return (
    <Select
      onValueChange={(next) => onChange(next ?? ALL_LOCATIONS)}
      value={value}
    >
      <SelectTrigger aria-label="Filter by location" className="w-56">
        <MapPin className="size-4 text-muted-foreground" />
        <SelectValue placeholder="All locations" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={ALL_LOCATIONS}>All locations</SelectItem>
          {locations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function LedgerTable({ rows }: { rows: LedgerRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[260px]">Product</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Qty delta</TableHead>
          <TableHead className="text-right">Balance</TableHead>
          <TableHead className="text-right">Unit cost</TableHead>
          <TableHead className="text-right">When</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="min-w-0">
                <p className="truncate font-medium">{row.productName}</p>
                <p className="font-mono text-muted-foreground text-xs">
                  {row.skuCode ?? row.skuId ?? "-"}
                </p>
              </div>
            </TableCell>
            <TableCell>{row.locationName}</TableCell>
            <TableCell>
              <Badge variant="secondary">{row.movementType}</Badge>
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {signedQty(row.qtyDelta)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {row.balanceAfter}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {unitCost(row)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground text-sm tabular-nums">
              {formatDate(row.serverTs)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LedgerContent({
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
  rows: LedgerRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load the stock ledger."}
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
        description="Receipts, sales, transfers, releases, and adjustments will appear here."
        icon={History}
        title="No ledger movements yet"
      />
    );
  }

  return <LedgerTable rows={rows} />;
}

function StockLedgerScreen() {
  const [locationFilter, setLocationFilter] = useState(ALL_LOCATIONS);
  const locationId =
    locationFilter === ALL_LOCATIONS ? undefined : locationFilter;
  const ledger = useQuery(
    orpc.inventory.stockLedgerList.queryOptions({
      input: { limit: 200, locationId },
    })
  );
  const locations = useQuery(orpc.location.list.queryOptions({ input: {} }));
  const rows = ledger.data ?? [];
  const settled = !(ledger.isLoading || ledger.isError);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Stock ledger</h1>
        <p className="text-muted-foreground">
          Append-only inventory movements across products and locations.
        </p>
      </div>

      <DataTableCard
        actions={
          <LocationFilter
            locations={locations.data ?? []}
            onChange={setLocationFilter}
            value={locationFilter}
          />
        }
        count={settled ? rows.length : undefined}
        title="Movements"
      >
        <LedgerContent
          errorMessage={ledger.error?.message}
          isError={ledger.isError}
          isLoading={ledger.isLoading}
          onRetry={() => ledger.refetch()}
          rows={rows}
        />
      </DataTableCard>
    </div>
  );
}
