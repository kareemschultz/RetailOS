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
  Archive,
  Barcode,
  Pencil,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState } from "@/components/states";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/barcodes")({
  component: BarcodesScreen,
});

type CatalogClient = AppRouterClient["catalog"];
type BarcodeRow = Awaited<
  ReturnType<CatalogClient["barcodeCatalogList"]>
>[number];
type SkuOption = Awaited<ReturnType<CatalogClient["skuCatalogList"]>>[number];

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;

type Symbology = "code128" | "ean13" | "ean8" | "gs1" | "qr" | "upca";

const SYMBOLOGY_LABELS: Record<string, string> = {
  code128: "Code 128",
  ean13: "EAN-13",
  ean8: "EAN-8",
  gs1: "GS1",
  qr: "QR",
  upca: "UPC-A",
};
const SYMBOLOGY_OPTIONS: Array<{ label: string; value: Symbology }> = [
  { label: "EAN-13", value: "ean13" },
  { label: "UPC-A", value: "upca" },
  { label: "EAN-8", value: "ean8" },
  { label: "Code 128", value: "code128" },
  { label: "GS1", value: "gs1" },
  { label: "QR", value: "qr" },
];

interface BarcodeFormValues {
  isPrimary: boolean;
  skuId: string;
  symbology: Symbology;
  value: string;
}

function toSymbology(value: string | undefined): Symbology {
  const match = SYMBOLOGY_OPTIONS.find((option) => option.value === value);
  return match?.value ?? "ean13";
}

function submitLabel(isSaving: boolean, isEdit: boolean, noun: string) {
  if (isSaving) {
    return "Saving…";
  }
  return isEdit ? `Save ${noun}` : `Create ${noun}`;
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
        placeholder="Search barcodes"
        value={value}
      />
    </div>
  );
}

function BarcodeDialog({
  barcode,
  isSaving,
  onOpenChange,
  onSubmit,
  open,
  skus,
}: {
  barcode?: BarcodeRow;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: BarcodeFormValues) => Promise<void>;
  open: boolean;
  skus: SkuOption[];
}) {
  const [skuId, setSkuId] = useState(barcode?.skuId ?? "");
  const [value, setValue] = useState(barcode?.value ?? "");
  const [symbology, setSymbology] = useState<Symbology>(
    toSymbology(barcode?.symbology)
  );
  const [isPrimary, setIsPrimary] = useState(barcode?.isPrimary ?? false);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{barcode ? "Edit barcode" : "New barcode"}</DialogTitle>
          <DialogDescription>
            Barcodes map scan codes to a SKU for POS and inventory lookup.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!(barcode || skuId)) {
              toast.error("Choose a SKU for this barcode.");
              return;
            }
            await onSubmit({
              isPrimary,
              skuId,
              symbology,
              value: value.trim(),
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="barcode-sku">SKU</Label>
            {barcode ? (
              <p className="text-muted-foreground text-sm" id="barcode-sku">
                {barcode.skuName ?? barcode.skuCode}{" "}
                <span className="font-mono text-xs">
                  ({barcode.productName})
                </span>
              </p>
            ) : (
              <Select
                onValueChange={(selected) => setSkuId(selected ?? "")}
                value={skuId}
              >
                <SelectTrigger className="w-full" id="barcode-sku">
                  <SelectValue placeholder="Choose a SKU" />
                </SelectTrigger>
                <SelectContent>
                  {skus.map((sku) => (
                    <SelectItem key={sku.id} value={sku.id}>
                      {sku.code} — {sku.productName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="barcode-value">Barcode value</Label>
            <Input
              autoFocus
              id="barcode-value"
              minLength={1}
              onChange={(event) => setValue(event.target.value)}
              placeholder="0123456789012"
              required
              value={value}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="barcode-symbology">Symbology</Label>
              <Select
                onValueChange={(selected) =>
                  setSymbology(toSymbology(selected ?? undefined))
                }
                value={symbology}
              >
                <SelectTrigger className="w-full" id="barcode-symbology">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYMBOLOGY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="barcode-primary">Role</Label>
              <Select
                onValueChange={(selected) =>
                  setIsPrimary(selected === "primary")
                }
                value={isPrimary ? "primary" : "alternate"}
              >
                <SelectTrigger className="w-full" id="barcode-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="alternate">Alternate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {submitLabel(isSaving, Boolean(barcode), "barcode")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BarcodesTable({
  onArchive,
  onEdit,
  rows,
}: {
  onArchive: (row: BarcodeRow) => void;
  onEdit: (row: BarcodeRow) => void;
  rows: BarcodeRow[];
}) {
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
          <TableHead className="text-right">Actions</TableHead>
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

function BarcodesContent({
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
  onArchive: (row: BarcodeRow) => void;
  onEdit: (row: BarcodeRow) => void;
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
        description="Assign a scan code to a SKU from the button above."
        icon={Barcode}
        title="No barcodes found"
      />
    );
  }

  return <BarcodesTable onArchive={onArchive} onEdit={onEdit} rows={rows} />;
}

function BarcodesScreen() {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBarcode, setEditingBarcode] = useState<
    BarcodeRow | undefined
  >();
  const trimmedQuery = query.trim();
  const barcodes = useQuery(
    orpc.catalog.barcodeCatalogList.queryOptions({
      input: trimmedQuery ? { q: trimmedQuery } : {},
    })
  );
  const skus = useQuery(
    orpc.catalog.skuCatalogList.queryOptions({ input: {} })
  );
  const createBarcode = useMutation(
    orpc.catalog.barcodeCreate.mutationOptions()
  );
  const updateBarcode = useMutation(
    orpc.catalog.barcodeUpdate.mutationOptions()
  );
  const archiveBarcode = useMutation(
    orpc.catalog.barcodeArchive.mutationOptions()
  );
  const rows = barcodes.data ?? [];
  const settled = !(barcodes.isLoading || barcodes.isError);
  const isSaving = createBarcode.isPending || updateBarcode.isPending;

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
            <Button
              onClick={() => {
                setEditingBarcode(undefined);
                setDialogOpen(true);
              }}
              type="button"
            >
              <Plus className="size-4" />
              New barcode
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
          onArchive={async (row) => {
            try {
              await archiveBarcode.mutateAsync({ id: row.id });
              toast.success("Barcode archived");
              await barcodes.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not archive barcode."
              );
            }
          }}
          onEdit={(row) => {
            setEditingBarcode(row);
            setDialogOpen(true);
          }}
          onRetry={() => barcodes.refetch()}
          rows={rows}
        />
      </DataTableCard>
      {dialogOpen ? (
        <BarcodeDialog
          barcode={editingBarcode}
          isSaving={isSaving}
          key={editingBarcode?.id ?? "new"}
          onOpenChange={setDialogOpen}
          onSubmit={async (values) => {
            try {
              if (editingBarcode) {
                await updateBarcode.mutateAsync({
                  id: editingBarcode.id,
                  isPrimary: values.isPrimary,
                  symbology: values.symbology,
                  value: values.value,
                });
                toast.success("Barcode updated");
              } else {
                await createBarcode.mutateAsync({
                  isPrimary: values.isPrimary,
                  skuId: values.skuId,
                  symbology: values.symbology,
                  value: values.value,
                });
                toast.success("Barcode created");
              }
              setDialogOpen(false);
              setEditingBarcode(undefined);
              await barcodes.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not save barcode."
              );
            }
          }}
          open={dialogOpen}
          skus={skus.data ?? []}
        />
      ) : null}
    </div>
  );
}
