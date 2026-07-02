import type { AppRouterClient } from "@RetailOS/api/routers/index";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@RetailOS/ui/components/alert";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { DataTableCard } from "@RetailOS/ui/components/data-table-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@RetailOS/ui/components/dialog";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
import {
  Select,
  SelectContent,
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CircleDollarSign,
  Plus,
  Trash2,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

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
type CloseShiftResult = Awaited<ReturnType<PosClient["closeShift"]>>;
type LocationRow = Awaited<
  ReturnType<AppRouterClient["location"]["list"]>
>[number];
type CashAmount = XReport["expectedCash"][number];
type CashMovementRow = XReport["cashMovements"][number];
type MovementType = "drop" | "pay_in" | "pay_out";

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;
const MOVEMENT_LABELS: Record<string, string> = {
  close_count: "Close count",
  drop: "Drop",
  open_float: "Opening float",
  pay_in: "Pay in",
  pay_out: "Pay out",
};
const MOVEMENT_OPTIONS: Array<{ label: string; value: MovementType }> = [
  { label: "Pay in", value: "pay_in" },
  { label: "Pay out", value: "pay_out" },
  { label: "Drop", value: "drop" },
];

// Cash entry is fixed at 2 decimal places (GYD/USD drawer money). The scale
// travels explicitly to the backend with every amount.
const CASH_SCALE = 2;

function formatDate(value: Date | string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function shortUser(id: string): string {
  return id.length > 18 ? `${id.slice(0, 18)}...` : id;
}

// Decimal text → integer minor units at the given scale. The ONLY place a
// user-typed amount becomes a backend money value (same conversion the
// products screen uses). Returns null for invalid/negative input.
function displayToMinor(value: string, scale: number): number | null {
  const parsed = Number(value);
  if (!(Number.isFinite(parsed) && parsed >= 0)) {
    return null;
  }
  return Math.round(parsed * 10 ** scale);
}

interface CashLine {
  amountText: string;
  currency: string;
  key: string;
}

function newCashLine(): CashLine {
  return { amountText: "0.00", currency: "GYD", key: crypto.randomUUID() };
}

// Parse editor rows into backend cash lines; null (with a toast) on bad input.
function parseCashLines(
  lines: CashLine[]
): { amountMinor: number; currency: string; scale: number }[] | null {
  const parsed: { amountMinor: number; currency: string; scale: number }[] = [];
  for (const line of lines) {
    const amountMinor = displayToMinor(line.amountText, CASH_SCALE);
    if (amountMinor == null) {
      toast.error("Cash amounts must be valid non-negative numbers.");
      return null;
    }
    const currency = line.currency.trim().toUpperCase();
    if (currency.length !== 3) {
      toast.error("Cash currencies must be 3-letter codes.");
      return null;
    }
    parsed.push({ amountMinor, currency, scale: CASH_SCALE });
  }
  return parsed;
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

function CashMovementTable({ rows }: { rows: CashMovementRow[] }) {
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

// Actions availability MIRRORS the backend guards exactly: cashMovement and
// closeShift both reject unless the shift status is 'open' (and both require
// the shift's OWN terminal — the dialogs pass shift.terminalId verbatim so a
// terminal mismatch is impossible from this UI). A closed shift shows no
// actions.
function ShiftDetailActions({
  onCashMovement,
  onCloseShift,
  status,
}: {
  onCashMovement: () => void;
  onCloseShift: () => void;
  status: ShiftRow["status"];
}) {
  if (status !== "open") {
    return null;
  }
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button onClick={onCashMovement} variant="outline">
        <Wallet className="size-4" />
        Record cash movement
      </Button>
      <Button onClick={onCloseShift} variant="destructive">
        <CircleDollarSign className="size-4" />
        Close shift
      </Button>
    </div>
  );
}

function ShiftDetailBody({
  isError,
  isLoading,
  onCashMovement,
  onCloseShift,
  selected,
  xReport,
  zReport,
}: {
  isError: boolean;
  isLoading: boolean;
  onCashMovement: () => void;
  onCloseShift: () => void;
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
      <ShiftDetailActions
        onCashMovement={onCashMovement}
        onCloseShift={onCloseShift}
        status={selected.status}
      />
    </div>
  );
}

// ── Multi-currency cash line editor (opening float / counted cash) ───────────

function CashLinesEditor({
  label,
  lines,
  onChange,
}: {
  label: string;
  lines: CashLine[];
  onChange: (next: CashLine[]) => void;
}) {
  function update(key: string, patch: Partial<CashLine>) {
    onChange(
      lines.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button
          onClick={() => onChange([...lines, newCashLine()])}
          size="sm"
          variant="outline"
        >
          <Plus className="size-3.5" />
          Add currency
        </Button>
      </div>
      {lines.length === 0 ? (
        <p className="text-muted-foreground text-xs">No cash lines.</p>
      ) : null}
      {lines.map((line) => (
        <div className="flex items-center gap-2" key={line.key}>
          <Input
            aria-label="Amount"
            inputMode="decimal"
            min={0}
            onChange={(event) =>
              update(line.key, { amountText: event.target.value })
            }
            step="0.01"
            type="number"
            value={line.amountText}
          />
          <Input
            aria-label="Currency"
            className="w-20"
            maxLength={3}
            onChange={(event) =>
              update(line.key, { currency: event.target.value.toUpperCase() })
            }
            value={line.currency}
          />
          <Button
            aria-label="Remove cash line"
            onClick={() =>
              onChange(lines.filter((other) => other.key !== line.key))
            }
            size="icon"
            variant="ghost"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// ── Open shift ────────────────────────────────────────────────────────────────

function OpenShiftDialog({
  locations,
  onDone,
  onOpenChange,
}: {
  locations: LocationRow[];
  onDone: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const locationFieldId = useId();
  const terminalFieldId = useId();
  // One idempotency key per dialog-open: a double-click or a retried request
  // can never open two shifts.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [locationId, setLocationId] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [floatLines, setFloatLines] = useState<CashLine[]>([newCashLine()]);
  const openShift = useMutation(orpc.pos.openShift.mutationOptions());

  // The backend only opens shifts at sellable locations — the picker offers
  // exactly that set (availability mirrors enforcement).
  const sellableLocations = useMemo(
    () => locations.filter((loc) => loc.isSellable && !loc.isTransit),
    [locations]
  );

  async function submit() {
    if (!locationId) {
      toast.error("Pick a location.");
      return;
    }
    if (!terminalId.trim()) {
      toast.error("Enter a terminal id.");
      return;
    }
    const openingFloat = parseCashLines(floatLines);
    if (openingFloat == null) {
      return;
    }
    try {
      await openShift.mutateAsync({
        idempotencyKey,
        locationId,
        openingFloat,
        terminalId: terminalId.trim(),
      });
      toast.success("Shift opened");
      onOpenChange(false);
      await onDone();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not open the shift."
      );
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open shift</DialogTitle>
          <DialogDescription>
            Start a drawer session at a terminal with its opening float. One
            open shift per terminal.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={locationFieldId}>Location</Label>
            <Select
              onValueChange={(next) => setLocationId(next ?? "")}
              value={locationId}
            >
              <SelectTrigger className="w-full" id={locationFieldId}>
                <SelectValue placeholder="Pick a sellable location" />
              </SelectTrigger>
              <SelectContent>
                {sellableLocations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={terminalFieldId}>Terminal id</Label>
            <Input
              id={terminalFieldId}
              onChange={(event) => setTerminalId(event.target.value)}
              placeholder="e.g. TERM-1"
              value={terminalId}
            />
          </div>
          <CashLinesEditor
            label="Opening float"
            lines={floatLines}
            onChange={setFloatLines}
          />
        </div>
        <DialogFooter>
          <Button
            disabled={openShift.isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={openShift.isPending} onClick={submit}>
            {openShift.isPending ? "Opening…" : "Open shift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Cash movement (pay in / pay out / drop) ───────────────────────────────────

function CashMovementDialog({
  onDone,
  onOpenChange,
  shift,
}: {
  onDone: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  shift: ShiftRow;
}) {
  const typeFieldId = useId();
  const amountFieldId = useId();
  const currencyFieldId = useId();
  const reasonFieldId = useId();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [type, setType] = useState<MovementType>("pay_in");
  const [amountText, setAmountText] = useState("0.00");
  const [currency, setCurrency] = useState("GYD");
  const [reason, setReason] = useState("");
  const cashMovement = useMutation(orpc.pos.cashMovement.mutationOptions());

  async function submit() {
    const amountMinor = displayToMinor(amountText, CASH_SCALE);
    if (amountMinor == null) {
      toast.error("Enter a valid non-negative amount.");
      return;
    }
    if (currency.trim().length !== 3) {
      toast.error("Currency must be a 3-letter code.");
      return;
    }
    try {
      await cashMovement.mutateAsync({
        amountMinor,
        currency: currency.trim().toUpperCase(),
        idempotencyKey,
        reason: reason.trim() || undefined,
        scale: CASH_SCALE,
        shiftId: shift.id,
        // The backend rejects a movement on another terminal's drawer — pass
        // the shift's own terminal verbatim.
        terminalId: shift.terminalId,
        type,
      });
      toast.success("Cash movement recorded");
      onOpenChange(false);
      await onDone();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not record the cash movement."
      );
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record cash movement</DialogTitle>
          <DialogDescription>
            Pay in, pay out, or drop cash for terminal{" "}
            <span className="font-mono">{shift.terminalId}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={typeFieldId}>Type</Label>
            <Select
              onValueChange={(next) =>
                setType((next ?? "pay_in") as MovementType)
              }
              value={type}
            >
              <SelectTrigger className="w-full" id={typeFieldId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_5rem]">
            <div className="grid gap-2">
              <Label htmlFor={amountFieldId}>Amount</Label>
              <Input
                id={amountFieldId}
                inputMode="decimal"
                min={0}
                onChange={(event) => setAmountText(event.target.value)}
                step="0.01"
                type="number"
                value={amountText}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={currencyFieldId}>Currency</Label>
              <Input
                id={currencyFieldId}
                maxLength={3}
                onChange={(event) =>
                  setCurrency(event.target.value.toUpperCase())
                }
                value={currency}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={reasonFieldId}>Reason (optional)</Label>
            <Input
              id={reasonFieldId}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. change run to the bank"
              value={reason}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={cashMovement.isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={cashMovement.isPending} onClick={submit}>
            {cashMovement.isPending ? "Recording…" : "Record movement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Blind close ───────────────────────────────────────────────────────────────

function CloseShiftResultView({
  onDone,
  result,
}: {
  onDone: () => void;
  result: CloseShiftResult;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryMetric label="Z report">
          <span className="font-mono">{result.zReportNumber}</span>
        </SummaryMetric>
        <SummaryMetric label="Expected cash">
          <MoneyList rows={result.expectedCash} />
        </SummaryMetric>
        <SummaryMetric label="Over / short">
          <MoneyList rows={result.overShort} />
        </SummaryMetric>
      </div>
      <p className="text-muted-foreground text-xs">
        Expected and over/short were computed by the backend after your blind
        count and are recorded on the Z report for the manager's audit trail.
      </p>
      <DialogFooter>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </div>
  );
}

// BLIND close (charter anti-shrinkage rule): the cashier types the physically
// counted drawer cash; the UI never shows the expected amount before
// submission. The backend computes expected + over/short and returns them —
// shown only AFTER the close is recorded.
function CloseShiftDialog({
  onClosed,
  onOpenChange,
  shift,
}: {
  onClosed: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  shift: ShiftRow;
}) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [countedLines, setCountedLines] = useState<CashLine[]>([newCashLine()]);
  const [result, setResult] = useState<CloseShiftResult | null>(null);
  const closeShift = useMutation(orpc.pos.closeShift.mutationOptions());

  async function submit() {
    const countedCash = parseCashLines(countedLines);
    if (countedCash == null) {
      return;
    }
    try {
      const closed = await closeShift.mutateAsync({
        countedCash,
        idempotencyKey,
        shiftId: shift.id,
        // Same-terminal rule: a shift can only be closed through its own
        // terminal, so the UI passes it verbatim.
        terminalId: shift.terminalId,
      });
      setResult(closed);
      toast.success("Shift closed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not close the shift."
      );
    }
  }

  async function finish() {
    onOpenChange(false);
    await onClosed();
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open && result) {
          finish();
          return;
        }
        onOpenChange(open);
      }}
      open
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close shift (blind count)</DialogTitle>
          <DialogDescription>
            Terminal <span className="font-mono">{shift.terminalId}</span> —
            count the physical drawer cash and enter it below.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <CloseShiftResultView onDone={finish} result={result} />
        ) : (
          <div className="grid gap-4">
            <Alert>
              <TriangleAlert />
              <AlertTitle>Blind count</AlertTitle>
              <AlertDescription>
                The expected amount is not shown. Enter exactly what you counted
                — the system computes any over/short after you submit, and the
                close cannot be edited afterward.
              </AlertDescription>
            </Alert>
            <CashLinesEditor
              label="Counted cash"
              lines={countedLines}
              onChange={setCountedLines}
            />
            <DialogFooter>
              <Button
                disabled={closeShift.isPending}
                onClick={() => onOpenChange(false)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={closeShift.isPending}
                onClick={submit}
                variant="destructive"
              >
                {closeShift.isPending ? "Closing…" : "Confirm blind close"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ShiftsScreen() {
  const [selected, setSelected] = useState<ShiftRow | null>(null);
  const [openShiftOpen, setOpenShiftOpen] = useState(false);
  const [movementShift, setMovementShift] = useState<ShiftRow | null>(null);
  const [closingShift, setClosingShift] = useState<ShiftRow | null>(null);

  const shifts = useQuery(orpc.pos.shiftList.queryOptions({ input: {} }));
  // Location picker source for the open-shift dialog (existing backend read).
  const locations = useQuery(orpc.location.list.queryOptions({ input: {} }));
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

  async function refreshAfterMovement() {
    await Promise.all([shifts.refetch(), xReport.refetch()]);
  }

  async function refreshAfterClose() {
    // The selected row's status is stale after a close — drop the selection
    // and let the refreshed list carry the closed state.
    setSelected(null);
    await shifts.refetch();
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Shifts</h1>
        <p className="text-muted-foreground">
          Cash drawer sessions, X reports, and Z settlements.
        </p>
      </div>

      <DataTableCard
        actions={
          <Button onClick={() => setOpenShiftOpen(true)}>
            <Plus className="size-4" />
            Open shift
          </Button>
        }
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
            onCashMovement={() => setMovementShift(selected)}
            onCloseShift={() => setClosingShift(selected)}
            selected={selected}
            xReport={xReport.data}
            zReport={zReport.data}
          />
        </DialogContent>
      </Dialog>

      {openShiftOpen ? (
        <OpenShiftDialog
          locations={locations.data ?? []}
          onDone={async () => {
            await shifts.refetch();
          }}
          onOpenChange={setOpenShiftOpen}
        />
      ) : null}

      {movementShift ? (
        <CashMovementDialog
          onDone={refreshAfterMovement}
          onOpenChange={(open) => {
            if (!open) {
              setMovementShift(null);
            }
          }}
          shift={movementShift}
        />
      ) : null}

      {closingShift ? (
        <CloseShiftDialog
          onClosed={refreshAfterClose}
          onOpenChange={(open) => {
            if (!open) {
              setClosingShift(null);
            }
          }}
          shift={closingShift}
        />
      ) : null}
    </div>
  );
}
