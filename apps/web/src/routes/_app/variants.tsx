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
import { Archive, Pencil, Plus, RefreshCw, Search, Tags } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState } from "@/components/states";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/variants")({
  component: VariantsScreen,
});

type CatalogClient = AppRouterClient["catalog"];
type VariantRow = Awaited<
  ReturnType<CatalogClient["variantCatalogList"]>
>[number];
type ProductOption = Awaited<
  ReturnType<AppRouterClient["product"]["catalog"]>
>[number];

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;

interface VariantFormValues {
  name: string;
  productId: string;
  sortOrder: number;
  value: string;
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
        placeholder="Search variants"
        value={value}
      />
    </div>
  );
}

function VariantDialog({
  isSaving,
  onOpenChange,
  onSubmit,
  open,
  products,
  variant,
}: {
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: VariantFormValues) => Promise<void>;
  open: boolean;
  products: ProductOption[];
  variant?: VariantRow;
}) {
  const [productId, setProductId] = useState(variant?.productId ?? "");
  const [name, setName] = useState(variant?.name ?? "");
  const [value, setValue] = useState(variant?.value ?? "");
  const [sortOrder, setSortOrder] = useState(String(variant?.sortOrder ?? 0));

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{variant ? "Edit variant" : "New variant"}</DialogTitle>
          <DialogDescription>
            Variants are product option values such as size, pack, color, or
            material.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!(variant || productId)) {
              toast.error("Choose a product for this variant.");
              return;
            }
            const parsedSortOrder = Number.parseInt(sortOrder || "0", 10);
            if (!Number.isInteger(parsedSortOrder)) {
              toast.error("Sort order must be a whole number.");
              return;
            }
            await onSubmit({
              name: name.trim(),
              productId,
              sortOrder: parsedSortOrder,
              value: value.trim(),
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="variant-product">Product</Label>
            {variant ? (
              <p className="text-muted-foreground text-sm" id="variant-product">
                {variant.productName}{" "}
                <span className="font-mono text-xs">
                  ({variant.productSku})
                </span>
              </p>
            ) : (
              <Select
                onValueChange={(selected) => setProductId(selected ?? "")}
                value={productId}
              >
                <SelectTrigger className="w-full" id="variant-product">
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
              <Label htmlFor="variant-name">Option</Label>
              <Input
                autoFocus
                id="variant-name"
                minLength={1}
                onChange={(event) => setName(event.target.value)}
                placeholder="Size"
                required
                value={name}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="variant-value">Value</Label>
              <Input
                id="variant-value"
                minLength={1}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Large"
                required
                value={value}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="variant-sort-order">Sort order</Label>
            <Input
              id="variant-sort-order"
              onChange={(event) => setSortOrder(event.target.value)}
              required
              step={1}
              type="number"
              value={sortOrder}
            />
          </div>
          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {submitLabel(isSaving, Boolean(variant), "variant")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VariantsTable({
  onArchive,
  onEdit,
  rows,
}: {
  onArchive: (row: VariantRow) => void;
  onEdit: (row: VariantRow) => void;
  rows: VariantRow[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[220px]">Option</TableHead>
          <TableHead className="min-w-[220px]">Product</TableHead>
          <TableHead>Value</TableHead>
          <TableHead className="text-right">Sort</TableHead>
          <TableHead className="text-right">Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Badge variant="secondary">{row.name}</Badge>
            </TableCell>
            <TableCell>
              <div className="min-w-0">
                <p className="truncate font-medium">{row.productName}</p>
                <p className="font-mono text-muted-foreground text-xs">
                  {row.productSku}
                </p>
              </div>
            </TableCell>
            <TableCell className="font-medium">{row.value}</TableCell>
            <TableCell className="text-right font-mono text-muted-foreground text-sm tabular-nums">
              {row.sortOrder}
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

function VariantsContent({
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
  onArchive: (row: VariantRow) => void;
  onEdit: (row: VariantRow) => void;
  onRetry: () => void;
  rows: VariantRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load catalog variants."}
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
        description="Create product options such as size, pack, color, or material from the button above."
        icon={Tags}
        title="No variants found"
      />
    );
  }

  return <VariantsTable onArchive={onArchive} onEdit={onEdit} rows={rows} />;
}

function VariantsScreen() {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<
    VariantRow | undefined
  >();
  const trimmedQuery = query.trim();
  const variants = useQuery(
    orpc.catalog.variantCatalogList.queryOptions({
      input: trimmedQuery ? { q: trimmedQuery } : {},
    })
  );
  const products = useQuery(orpc.product.catalog.queryOptions({ input: {} }));
  const createVariant = useMutation(
    orpc.catalog.variantCreate.mutationOptions()
  );
  const updateVariant = useMutation(
    orpc.catalog.variantUpdate.mutationOptions()
  );
  const archiveVariant = useMutation(
    orpc.catalog.variantArchive.mutationOptions()
  );
  const rows = variants.data ?? [];
  const settled = !(variants.isLoading || variants.isError);
  const isSaving = createVariant.isPending || updateVariant.isPending;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Variants</h1>
        <p className="text-muted-foreground">
          Product option values joined to their catalog products.
        </p>
      </div>

      <DataTableCard
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <SearchBox onChange={setQuery} value={query} />
            <Button
              aria-label="Refresh variants"
              onClick={() => variants.refetch()}
              size="icon"
              type="button"
              variant="outline"
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button
              onClick={() => {
                setEditingVariant(undefined);
                setDialogOpen(true);
              }}
              type="button"
            >
              <Plus className="size-4" />
              New variant
            </Button>
          </div>
        }
        count={settled ? rows.length : undefined}
        title="Variant registry"
      >
        <VariantsContent
          errorMessage={variants.error?.message}
          isError={variants.isError}
          isLoading={variants.isLoading}
          onArchive={async (row) => {
            try {
              await archiveVariant.mutateAsync({ id: row.id });
              toast.success("Variant archived");
              await variants.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not archive variant."
              );
            }
          }}
          onEdit={(row) => {
            setEditingVariant(row);
            setDialogOpen(true);
          }}
          onRetry={() => variants.refetch()}
          rows={rows}
        />
      </DataTableCard>
      {dialogOpen ? (
        <VariantDialog
          isSaving={isSaving}
          key={editingVariant?.id ?? "new"}
          onOpenChange={setDialogOpen}
          onSubmit={async (values) => {
            try {
              if (editingVariant) {
                await updateVariant.mutateAsync({
                  id: editingVariant.id,
                  name: values.name,
                  sortOrder: values.sortOrder,
                  value: values.value,
                });
                toast.success("Variant updated");
              } else {
                await createVariant.mutateAsync({
                  name: values.name,
                  productId: values.productId,
                  sortOrder: values.sortOrder,
                  value: values.value,
                });
                toast.success("Variant created");
              }
              setDialogOpen(false);
              setEditingVariant(undefined);
              await variants.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not save variant."
              );
            }
          }}
          open={dialogOpen}
          products={products.data ?? []}
          variant={editingVariant}
        />
      ) : null}
    </div>
  );
}
