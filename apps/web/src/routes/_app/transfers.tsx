import type { AppRouterClient } from "@RetailOS/api/routers/index";
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
  ArrowRight,
  ArrowRightLeft,
  CircleOff,
  PackageCheck,
  Plus,
  Trash2,
  Truck,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState } from "@/components/states";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/transfers")({
  component: TransfersScreen,
});

type TransferClient = AppRouterClient["transfer"];
type TransferRow = Awaited<ReturnType<TransferClient["list"]>>[number];
type TransferDetail = Awaited<ReturnType<TransferClient["detail"]>>;
type LocationRow = Awaited<
  ReturnType<AppRouterClient["location"]["list"]>
>[number];

// The transfer state machine action set. Availability mirrors the backend
// status guards exactly (see TransferActionButtons).
type TransferAction = "cancel" | "receive" | "ship";

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

// Copy for the confirmation dialog per action. successMessage is shown by the
// toast after the backend accepts the mutation.
const ACTION_COPY: Record<
  TransferAction,
  {
    confirmLabel: string;
    description: string;
    pendingLabel: string;
    successMessage: string;
    title: string;
  }
> = {
  cancel: {
    confirmLabel: "Cancel transfer",
    description:
      "Cancelling stops this transfer. If it was already shipped, the in-transit stock is returned to the source location.",
    pendingLabel: "Cancelling…",
    successMessage: "Transfer cancelled",
    title: "Cancel this transfer?",
  },
  receive: {
    confirmLabel: "Receive transfer",
    description:
      "Receiving moves the in-transit stock into the destination location and completes the transfer.",
    pendingLabel: "Receiving…",
    successMessage: "Transfer received",
    title: "Receive this transfer?",
  },
  ship: {
    confirmLabel: "Ship transfer",
    description:
      "Shipping moves the stock out of the source location into transit. The destination receives it in a second step.",
    pendingLabel: "Shipping…",
    successMessage: "Transfer shipped",
    title: "Ship this transfer?",
  },
};

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
            <TableCell className="font-medium">{line.productName}</TableCell>
            <TableCell className="font-mono text-muted-foreground text-xs">
              {line.skuCode ?? "—"}
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

// Action availability MIRRORS the backend status guards exactly
// (packages/api services/transfer.ts): ship requires status==='draft';
// receive requires status==='shipped'; cancel rejects 'received' and
// 'cancelled' (so it is offered for draft and shipped only). A rendered
// action here is never rejected at submit for its status.
function TransferActionButtons({
  onAction,
  status,
}: {
  onAction: (action: TransferAction) => void;
  status: string;
}) {
  const canShip = status === "draft";
  const canReceive = status === "shipped";
  const canCancel = status === "draft" || status === "shipped";

  if (!canCancel) {
    return (
      <p className="text-muted-foreground text-xs">
        No actions available — this transfer is{" "}
        {(STATUS_LABELS[status] ?? status).toLowerCase()}.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canShip ? (
        <Button onClick={() => onAction("ship")}>
          <Truck className="size-4" />
          Ship
        </Button>
      ) : null}
      {canReceive ? (
        <Button onClick={() => onAction("receive")}>
          <PackageCheck className="size-4" />
          Receive
        </Button>
      ) : null}
      <Button onClick={() => onAction("cancel")} variant="destructive">
        <CircleOff className="size-4" />
        Cancel transfer
      </Button>
    </div>
  );
}

function TransferDetailBody({
  detail,
  isError,
  isLoading,
  locations,
  onAction,
}: {
  detail: TransferDetail | undefined;
  isError: boolean;
  isLoading: boolean;
  locations: Map<string, string>;
  onAction: (action: TransferAction) => void;
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
      <TransferActionButtons onAction={onAction} status={transfer.status} />
    </div>
  );
}

// ── Confirmation dialog for ship / receive / cancel ──────────────────────────

