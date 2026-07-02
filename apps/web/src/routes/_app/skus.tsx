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

export const Route = createFileRoute("/_app/skus")({
  component: SkusScreen,
});

type CatalogClient = AppRouterClient["catalog"];
type SkuRow = Awaited<ReturnType<CatalogClient["skuCatalogList"]>>[number];
type UomRow = Awaited<ReturnType<CatalogClient["uomList"]>>[number];
type ProductOption = Awaited<
  ReturnType<AppRouterClient["product"]["catalog"]>
>[number];

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;
const TRACKING_LABELS: Record<string, string> = {
  expiry: "Expiry",
  lot: "Lot",
  mixed: "Mixed",
  none: "None",
  serial: "Serial",
};
const COSTING_LABELS: Record<string, string> = {
  avco: "AVCO",
  fifo: "FIFO",
};

const INHERITED = "inherited";

type EditableTracking = "lot" | "none" | "serial";
type CostingMethod = "avco" | "fifo";

const TRACKING_OPTIONS: Array<{ label: string; value: EditableTracking }> = [
  { label: "None", value: "none" },
  { label: "Lot / batch", value: "lot" },
  { label: "Serial", value: "serial" },
];
const COSTING_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Inherited", value: INHERITED },
  { label: "AVCO", value: "avco" },
  { label: "FIFO", value: "fifo" },
];

interface SkuFormValues {
  baseUomId: string | null;
  code: string;
  costingMethod: CostingMethod | null;
  isActive: boolean;
  name: string | null;
  productId: string;
  trackingMode: EditableTracking;
}

function toEditableTracking(value: string | undefined): EditableTracking {
  if (value === "lot" || value === "serial") {
    return value;
  }
  return "none";
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
        placeholder="Search SKUs"
        value={value}
      />
    </div>
  );
}

