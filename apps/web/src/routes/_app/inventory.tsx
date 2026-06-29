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
import { History, MapPin, Package, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/inventory")({
  component: InventoryScreen,
});

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;
const ALL_LOCATIONS = "all";
const MOVEMENTS_LIMIT = 50;

// Each cell is a backend DTO field (inventory.stockByLocation /
// stockLedgerList). The UI renders these values only — no summing, tax, FX, or
// rounding happens here; formatMoney is the minor-units -> display conversion.
interface StockRow {
  currency: string;
  locationId: string;
  locationName: string;
  productName: string;
  qtyOnHand: number;
  scale: number;
  skuCode: string;
  skuId: string;
  totalValueMinor: number;
}

interface MovementRow {
  balanceAfter: number;
  id: string;
  movementType: string;
  qtyDelta: number;
  serverTs: string | Date;
}

interface LocationOption {
  id: string;
  name: string;
}

// A signed quantity is display-only: the backend ledger owns the sign; we just
// prefix "+" on positive deltas so an increase reads distinctly from a decrease.
function signedQty(qty: number): string {
  return qty > 0 ? `+${qty}` : String(qty);
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Package;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

function ErrorPanel({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-5" />
      </div>
      <p className="font-medium">Couldn’t load data</p>
      <p className="text-muted-foreground text-sm">
        {message ?? "Check your connection or permissions and retry."}
      </p>
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-px">
      {SKELETON_KEYS.map((k) => (
        <Skeleton className="h-[60px] rounded-none" key={k} />
      ))}
    </div>
  );
}

function StockContent({
  isLoading,
  isError,
  errorMessage,
  rows,
}: {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  rows: StockRow[];
}) {
  if (isError) {
    return <ErrorPanel message={errorMessage} />;
  }
  if (isLoading) {
    return <RowsSkeleton />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        description="Receive stock or pick another location to see balances here."
        icon={Package}
        title="No stock on hand"
      />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[280px]">Product</TableHead>
          <TableHead>Location</TableHead>
          <TableHead className="text-right">Qty on hand</TableHead>
          <TableHead className="text-right">Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.skuId}-${row.locationId}`}>
            <TableCell>
              <div className="min-w-0">
                <p className="truncate font-medium">{row.productName}</p>
                <p className="font-mono text-muted-foreground text-xs">
                  {row.skuCode}
                </p>
              </div>
            </TableCell>
            <TableCell>{row.locationName}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {row.qtyOnHand}
            </TableCell>
            <TableCell className="text-right font-medium font-mono tabular-nums">
              {formatMoney(row.totalValueMinor, row.currency, row.scale)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function MovementsContent({
  isLoading,
  isError,
  errorMessage,
  rows,
}: {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  rows: MovementRow[];
}) {
  if (isError) {
    return <ErrorPanel message={errorMessage} />;
  }
  if (isLoading) {
    return <RowsSkeleton />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        description="Stock receipts, sales, transfers, and adjustments appear here as they happen."
        icon={History}
        title="No movements yet"
      />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Qty delta</TableHead>
          <TableHead className="text-right">Balance after</TableHead>
          <TableHead className="text-right">When</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Badge variant="secondary">{row.movementType}</Badge>
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {signedQty(row.qtyDelta)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {row.balanceAfter}
            </TableCell>
            <TableCell className="text-right text-muted-foreground text-sm">
              {new Date(row.serverTs).toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LocationFilter({
  value,
  locations,
  onChange,
}: {
  value: string;
  locations: LocationOption[];
  onChange: (next: string) => void;
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
          {locations.map((loc) => (
            <SelectItem key={loc.id} value={loc.id}>
              {loc.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function InventoryScreen() {
  const [locationFilter, setLocationFilter] = useState<string>(ALL_LOCATIONS);
  const locationId =
    locationFilter === ALL_LOCATIONS ? undefined : locationFilter;

  // All figures are backend-authoritative DTOs (RLS- and permission-scoped);
  // the client never computes a balance or a value.
  const stock = useQuery(
    orpc.inventory.stockByLocation.queryOptions({ input: { locationId } })
  );
  const movements = useQuery(
    orpc.inventory.stockLedgerList.queryOptions({
      input: { limit: MOVEMENTS_LIMIT },
    })
  );
  const locations = useQuery(orpc.location.list.queryOptions({ input: {} }));

  const stockRows = (stock.data ?? []) as StockRow[];
  const movementRows = (movements.data ?? []) as MovementRow[];
  const locationOptions = (locations.data ?? []) as LocationOption[];
  const stockSettled = !(stock.isLoading || stock.isError);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Inventory</h1>
        <p className="text-muted-foreground">
          Stock on hand and recent movements across every location.
        </p>
      </div>

      <DataTableCard
        actions={
          <LocationFilter
            locations={locationOptions}
            onChange={setLocationFilter}
            value={locationFilter}
          />
        }
        count={stockSettled ? stockRows.length : undefined}
        title="Stock on hand"
      >
        <StockContent
          errorMessage={stock.error?.message}
          isError={stock.isError}
          isLoading={stock.isLoading}
          rows={stockRows}
        />
      </DataTableCard>

      <DataTableCard title="Recent movements">
        <MovementsContent
          errorMessage={movements.error?.message}
          isError={movements.isError}
          isLoading={movements.isLoading}
          rows={movementRows}
        />
      </DataTableCard>
    </div>
  );
}
