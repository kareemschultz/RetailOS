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
import { Archive, Layers, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState } from "@/components/states";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/lots")({
  component: LotsScreen,
});

type CatalogClient = AppRouterClient["catalog"];
type InventoryClient = AppRouterClient["inventory"];
type LotRow = Awaited<ReturnType<InventoryClient["lotCatalogList"]>>[number];
type SkuOption = Awaited<ReturnType<CatalogClient["skuCatalogList"]>>[number];

type LotStatus = "available" | "quarantined" | "expired" | "depleted";

interface LotFormValues {
  expiryDate: string;
  lotNumber: string;
  manufacturedDate: string;
  skuId: string;
  status: LotStatus;
}

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;
const DATE_INPUT_LENGTH = 10;
const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  depleted: "Depleted",
  expired: "Expired",
  quarantined: "Quarantined",
};
const STATUS_OPTIONS: Array<{ label: string; value: LotStatus }> = [
  { label: "Available", value: "available" },
  { label: "Quarantined", value: "quarantined" },
  { label: "Expired", value: "expired" },
  { label: "Depleted", value: "depleted" },
];

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// pg date columns serialize as "YYYY-MM-DD"; slice defensively so a value with
// a time suffix still fits an <input type="date">.
function toDateInputValue(value: string | null | undefined): string {
  return (value ?? "").slice(0, DATE_INPUT_LENGTH);
}

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
        placeholder="Search lots"
        value={value}
      />
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }
  return new Date(value).toLocaleDateString();
}