function SkuDialog({
  isSaving,
  onOpenChange,
  onSubmit,
  open,
  products,
  sku,
  uoms,
}: {
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: SkuFormValues) => Promise<void>;
  open: boolean;
  products: ProductOption[];
  sku?: SkuRow;
  uoms: UomRow[];
}) {
  const initialBaseUomId =
    uoms.find((unit) => unit.code === sku?.baseUomCode)?.id ?? INHERITED;
  const [productId, setProductId] = useState(sku?.productId ?? "");
  const [code, setCode] = useState(sku?.code ?? "");
  const [name, setName] = useState(sku?.name ?? "");
  const [baseUomId, setBaseUomId] = useState(initialBaseUomId);
  const [costingMethod, setCostingMethod] = useState(
    sku?.costingMethod ?? INHERITED
  );
  const [trackingMode, setTrackingMode] = useState<EditableTracking>(
    toEditableTracking(sku?.trackingMode)
  );
  const [isActive, setIsActive] = useState(sku ? sku.isActive : true);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{sku ? "Edit SKU" : "New SKU"}</DialogTitle>
          <DialogDescription>
            SKUs are the sellable and stockable units under a catalog product.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!(sku || productId)) {
              toast.error("Choose a product for this SKU.");
              return;
            }
            const trimmedName = name.trim();
            await onSubmit({
              baseUomId: baseUomId === INHERITED ? null : baseUomId,
              code: code.trim(),
              costingMethod:
                costingMethod === INHERITED
                  ? null
                  : (costingMethod as CostingMethod),
              isActive,
              name: trimmedName ? trimmedName : null,
              productId,
              trackingMode,
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="sku-product">Product</Label>
            {sku ? (
              <p className="text-muted-foreground text-sm" id="sku-product">
                {sku.productName}{" "}
                <span className="font-mono text-xs">({sku.productSku})</span>
              </p>
            ) : (
              <Select
                onValueChange={(value) => setProductId(value ?? "")}
                value={productId}
              >
                <SelectTrigger className="w-full" id="sku-product">
                  <SelectValue placeholder="Choose a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="sku-code">Code</Label>
              <Input
                autoFocus
                id="sku-code"
                minLength={1}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="SKU-001-EA"
                required
                value={code}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sku-name">Name (optional)</Label>
              <Input
                id="sku-name"
                onChange={(event) => setName(event.target.value)}
                placeholder="Single unit"
                value={name}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sku-base-uom">Base unit</Label>
            <Select
              onValueChange={(value) => setBaseUomId(value ?? INHERITED)}
              value={baseUomId}
            >
              <SelectTrigger className="w-full" id="sku-base-uom">
                <SelectValue placeholder="Inherited" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={INHERITED}>Inherited</SelectItem>
                {uoms.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.code} — {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="sku-costing">Costing</Label>
              <Select
                onValueChange={(value) => setCostingMethod(value ?? INHERITED)}
                value={costingMethod}
              >
                <SelectTrigger className="w-full" id="sku-costing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COSTING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sku-tracking">Tracking</Label>
              <Select
                onValueChange={(value) =>
                  setTrackingMode((value ?? "none") as EditableTracking)
                }
                value={trackingMode}
              >
                <SelectTrigger className="w-full" id="sku-tracking">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRACKING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {sku ? (
            <div className="grid gap-2">
              <Label htmlFor="sku-status">Status</Label>
              <Select
                onValueChange={(value) => setIsActive(value !== "inactive")}
                value={isActive ? "active" : "inactive"}
              >
                <SelectTrigger className="w-full" id="sku-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {submitLabel(isSaving, Boolean(sku), "SKU")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SkusTable({
  onArchive,
  onEdit,
  rows,
}: {
  onArchive: (row: SkuRow) => void;
  onEdit: (row: SkuRow) => void;
  rows: SkuRow[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[260px]">SKU</TableHead>
          <TableHead className="min-w-[220px]">Product</TableHead>
          <TableHead>Tracking</TableHead>
          <TableHead>Costing</TableHead>
          <TableHead>Base unit</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="min-w-0">
                <p className="truncate font-medium">{row.name ?? row.code}</p>
                <p className="font-mono text-muted-foreground text-xs">
                  {row.code}
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
              <Badge variant="secondary">
                {TRACKING_LABELS[row.trackingMode] ?? row.trackingMode}
              </Badge>
            </TableCell>
            <TableCell>
              {row.costingMethod ? (
                <Badge variant="outline">
                  {COSTING_LABELS[row.costingMethod] ?? row.costingMethod}
                </Badge>
              ) : (
                <span className="text-muted-foreground text-sm">Inherited</span>
              )}
            </TableCell>
            <TableCell>
              {row.baseUomCode ? (
                <span className="font-mono text-muted-foreground text-xs">
                  {row.baseUomCode}
                </span>
              ) : (
                <span className="text-muted-foreground text-sm">Inherited</span>
              )}
            </TableCell>
            <TableCell>
              <Badge variant={row.isActive ? "secondary" : "destructive"}>
                {row.isActive ? "Active" : "Inactive"}
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

function SkusContent({
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
  onArchive: (row: SkuRow) => void;
  onEdit: (row: SkuRow) => void;
  onRetry: () => void;
  rows: SkuRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load catalog SKUs."}
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
        description="Create a SKU from the button above to make a product sellable and stockable."
        icon={Barcode}
        title="No SKUs found"
      />
    );
  }

  return <SkusTable onArchive={onArchive} onEdit={onEdit} rows={rows} />;
}

function SkusScreen() {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSku, setEditingSku] = useState<SkuRow | undefined>();
  const trimmedQuery = query.trim();
  const skus = useQuery(
    orpc.catalog.skuCatalogList.queryOptions({
      input: trimmedQuery ? { q: trimmedQuery } : {},
    })
  );
  const products = useQuery(orpc.product.catalog.queryOptions({ input: {} }));
  const uoms = useQuery(orpc.catalog.uomList.queryOptions({ input: {} }));
  const createSku = useMutation(orpc.catalog.skuCreate.mutationOptions());
  const updateSku = useMutation(orpc.catalog.skuUpdate.mutationOptions());
  const archiveSku = useMutation(orpc.catalog.skuArchive.mutationOptions());
  const rows = skus.data ?? [];
  const settled = !(skus.isLoading || skus.isError);
  const isSaving = createSku.isPending || updateSku.isPending;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">SKUs</h1>
        <p className="text-muted-foreground">
          Sellable and stockable SKU records joined to their catalog products.
        </p>
      </div>

      <DataTableCard
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <SearchBox onChange={setQuery} value={query} />
            <Button
              aria-label="Refresh SKUs"
              onClick={() => skus.refetch()}
              size="icon"
              type="button"
              variant="outline"
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button
              onClick={() => {
                setEditingSku(undefined);
                setDialogOpen(true);
              }}
              type="button"
            >
              <Plus className="size-4" />
              New SKU
            </Button>
          </div>
        }
        count={settled ? rows.length : undefined}
        title="SKU catalog"
      >
        <SkusContent
          errorMessage={skus.error?.message}
          isError={skus.isError}
          isLoading={skus.isLoading}
          onArchive={async (row) => {
            try {
              await archiveSku.mutateAsync({ id: row.id });
              toast.success("SKU archived");
              await skus.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not archive SKU."
              );
            }
          }}
          onEdit={(row) => {
            setEditingSku(row);
            setDialogOpen(true);
          }}
          onRetry={() => skus.refetch()}
          rows={rows}
        />
      </DataTableCard>
      {dialogOpen ? (
        <SkuDialog
          isSaving={isSaving}
          key={editingSku?.id ?? "new"}
          onOpenChange={setDialogOpen}
          onSubmit={async (values) => {
            try {
              if (editingSku) {
                await updateSku.mutateAsync({
                  baseUomId: values.baseUomId,
                  code: values.code,
                  costingMethod: values.costingMethod,
                  id: editingSku.id,
                  isActive: values.isActive,
                  name: values.name,
                  trackingMode: values.trackingMode,
                });
                toast.success("SKU updated");
              } else {
                await createSku.mutateAsync({
                  baseUomId: values.baseUomId ?? undefined,
                  code: values.code,
                  costingMethod: values.costingMethod ?? undefined,
                  name: values.name ?? undefined,
                  productId: values.productId,
                  trackingMode: values.trackingMode,
                });
                toast.success("SKU created");
              }
              setDialogOpen(false);
              setEditingSku(undefined);
              await skus.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Could not save SKU."
              );
            }
          }}
          open={dialogOpen}
          products={products.data ?? []}
          sku={editingSku}
          uoms={uoms.data ?? []}
        />
      ) : null}
    </div>
  );
}