function TransferActionDialog({
  action,
  onDone,
  onOpenChange,
  transferId,
  transferNumber,
}: {
  action: TransferAction;
  onDone: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  transferId: string;
  transferNumber: string;
}) {
  const reasonFieldId = useId();
  const [reason, setReason] = useState("");
  const shipTransfer = useMutation(orpc.transfer.ship.mutationOptions());
  const receiveTransfer = useMutation(orpc.transfer.receive.mutationOptions());
  const cancelTransfer = useMutation(orpc.transfer.cancel.mutationOptions());
  const isPending =
    shipTransfer.isPending ||
    receiveTransfer.isPending ||
    cancelTransfer.isPending;
  const copy = ACTION_COPY[action];

  async function confirm() {
    if (isPending) {
      return;
    }
    try {
      if (action === "ship") {
        await shipTransfer.mutateAsync({ transferId });
      } else if (action === "receive") {
        await receiveTransfer.mutateAsync({ transferId });
      } else {
        await cancelTransfer.mutateAsync({
          reason: reason.trim() || undefined,
          transferId,
        });
      }
      toast.success(copy.successMessage);
      onOpenChange(false);
      await onDone();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Transfer action failed."
      );
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{transferNumber}</span> —{" "}
            {copy.description}
          </DialogDescription>
        </DialogHeader>
        {action === "cancel" ? (
          <div className="grid gap-2">
            <Label htmlFor={reasonFieldId}>Reason (optional)</Label>
            <Input
              id={reasonFieldId}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is this transfer being cancelled?"
              value={reason}
            />
          </div>
        ) : null}
        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Keep transfer
          </Button>
          <Button
            disabled={isPending}
            onClick={confirm}
            variant={action === "cancel" ? "destructive" : "default"}
          >
            {isPending ? copy.pendingLabel : copy.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create-transfer mini wizard ───────────────────────────────────────────────

interface DraftLine {
  key: string;
  label: string;
  productId: string;
  qty: number;
  skuId: string;
}

function DraftLinesTable({
  lines,
  onRemove,
}: {
  lines: DraftLine[];
  onRemove: (key: string) => void;
}) {
  if (lines.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-3 py-4 text-center text-muted-foreground text-sm">
        No lines yet — pick a SKU and quantity above.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.key}>
              <TableCell className="font-medium text-sm">
                {line.label}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {line.qty}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  aria-label={`Remove ${line.label}`}
                  onClick={() => onRemove(line.key)}
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LocationSelect({
  disabled,
  id,
  onChange,
  options,
  placeholder,
  value,
}: {
  disabled?: boolean;
  id?: string;
  onChange: (value: string) => void;
  options: LocationRow[];
  placeholder: string;
  value: string;
}) {
  return (
    <Select
      disabled={disabled}
      onValueChange={(next) => onChange(next ?? "")}
      value={value}
    >
      <SelectTrigger className="w-full" id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((loc) => (
          <SelectItem key={loc.id} value={loc.id}>
            {loc.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CreateTransferDialog({
  locations,
  onCreated,
  onOpenChange,
}: {
  locations: LocationRow[];
  onCreated: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const sourceFieldId = useId();
  const destFieldId = useId();
  const dateFieldId = useId();
  const skuFieldId = useId();
  const qtyFieldId = useId();
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [pendingSkuId, setPendingSkuId] = useState("");
  const [pendingQty, setPendingQty] = useState("1");

  const skus = useQuery(
    orpc.catalog.skuCatalogList.queryOptions({ input: {} })
  );
  const createTransfer = useMutation(orpc.transfer.create.mutationOptions());

  // In-transit virtual nodes are internal transfer plumbing — never endpoints.
  const endpointOptions = useMemo(
    () => locations.filter((loc) => !loc.isTransit),
    [locations]
  );
  const source = endpointOptions.find((loc) => loc.id === sourceId);
  // The backend rejects inter-company transfers, so the destination picker
  // only offers locations in the source's company (availability mirrors
  // enforcement — createTransfer's same-company guard).
  const destOptions = useMemo(() => {
    if (!source) {
      return [];
    }
    return endpointOptions.filter(
      (loc) => loc.companyId === source.companyId && loc.id !== source.id
    );
  }, [endpointOptions, source]);

  function addLine() {
    const sku = (skus.data ?? []).find((row) => row.id === pendingSkuId);
    const qty = Number.parseInt(pendingQty, 10);
    if (!sku) {
      toast.error("Pick a SKU to add.");
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error("Quantity must be a positive whole number.");
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        label: `${sku.productName} · ${sku.code}`,
        productId: sku.productId,
        qty,
        skuId: sku.id,
      },
    ]);
    setPendingSkuId("");
    setPendingQty("1");
  }

  async function submit() {
    if (!(sourceId && destId)) {
      toast.error("Pick source and destination locations.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one line.");
      return;
    }
    try {
      await createTransfer.mutateAsync({
        destLocationId: destId,
        expectedReceiptDate: expectedDate || undefined,
        lines: lines.map((line) => ({
          productId: line.productId,
          qty: line.qty,
          skuId: line.skuId,
        })),
        sourceLocationId: sourceId,
      });
      toast.success("Transfer created as draft");
      onOpenChange(false);
      await onCreated();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create transfer."
      );
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New transfer</DialogTitle>
          <DialogDescription>
            Move stock between two locations of the same company. The transfer
            starts as a draft — ship it when the goods leave.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={sourceFieldId}>From</Label>
              <LocationSelect
                id={sourceFieldId}
                onChange={(next) => {
                  setSourceId(next);
                  setDestId("");
                }}
                options={endpointOptions}
                placeholder="Source location"
                value={sourceId}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={destFieldId}>To</Label>
              <LocationSelect
                disabled={!source}
                id={destFieldId}
                onChange={setDestId}
                options={destOptions}
                placeholder={
                  source ? "Destination location" : "Pick a source first"
                }
                value={destId}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={dateFieldId}>
              Expected receipt date (optional)
            </Label>
            <Input
              id={dateFieldId}
              onChange={(event) => setExpectedDate(event.target.value)}
              type="date"
              value={expectedDate}
            />
          </div>
          <div className="grid gap-2 rounded-md border p-3">
            <p className="font-medium text-sm">Add line</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_6rem_auto]">
              <div className="grid gap-1">
                <Label className="sr-only" htmlFor={skuFieldId}>
                  SKU
                </Label>
                <Select
                  onValueChange={(next) => setPendingSkuId(next ?? "")}
                  value={pendingSkuId}
                >
                  <SelectTrigger className="w-full" id={skuFieldId}>
                    <SelectValue placeholder="Pick a SKU" />
                  </SelectTrigger>
                  <SelectContent>
                    {(skus.data ?? []).map((sku) => (
                      <SelectItem key={sku.id} value={sku.id}>
                        {sku.productName} · {sku.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="sr-only" htmlFor={qtyFieldId}>
                  Quantity
                </Label>
                <Input
                  id={qtyFieldId}
                  min={1}
                  onChange={(event) => setPendingQty(event.target.value)}
                  step={1}
                  type="number"
                  value={pendingQty}
                />
              </div>
              <Button onClick={addLine} variant="outline">
                <Plus className="size-4" />
                Add
              </Button>
            </div>
            <DraftLinesTable
              lines={lines}
              onRemove={(key) =>
                setLines((prev) => prev.filter((line) => line.key !== key))
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={createTransfer.isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={createTransfer.isPending} onClick={submit}>
            {createTransfer.isPending ? "Creating…" : "Create draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransfersScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<TransferAction | null>(
    null
  );

  const transfers = useQuery(orpc.transfer.list.queryOptions({ input: {} }));
  // Display-only id→name lookup for the Route column (see locationName) and
  // the source of the create-dialog location pickers.
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

  async function refreshAfterAction() {
    await Promise.all([transfers.refetch(), detail.refetch()]);
  }

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
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New transfer
          </Button>
        }
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
            onAction={setPendingAction}
          />
        </DialogContent>
      </Dialog>

      {createOpen ? (
        <CreateTransferDialog
          locations={locations.data ?? []}
          onCreated={async () => {
            await transfers.refetch();
          }}
          onOpenChange={setCreateOpen}
        />
      ) : null}

      {pendingAction && detail.data ? (
        <TransferActionDialog
          action={pendingAction}
          onDone={refreshAfterAction}
          onOpenChange={(open) => {
            if (!open) {
              setPendingAction(null);
            }
          }}
          transferId={detail.data.transfer.id}
          transferNumber={detail.data.transfer.number}
        />
      ) : null}
    </div>
  );
}
