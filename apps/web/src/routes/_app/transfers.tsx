import type { AppRouterClient } from "@RetailOS/api/routers/index";
import { Badge } from "@RetailOS/ui/components/badge";
import { DataTableCard } from "@RetailOS/ui/components/data-table-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@RetailOS/ui/components/dialog";
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
import { ArrowRight, ArrowRightLeft } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, ErrorState } from "@/components/states";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/transfers")({
  component: TransfersScreen,
});

type TransferClient = AppRouterClient["transfer"];
type TransferRow = Awaited<ReturnType<TransferClient["list"]>>[number];
type TransferDetail = Awaited<ReturnType<TransferClient["detail"]>>;

const STATUS_LABELS: Record<string, string> = {
  cancelled: "Cancelled",
  draft: "Draft",
  received: "Received",
  shipped: "Shipped",
};

// Status → Badge variant. draft = neutral outline (not yet acted on); shipped =
// in-progress (primary); received = settled (secondary, like a completed sale);
// cancelled = destructive. Falls back to outline for any future status value.
const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  cancelled: "destructive",
  draft: "outline",
  received: "secondary",
  shipped: "default",
};

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;

function TransferStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? "outline"}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

// Backend timestamps arrive as Date (or ISO string) or null. Presentation
// only — no math.
function formatDate(value: Date | string | null): string {
  return value ? new Date(value).toLocaleDateString() : "—";
}

// DISPLAY-ONLY id→name mapping. The transfer DTO carries location ids, not
// names; resolving them to names for the Route column is presentation, not
// business logic. Unknown ids fall back to a short id so the column never blanks.
function locationName(map: Map<string, string>, id: string | null): string {
  if (!id) {
    return "—";
  }
  return map.get(id) ?? `${id.slice(0, 8)}…`;
}

function TransferRoute({
  destLocationId,
  locations,
  sourceLocationId,
}: {
  destLocationId: string | null;
  locations: Map<string, string>;
  sourceLocationId: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="truncate">
        {locationName(locations, sourceLocationId)}
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">
        {locationName(locations, destLocationId)}
      </span>
    </div>
  );
}

function TransfersTable({
  locations,
  onSelect,
  rows,
}: {
  locations: Map<string, string>;
  onSelect: (id: string) => void;
  rows: TransferRow[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead className="min-w-[260px]">Route</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Shipped</TableHead>
          <TableHead>Expected</TableHead>
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
              {row.number}
            </TableCell>
            <TableCell>
              <TransferRoute
                destLocationId={row.destLocationId}
                locations={locations}
                sourceLocationId={row.sourceLocationId}
              />
            </TableCell>
            <TableCell>
              <TransferStatusBadge status={row.status} />
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {formatDate(row.shippedAt)}
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {formatDate(row.expectedReceiptDate)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TransfersContent({
  errorMessage,
  isError,
  isLoading,
  locations,
  onRetry,
  onSelect,
  rows,
}: {
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  locations: Map<string, string>;
  onRetry: () => void;
  onSelect: (id: string) => void;
  rows: TransferRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load stock transfers."}
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
        description="Inter-store and warehouse stock movements will appear here once created."
        icon={ArrowRightLeft}
        title="No transfers yet"
      />
    );
  }

  return (
    <TransfersTable locations={locations} onSelect={onSelect} rows={rows} />
  );
}

function TransferDetailSummary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}

function TransferLinesTable({ lines }: { lines: TransferDetail["lines"] }) {
  if (lines.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-muted-foreground text-sm">
        This transfer has no lines.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead className="text-right">Qty</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={line.id}>
            <TableCell className="font-mono text-muted-foreground text-xs">
              {line.productId.slice(0, 8)}…
            </TableCell>
            <TableCell className="font-mono text-muted-foreground text-xs">
              {line.skuId ? `${line.skuId.slice(0, 8)}…` : "—"}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {line.qty}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TransferDetailBody({
  detail,
  isError,
  isLoading,
  locations,
}: {
  detail: TransferDetail | undefined;
  isError: boolean;
  isLoading: boolean;
  locations: Map<string, string>;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError || !detail) {
    return <ErrorState message="Could not load transfer detail." />;
  }

  const { transfer, lines } = detail;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <TransferRoute
          destLocationId={transfer.destLocationId}
          locations={locations}
          sourceLocationId={transfer.sourceLocationId}
        />
        <TransferStatusBadge status={transfer.status} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <TransferDetailSummary
          label="Shipped"
          value={formatDate(transfer.shippedAt)}
        />
        <TransferDetailSummary
          label="Expected"
          value={formatDate(transfer.expectedReceiptDate)}
        />
        <TransferDetailSummary
          label="Received"
          value={formatDate(transfer.actualReceiptDate)}
        />
        <TransferDetailSummary
          label="Created"
          value={formatDate(transfer.createdAt)}
        />
      </div>
      <div className="overflow-hidden rounded-lg border">
        <TransferLinesTable lines={lines} />
      </div>
    </div>
  );
}

function TransfersScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const transfers = useQuery(orpc.transfer.list.queryOptions({ input: {} }));
  // Display-only id→name lookup for the Route column (see locationName).
  const locations = useQuery(orpc.location.list.queryOptions({ input: {} }));
  const detail = useQuery(
    orpc.transfer.detail.queryOptions({
      enabled: selectedId != null,
      input: { transferId: selectedId ?? "" },
    })
  );

  const locationMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const loc of locations.data ?? []) {
      map.set(loc.id, loc.name);
    }
    return map;
  }, [locations.data]);

  const rows = transfers.data ?? [];
  const settled = !(transfers.isLoading || transfers.isError);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">
          Stock transfers
        </h1>
        <p className="text-muted-foreground">
          Inter-store and warehouse stock movements.
        </p>
      </div>

      <DataTableCard
        count={settled ? rows.length : undefined}
        title="Transfers"
      >
        <TransfersContent
          errorMessage={transfers.error?.message}
          isError={transfers.isError}
          isLoading={transfers.isLoading}
          locations={locationMap}
          onRetry={() => transfers.refetch()}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer detail</DialogTitle>
            <DialogDescription>
              Route, status, dates, and the lines moved.
            </DialogDescription>
          </DialogHeader>
          <TransferDetailBody
            detail={detail.data}
            isError={detail.isError}
            isLoading={detail.isLoading}
            locations={locationMap}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
