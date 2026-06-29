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
import { CircleDollarSign } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { EmptyState, ErrorState } from "@/components/states";
import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/shifts")({
  component: ShiftsScreen,
});

type PosClient = AppRouterClient["pos"];
type ShiftRow = Awaited<ReturnType<PosClient["shiftList"]>>[number];
type XReport = Awaited<ReturnType<PosClient["xReport"]>>;
type ZReport = Awaited<ReturnType<PosClient["zReport"]>>;
type CashAmount = XReport["expectedCash"][number];
type CashMovement = XReport["cashMovements"][number];

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;
const MOVEMENT_LABELS: Record<string, string> = {
  close_count: "Close count",
  drop: "Drop",
  open_float: "Opening float",
  pay_in: "Pay in",
  pay_out: "Pay out",
};

function formatDate(value: Date | string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function shortUser(id: string): string {
  return id.length > 18 ? `${id.slice(0, 18)}...` : id;
}

function ShiftStatusBadge({ status }: { status: ShiftRow["status"] }) {
  return (
    <Badge variant={status === "open" ? "default" : "secondary"}>
      {status === "open" ? "Open" : "Closed"}
    </Badge>
  );
}

function MoneyList({ rows }: { rows: CashAmount[] }) {
  if (rows.length === 0) {
    return <span className="text-muted-foreground">No cash recorded</span>;
  }
  return (
    <div className="flex flex-col gap-1">
      {rows.map((row) => (
        <span
          className="font-mono text-sm tabular-nums"
          key={`${row.currency}:${row.scale}:${row.amountMinor}`}
        >
          {formatMoney(row.amountMinor, row.currency, row.scale)}
        </span>
      ))}
    </div>
  );
}

function SummaryMetric({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-1 font-medium text-sm">{children}</div>
    </div>
  );
}

function ShiftsTable({
  onSelect,
  rows,
}: {
  onSelect: (row: ShiftRow) => void;
  rows: ShiftRow[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Terminal</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Opened</TableHead>
          <TableHead>Closed</TableHead>
          <TableHead>Z report</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            className="cursor-pointer"
            key={row.id}
            onClick={() => onSelect(row)}
          >
            <TableCell className="font-medium">{row.terminalId}</TableCell>
            <TableCell>{row.locationName}</TableCell>
            <TableCell>
              <ShiftStatusBadge status={row.status} />
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {formatDate(row.openedAt)}
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {formatDate(row.closedAt)}
            </TableCell>
            <TableCell className="font-mono text-muted-foreground text-xs">
              {row.zReportNumber ?? "-"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ShiftsContent({
  errorMessage,
  isError,
  isLoading,
  onRetry,
  onSelect,
  rows,
}: {
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  onSelect: (row: ShiftRow) => void;
  rows: ShiftRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load shifts."}
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
        description="Opened and closed drawer sessions will appear here once cash control is used."
        icon={CircleDollarSign}
        title="No shifts yet"
      />
    );
  }

  return <ShiftsTable onSelect={onSelect} rows={rows} />;
}

function CashMovementTable({ rows }: { rows: CashMovement[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-muted-foreground text-sm">
        This shift has no drawer movements.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{MOVEMENT_LABELS[row.type] ?? row.type}</TableCell>
            <TableCell className="text-muted-foreground">
              {row.reason ?? "-"}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatMoney(row.amountMinor, row.currency, row.scale)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OpenShiftDetail({ report }: { report: XReport }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryMetric label="Status">
          <ShiftStatusBadge status={report.status} />
        </SummaryMetric>
        <SummaryMetric label="Opened">
          {formatDate(report.openedAt)}
        </SummaryMetric>
        <SummaryMetric label="Expected cash">
          <MoneyList rows={report.expectedCash} />
        </SummaryMetric>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <CashMovementTable rows={report.cashMovements} />
      </div>
    </div>
  );
}

function ClosedShiftDetail({ report }: { report: ZReport }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryMetric label="Z report">
          <span className="font-mono">{report.zReportNumber ?? "-"}</span>
        </SummaryMetric>
        <SummaryMetric label="Expected cash">
          <MoneyList rows={report.expectedCash} />
        </SummaryMetric>
        <SummaryMetric label="Counted cash">
          <MoneyList rows={report.countedCash} />
        </SummaryMetric>
      </div>
      <div className="rounded-lg border px-3 py-2">
        <p className="text-muted-foreground text-xs">Over / short</p>
        <div className="mt-1">
          <MoneyList rows={report.overShort} />
        </div>
      </div>
    </div>
  );
}

function ShiftDetailBody({
  isError,
  isLoading,
  selected,
  xReport,
  zReport,
}: {
  isError: boolean;
  isLoading: boolean;
  selected: ShiftRow | null;
  xReport: XReport | undefined;
  zReport: ZReport | undefined;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  if (isError || !selected) {
    return <ErrorState message="Could not load shift detail." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">{selected.terminalId}</span>
        <span className="text-muted-foreground">{selected.locationName}</span>
        <ShiftStatusBadge status={selected.status} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SummaryMetric label="Cashier">
          <span className="font-mono text-xs">
            {shortUser(selected.cashierUserId)}
          </span>
        </SummaryMetric>
        <SummaryMetric label="Closed">
          {formatDate(selected.closedAt)}
        </SummaryMetric>
      </div>
      {selected.status === "open" && xReport ? (
        <OpenShiftDetail report={xReport} />
      ) : null}
      {selected.status === "closed" && zReport ? (
        <ClosedShiftDetail report={zReport} />
      ) : null}
    </div>
  );
}

function ShiftsScreen() {
  const [selected, setSelected] = useState<ShiftRow | null>(null);
  const shifts = useQuery(orpc.pos.shiftList.queryOptions({ input: {} }));
  const xReport = useQuery(
    orpc.pos.xReport.queryOptions({
      enabled: selected?.status === "open",
      input: { shiftId: selected?.id ?? "" },
    })
  );
  const zReport = useQuery(
    orpc.pos.zReport.queryOptions({
      enabled: selected?.status === "closed",
      input: { shiftId: selected?.id ?? "" },
    })
  );

  const rows = shifts.data ?? [];
  const openCount = useMemo(
    () => rows.filter((row) => row.status === "open").length,
    [rows]
  );
  const settled = !(shifts.isLoading || shifts.isError);
  const detailLoading =
    selected?.status === "open" ? xReport.isLoading : zReport.isLoading;
  const detailError =
    selected?.status === "open" ? xReport.isError : zReport.isError;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Shifts</h1>
        <p className="text-muted-foreground">
          Cash drawer sessions, X reports, and Z settlements.
        </p>
      </div>

      <DataTableCard
        count={settled ? rows.length : undefined}
        footer={settled ? `${openCount} open drawer sessions` : undefined}
        title="Cash control"
      >
        <ShiftsContent
          errorMessage={shifts.error?.message}
          isError={shifts.isError}
          isLoading={shifts.isLoading}
          onRetry={() => shifts.refetch()}
          onSelect={setSelected}
          rows={rows}
        />
      </DataTableCard>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
          }
        }}
        open={selected != null}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Shift detail</DialogTitle>
            <DialogDescription>
              Drawer totals and settlement data from the backend report.
            </DialogDescription>
          </DialogHeader>
          <ShiftDetailBody
            isError={detailError}
            isLoading={detailLoading}
            selected={selected}
            xReport={xReport.data}
            zReport={zReport.data}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
