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
import { Archive, FolderTree, Pencil, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState } from "@/components/states";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/categories")({
  component: CategoriesScreen,
});

type CatalogClient = AppRouterClient["catalog"];
type CategoryRow = Awaited<ReturnType<CatalogClient["categoryList"]>>[number];
type CostingMethod = "avco" | "fifo";
type TrackingMode = "none" | "lot" | "serial";

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;
const TRACKING_LABELS: Record<string, string> = {
  expiry: "Expiry",
  lot: "Lot",
  mixed: "Mixed",
  none: "Standard",
  serial: "Serial",
};
const COSTING_OPTIONS: Array<{ label: string; value: CostingMethod }> = [
  { label: "Average cost (AVCO)", value: "avco" },
  { label: "FIFO", value: "fifo" },
];
const TRACKING_OPTIONS: Array<{ label: string; value: TrackingMode }> = [
  { label: "Standard", value: "none" },
  { label: "Lot / batch", value: "lot" },
  { label: "Serial", value: "serial" },
];

function SearchBox({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-9 rounded-lg pl-9"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search categories"
        value={value}
      />
    </div>
  );
}

function CategoryDialog({
  category,
  isSaving,
  onOpenChange,
  onSubmit,
  open,
}: {
  category?: CategoryRow;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: {
    code?: string;
    costingMethod?: CostingMethod;
    name: string;
    trackingMode?: TrackingMode;
  }) => Promise<void>;
  open: boolean;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [code, setCode] = useState(category?.code ?? "");
  const [costingMethod, setCostingMethod] = useState<CostingMethod>(
    (category?.costingMethod as CostingMethod | null) ?? "avco"
  );
  const [trackingMode, setTrackingMode] = useState<TrackingMode>(
    (category?.trackingMode as TrackingMode | null) ?? "none"
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {category ? "Edit category" : "New category"}
          </DialogTitle>
          <DialogDescription>
            Create the product taxonomy operators use when adding catalog items.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit({
              code: code.trim() || undefined,
              costingMethod,
              name: name.trim(),
              trackingMode,
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              autoFocus
              id="category-name"
              minLength={1}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Beverages"
              required
              value={name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category-code">Code</Label>
            <Input
              id="category-code"
              onChange={(event) => setCode(event.target.value)}
              placeholder="Optional short code"
              value={code}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Costing</Label>
              <Select
                onValueChange={(value) =>
                  setCostingMethod((value ?? "avco") as CostingMethod)
                }
                value={costingMethod}
              >
                <SelectTrigger className="w-full">
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
              <Label>Tracking</Label>
              <Select
                onValueChange={(value) =>
                  setTrackingMode((value ?? "none") as TrackingMode)
                }
                value={trackingMode}
              >
                <SelectTrigger className="w-full">
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
          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving…" : undefined}
              {!isSaving && category ? "Save category" : undefined}
              {isSaving || category ? undefined : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoriesTable({
  onArchive,
  onEdit,
  parentNames,
  rows,
}: {
  onArchive: (row: CategoryRow) => void;
  onEdit: (row: CategoryRow) => void;
  parentNames: Map<string, string>;
  rows: CategoryRow[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[260px]">Category</TableHead>
          <TableHead>Code</TableHead>
          <TableHead>Costing</TableHead>
          <TableHead>Tracking</TableHead>
          <TableHead className="text-right">Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="min-w-0">
                <p className="truncate font-medium">{row.name}</p>
                <p className="font-mono text-muted-foreground text-xs">
                  {row.parentCategoryId
                    ? (parentNames.get(row.parentCategoryId) ?? "Parent hidden")
                    : "Root category"}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <span className="font-mono text-muted-foreground text-xs">
                {row.code ?? "-"}
              </span>
            </TableCell>
            <TableCell>
              {row.costingMethod ? (
                <Badge variant="secondary">
                  {row.costingMethod.toUpperCase()}
                </Badge>
              ) : (
                <span className="text-muted-foreground">Inherited</span>
              )}
            </TableCell>
            <TableCell>
              <Badge variant="outline">
                {row.trackingMode
                  ? (TRACKING_LABELS[row.trackingMode] ?? row.trackingMode)
                  : "Inherited"}
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

function CategoriesContent({
  errorMessage,
  isError,
  isLoading,
  onArchive,
  onEdit,
  onRetry,
  parentNames,
  rows,
}: {
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  onArchive: (row: CategoryRow) => void;
  onEdit: (row: CategoryRow) => void;
  onRetry: () => void;
  parentNames: Map<string, string>;
  rows: CategoryRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load catalog categories."}
          onRetry={onRetry}
        />
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex flex-col gap-px">
        {SKELETON_KEYS.map((key) => (
          <Skeleton className="h-[60px] rounded-none" key={key} />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        description="Create a category from the button above."
        icon={FolderTree}
        title="No categories found"
      />
    );
  }
  return (
    <CategoriesTable
      onArchive={onArchive}
      onEdit={onEdit}
      parentNames={parentNames}
      rows={rows}
    />
  );
}

function CategoriesScreen() {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<
    CategoryRow | undefined
  >();
  const categories = useQuery(
    orpc.catalog.categoryList.queryOptions({ input: {} })
  );
  const createCategory = useMutation(
    orpc.catalog.categoryCreate.mutationOptions()
  );
  const updateCategory = useMutation(
    orpc.catalog.categoryUpdate.mutationOptions()
  );
  const archiveCategory = useMutation(
    orpc.catalog.categoryArchive.mutationOptions()
  );
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const data = categories.data ?? [];
    if (!q) {
      return data;
    }
    return data.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        (row.code?.toLowerCase().includes(q) ?? false)
    );
  }, [categories.data, query]);
  const parentNames = useMemo(
    () => new Map((categories.data ?? []).map((row) => [row.id, row.name])),
    [categories.data]
  );
  const settled = !(categories.isLoading || categories.isError);
  const isSaving = createCategory.isPending || updateCategory.isPending;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Categories</h1>
        <p className="text-muted-foreground">
          Catalog taxonomy and inherited stock policy defaults.
        </p>
      </div>
      <DataTableCard
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <SearchBox onChange={setQuery} value={query} />
            <Button
              onClick={() => {
                setEditingCategory(undefined);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              New category
            </Button>
          </div>
        }
        count={settled ? rows.length : undefined}
        title="Category taxonomy"
      >
        <CategoriesContent
          errorMessage={categories.error?.message}
          isError={categories.isError}
          isLoading={categories.isLoading}
          onArchive={async (row) => {
            try {
              await archiveCategory.mutateAsync({ id: row.id });
              toast.success("Category archived");
              await categories.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not archive category."
              );
            }
          }}
          onEdit={(row) => {
            setEditingCategory(row);
            setDialogOpen(true);
          }}
          onRetry={() => categories.refetch()}
          parentNames={parentNames}
          rows={rows}
        />
      </DataTableCard>
      {dialogOpen ? (
        <CategoryDialog
          category={editingCategory}
          isSaving={isSaving}
          key={editingCategory?.id ?? "new"}
          onOpenChange={setDialogOpen}
          onSubmit={async (values) => {
            try {
              if (editingCategory) {
                await updateCategory.mutateAsync({
                  id: editingCategory.id,
                  ...values,
                });
                toast.success("Category updated");
              } else {
                await createCategory.mutateAsync(values);
                toast.success("Category created");
              }
              setDialogOpen(false);
              setEditingCategory(undefined);
              await categories.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not save category."
              );
            }
          }}
          open={dialogOpen}
        />
      ) : null}
    </div>
  );
}