function LotDialog({
  isSaving,
  lot,
  onOpenChange,
  onSubmit,
  open,
  skus,
}: {
  isSaving: boolean;
  lot?: LotRow;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: LotFormValues) => Promise<void>;
  open: boolean;
  skus: SkuOption[];
}) {
  const [skuId, setSkuId] = useState(lot?.skuId ?? "");
  const [lotNumber, setLotNumber] = useState(lot?.lotNumber ?? "");
  const [expiryDate, setExpiryDate] = useState(
    toDateInputValue(lot?.expiryDate)
  );
  const [manufacturedDate, setManufacturedDate] = useState(
    toDateInputValue(lot?.manufacturedDate)
  );
  const [status, setStatus] = useState<LotStatus>(
    (lot?.status as LotStatus | undefined) ?? "available"
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{lot ? "Edit lot" : "New lot"}</DialogTitle>
          <DialogDescription>
            {lot
              ? "Update the lot number, dates, or status. The SKU cannot change once the lot exists."
              : "Register a batch/lot for a lot-tracked SKU so receipts and expiry tracking can reference it."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!(lot || skuId)) {
              toast.error("Choose a SKU.");
              return;
            }
            await onSubmit({
              expiryDate,
              lotNumber: lotNumber.trim(),
              manufacturedDate,
              skuId,
              status,
            });
          }}
        >
          {lot ? (
            <div className="grid gap-1">
              <Label>SKU</Label>
              <p className="text-sm">
                {lot.productName}{" "}
                <span className="font-mono text-muted-foreground text-xs">
                  {lot.skuCode}
                </span>
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label>SKU</Label>
              <Select
                onValueChange={(next) => setSkuId(next ?? "")}
                value={skuId}
              >
                <SelectTrigger aria-label="Lot SKU" className="w-full">
                  <SelectValue placeholder="Choose a SKU" />
                </SelectTrigger>
                <SelectContent>
                  {skus.map((sku) => (
                    <SelectItem key={sku.id} value={sku.id}>
                      {sku.productName} — {sku.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="lot-number">Lot number</Label>
            <Input
              autoFocus
              id="lot-number"
              minLength={1}
              onChange={(event) => setLotNumber(event.target.value)}
              placeholder="LOT-2026-001"
              required
              value={lotNumber}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="lot-expiry">Expiry date</Label>
              <Input
                id="lot-expiry"
                onChange={(event) => setExpiryDate(event.target.value)}
                type="date"
                value={expiryDate}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lot-manufactured">Manufactured date</Label>
              <Input
                id="lot-manufactured"
                onChange={(event) => setManufacturedDate(event.target.value)}
                type="date"
                value={manufacturedDate}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              onValueChange={(next) =>
                setStatus((next || "available") as LotStatus)
              }
              value={status}
            >
              <SelectTrigger aria-label="Lot status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving…" : undefined}
              {!isSaving && lot ? "Save lot" : undefined}
              {isSaving || lot ? undefined : "Create lot"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveLotDialog({
  isPending,
  lot,
  onConfirm,
  onOpenChange,
}: {
  isPending: boolean;
  lot: LotRow;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Archive this lot?</DialogTitle>
          <DialogDescription>
            Lot <span className="font-mono">{lot.lotNumber}</span> (
            {lot.productName}) will be hidden from pickers and lists. Existing
            ledger history keeps referencing it — nothing is deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Keep lot
          </Button>
          <Button
            disabled={isPending}
            onClick={onConfirm}
            type="button"
            variant="destructive"
          >
            {isPending ? "Archiving…" : "Archive lot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LotsTable({
  onArchive,
  onEdit,
  rows,
}: {
  onArchive: (row: LotRow) => void;
  onEdit: (row: LotRow) => void;
  rows: LotRow[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[220px]">Lot</TableHead>
          <TableHead className="min-w-[240px]">Product</TableHead>
          <TableHead className="min-w-[220px]">SKU</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Expiry</TableHead>
          <TableHead>Manufactured</TableHead>
          <TableHead className="text-right">Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <span className="font-mono text-sm">{row.lotNumber}</span>
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
              <Badge
                variant={row.status === "available" ? "secondary" : "outline"}
              >
                {STATUS_LABELS[row.status] ?? row.status}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm tabular-nums">
              {formatDate(row.expiryDate)}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm tabular-nums">
              {formatDate(row.manufacturedDate)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground text-sm tabular-nums">
              {new Date(row.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-2">
                <Button onClick={() => onEdit(row)} size="sm" variant="outline">
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  onClick={() => onArchive(row)}
                  size="sm"
                  variant="destructive"
                >
                  <Archive className="size-3.5" />
                  Archive
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LotsContent({
  errorMessage,
  isError,
  isLoading,
  onArchive,
  onEdit,
  onRetry,
  rows,
}: {
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  onArchive: (row: LotRow) => void;
  onEdit: (row: LotRow) => void;
  onRetry: () => void;
  rows: LotRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load lots."}
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
        description="Batch, lot, and expiry-controlled stock will appear here after receiving."
        icon={Layers}
        title="No lots found"
      />
    );
  }

  return <LotsTable onArchive={onArchive} onEdit={onEdit} rows={rows} />;
}

function LotsScreen() {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<LotRow | undefined>();
  const [archivingLot, setArchivingLot] = useState<LotRow | null>(null);
  const trimmedQuery = query.trim();
  const lots = useQuery(
    orpc.inventory.lotCatalogList.queryOptions({
      input: trimmedQuery ? { q: trimmedQuery } : {},
    })
  );
  const skus = useQuery(
    orpc.catalog.skuCatalogList.queryOptions({ input: {} })
  );
  const createLot = useMutation(orpc.inventory.lotCreate.mutationOptions());
  const updateLot = useMutation(orpc.inventory.lotUpdate.mutationOptions());
  const archiveLot = useMutation(orpc.inventory.lotArchive.mutationOptions());
  const rows = lots.data ?? [];
  const settled = !(lots.isLoading || lots.isError);
  const isSaving = createLot.isPending || updateLot.isPending;

  const handleSubmit = async (values: LotFormValues) => {
    try {
      if (editingLot) {
        await updateLot.mutateAsync({
          expiryDate: values.expiryDate || null,
          id: editingLot.id,
          lotNumber: values.lotNumber,
          manufacturedDate: values.manufacturedDate || null,
          status: values.status,
        });
        toast.success("Lot updated");
      } else {
        await createLot.mutateAsync({
          expiryDate: values.expiryDate || undefined,
          lotNumber: values.lotNumber,
          manufacturedDate: values.manufacturedDate || undefined,
          skuId: values.skuId,
          status: values.status,
        });
        toast.success("Lot created");
      }
      setDialogOpen(false);
      setEditingLot(undefined);
      await lots.refetch();
    } catch (error) {
      toast.error(errorText(error, "Could not save the lot."));
    }
  };

  const handleArchive = async () => {
    if (!archivingLot) {
      return;
    }
    try {
      await archiveLot.mutateAsync({ id: archivingLot.id });
      toast.success("Lot archived");
      setArchivingLot(null);
      await lots.refetch();
    } catch (error) {
      toast.error(errorText(error, "Could not archive the lot."));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Lots</h1>
        <p className="text-muted-foreground">
          Batch and expiry records joined to their product and SKU names.
        </p>
      </div>

      <DataTableCard
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <SearchBox onChange={setQuery} value={query} />
            <Button
              aria-label="Refresh lots"
              onClick={() => lots.refetch()}
              size="icon"
              type="button"
              variant="outline"
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button
              onClick={() => {
                setEditingLot(undefined);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              New lot
            </Button>
          </div>
        }
        count={settled ? rows.length : undefined}
        title="Lot registry"
      >
        <LotsContent
          errorMessage={lots.error?.message}
          isError={lots.isError}
          isLoading={lots.isLoading}
          onArchive={setArchivingLot}
          onEdit={(row) => {
            setEditingLot(row);
            setDialogOpen(true);
          }}
          onRetry={() => lots.refetch()}
          rows={rows}
        />
      </DataTableCard>

      {dialogOpen ? (
        <LotDialog
          isSaving={isSaving}
          key={editingLot?.id ?? "new"}
          lot={editingLot}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingLot(undefined);
            }
          }}
          onSubmit={handleSubmit}
          open={dialogOpen}
          skus={skus.data ?? []}
        />
      ) : null}
      {archivingLot ? (
        <ArchiveLotDialog
          isPending={archiveLot.isPending}
          lot={archivingLot}
          onConfirm={handleArchive}
          onOpenChange={(open) => {
            if (!open) {
              setArchivingLot(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
