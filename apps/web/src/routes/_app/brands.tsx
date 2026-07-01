import type { AppRouterClient } from "@RetailOS/api/routers/index";
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
import { Archive, BadgeCheck, Pencil, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState } from "@/components/states";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/brands")({
  component: BrandsScreen,
});

type CatalogClient = AppRouterClient["catalog"];
type BrandRow = Awaited<ReturnType<CatalogClient["brandList"]>>[number];

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;

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
        placeholder="Search brands"
        value={value}
      />
    </div>
  );
}

function BrandDialog({
  brand,
  isSaving,
  onOpenChange,
  onSubmit,
  open,
}: {
  brand?: BrandRow;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { code?: string; name: string }) => Promise<void>;
  open: boolean;
}) {
  const [name, setName] = useState(brand?.name ?? "");
  const [code, setCode] = useState(brand?.code ?? "");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{brand ? "Edit brand" : "New brand"}</DialogTitle>
          <DialogDescription>
            Brands group products for catalog browsing, filtering, and
            reporting.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit({
              code: code.trim() || undefined,
              name: name.trim(),
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="brand-name">Name</Label>
            <Input
              autoFocus
              id="brand-name"
              minLength={1}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Acme"
              required
              value={name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="brand-code">Code</Label>
            <Input
              id="brand-code"
              onChange={(event) => setCode(event.target.value)}
              placeholder="Optional short code"
              value={code}
            />
          </div>
          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving…" : undefined}
              {!isSaving && brand ? "Save brand" : undefined}
              {isSaving || brand ? undefined : "Create brand"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BrandsTable({
  onArchive,
  onEdit,
  rows,
}: {
  onArchive: (row: BrandRow) => void;
  onEdit: (row: BrandRow) => void;
  rows: BrandRow[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[260px]">Brand</TableHead>
          <TableHead>Code</TableHead>
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
                <p className="text-muted-foreground text-xs">
                  Shared catalog brand
                </p>
              </div>
            </TableCell>
            <TableCell>
              <span className="font-mono text-muted-foreground text-xs">
                {row.code ?? "-"}
              </span>
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

function BrandsContent({
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
  onArchive: (row: BrandRow) => void;
  onEdit: (row: BrandRow) => void;
  onRetry: () => void;
  rows: BrandRow[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load catalog brands."}
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
        description="Create a brand from the button above."
        icon={BadgeCheck}
        title="No brands found"
      />
    );
  }

  return <BrandsTable onArchive={onArchive} onEdit={onEdit} rows={rows} />;
}

function BrandsScreen() {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandRow | undefined>();
  const brands = useQuery(orpc.catalog.brandList.queryOptions({ input: {} }));
  const createBrand = useMutation(orpc.catalog.brandCreate.mutationOptions());
  const updateBrand = useMutation(orpc.catalog.brandUpdate.mutationOptions());
  const archiveBrand = useMutation(orpc.catalog.brandArchive.mutationOptions());

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const data = brands.data ?? [];
    if (!q) {
      return data;
    }
    return data.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        (row.code?.toLowerCase().includes(q) ?? false)
    );
  }, [brands.data, query]);
  const settled = !(brands.isLoading || brands.isError);
  const isSaving = createBrand.isPending || updateBrand.isPending;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Brands</h1>
        <p className="text-muted-foreground">
          Shared brand records used by the product catalog.
        </p>
      </div>

      <DataTableCard
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <SearchBox onChange={setQuery} value={query} />
            <Button
              onClick={() => {
                setEditingBrand(undefined);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              New brand
            </Button>
          </div>
        }
        count={settled ? rows.length : undefined}
        title="Brand catalog"
      >
        <BrandsContent
          errorMessage={brands.error?.message}
          isError={brands.isError}
          isLoading={brands.isLoading}
          onArchive={async (row) => {
            try {
              await archiveBrand.mutateAsync({ id: row.id });
              toast.success("Brand archived");
              await brands.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not archive brand."
              );
            }
          }}
          onEdit={(row) => {
            setEditingBrand(row);
            setDialogOpen(true);
          }}
          onRetry={() => brands.refetch()}
          rows={rows}
        />
      </DataTableCard>

      {dialogOpen ? (
        <BrandDialog
          brand={editingBrand}
          isSaving={isSaving}
          key={editingBrand?.id ?? "new"}
          onOpenChange={setDialogOpen}
          onSubmit={async (values) => {
            try {
              if (editingBrand) {
                await updateBrand.mutateAsync({
                  id: editingBrand.id,
                  ...values,
                });
                toast.success("Brand updated");
              } else {
                await createBrand.mutateAsync(values);
                toast.success("Brand created");
              }
              setDialogOpen(false);
              setEditingBrand(undefined);
              await brands.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Could not save brand."
              );
            }
          }}
          open={dialogOpen}
        />
      ) : null}
    </div>
  );
}
