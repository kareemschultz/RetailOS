import type { AppRouterClient } from "@RetailOS/api/routers/index";
import { Badge } from "@RetailOS/ui/components/badge";
import { DataTableCard } from "@RetailOS/ui/components/data-table-card";
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
import { FileClock } from "lucide-react";

import { EmptyState, ErrorState } from "@/components/states";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/reports/number-leases")({
  component: NumberLeasesScreen,
});

type PosClient = AppRouterClient["pos"];
type NumberLeaseRow = Awaited<ReturnType<PosClient["numberLeaseList"]>>[number];

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;
const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  exhausted: "Exhausted",
  expired: "Expired",
  reclaimed: "Reclaimed",
  voided: "Voided",
};
const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  exhausted: "secondary",
  expired: "outline",
  reclaimed: "secondary",
  voided: "destructive",
};

function formatDate(value: Date | string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? "outline"}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function LeaseRange({ row }: { row: NumberLeaseRow }) {
  return (
    <span className="font-mono tabular-nums">
      {row.rangeStart} - {row.rangeEnd}
    </span>
  );
}

function NumberLeasesTable({ rows }: { rows: NumberLeaseRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Terminal</TableHead>
          <TableHead>Scope</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Range</TableHead>
          <TableHead>Next</TableHead>
          <TableHead>Remaining</TableHead>
          <TableHead>Expires</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="min-w-0">
                <p className="truncate font-medium">{row.terminalId}</p>
                <p className="font-mono text-muted-foreground text-xs">
                  {row.deviceId ?? "No device id"}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <div className="min-w-0">
                <p className="truncate">{row.companyName}</p>
                <p className="truncate text-muted-foreground text-xs">
                  {row.locationName ?? "All locations"} · {row.docType} ·{" "}
                  {row.series}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <StatusBadge status={row.status} />
            </TableCell>
            <TableCell>
              <LeaseRange row={row} />
            </TableCell>
            <TableCell className="font-mono tabular-nums">
              {row.nextNumber}
            </TableCell>
            <TableCell className="font-mono tabular-nums">
              {row.remainingCount}
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {formatDate(row.expiresAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function NumberLeasesContent({
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
  rows: NumberLeaseRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load number leases."}
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-px">
        {SKELETON_KEYS.map((key) => (
          <Skeleton className="h-[56px] rounded-none" key={key} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        description="Allocated offline document-number blocks will appear here."
        icon={FileClock}
        title="No number leases yet"
      />
    );
  }

  return <NumberLeasesTable rows={rows} />;
}

function NumberLeasesScreen() {
  const leases = useQuery(orpc.pos.numberLeaseList.queryOptions({ input: {} }));
  const rows = leases.data ?? [];
  const settled = !(leases.isLoading || leases.isError);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Number leases</h1>
        <p className="text-muted-foreground">
          Offline document-number blocks allocated to terminals.
        </p>
      </div>

      <DataTableCard
        count={settled ? rows.length : undefined}
        title="Lease monitor"
      >
        <NumberLeasesContent
          errorMessage={leases.error?.message}
          isError={leases.isError}
          isLoading={leases.isLoading}
          onRetry={() => leases.refetch()}
          rows={rows}
        />
      </DataTableCard>
    </div>
  );
}
