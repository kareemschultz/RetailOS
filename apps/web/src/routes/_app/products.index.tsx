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
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Archive,
  ImageIcon,
  Package,
  Pencil,
  Plus,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/products/")({
  component: ProductsScreen,
});

type TrackingMode = "none" | "lot" | "serial";

const TRACKING_LABELS: Record<string, string> = {
  none: "Standard",
  lot: "Lot / batch",
  serial: "Serial",
};
const TRACKING_OPTIONS: Array<{ label: string; value: TrackingMode }> = [
  { label: "Standard", value: "none" },
  { label: "Lot / batch", value: "lot" },
  { label: "Serial", value: "serial" },
];

interface ProductRow {
  currency: string;
  id: string;
  name: string;
  priceMinor: number;
  primaryImageAltText: string | null;
  primaryImageUrl: string | null;
  scale: number;
  sku: string;
  trackingMode: string;
}

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;

function minorToDisplay(minor: number, scale: number) {
  return (minor / 10 ** scale).toFixed(scale);
}

function displayToMinor(value: string, scale: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 10 ** scale);
}

function ProductThumb({ product }: { product: ProductRow }) {
  if (product.primaryImageUrl) {
    return (
      <img
        alt={product.primaryImageAltText ?? product.name}
        className="size-11 rounded-lg border object-cover"
        height={44}
        src={product.primaryImageUrl}
        width={44}
      />
    );
  }
  return (
    <div className="flex size-11 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
      <ImageIcon className="size-4" />
    </div>
  );
}

function ProductDialog({
  isSaving,
  onOpenChange,
  onSubmit,
  open,
  product,
}: {
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: {
    currency: string;
    name: string;
    priceMinor: number;
    scale: number;
    sku: string;
    trackingMode: TrackingMode;
  }) => Promise<void>;
  open: boolean;
  product?: ProductRow;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [currency, setCurrency] = useState(product?.currency ?? "GYD");
  const [scale, setScale] = useState(String(product?.scale ?? 2));
  const [price, setPrice] = useState(
    product ? minorToDisplay(product.priceMinor, product.scale) : "0.00"
  );
  const [trackingMode, setTrackingMode] = useState<TrackingMode>(
    (product?.trackingMode as TrackingMode | undefined) ?? "none"
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            Create sellable catalog items for POS and inventory. More detailed
            brand/category/media settings remain on the product detail page.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const parsedScale = Number.parseInt(scale || "2", 10);
            const priceMinor = displayToMinor(price, parsedScale);
            if (!Number.isInteger(parsedScale) || parsedScale < 0) {
              toast.error("Scale must be a whole number.");
              return;
            }
            if (priceMinor == null) {
              toast.error("Enter a valid non-negative price.");
              return;
            }
            await onSubmit({
              currency: currency.trim().toUpperCase(),
              name: name.trim(),
              priceMinor,
              scale: parsedScale,
              sku: sku.trim(),
              trackingMode,
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="product-name">Name</Label>
            <Input
              autoFocus
              id="product-name"
              minLength={1}
              onChange={(event) => setName(event.target.value)}
              placeholder="Product name"
              required
              value={name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="product-sku">SKU</Label>
            <Input
              id="product-sku"
              minLength={1}
              onChange={(event) => setSku(event.target.value.toUpperCase())}
              placeholder="SKU-001"
              required
              value={sku}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_5rem_6rem]">
            <div className="grid gap-2">
              <Label htmlFor="product-price">Price</Label>
              <Input
                id="product-price"
                min={0}
                onChange={(event) => setPrice(event.target.value)}
                required
                step="0.01"
                type="number"
                value={price}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-currency">Currency</Label>
              <Input
                id="product-currency"
                maxLength={3}
                minLength={3}
                onChange={(event) =>
                  setCurrency(event.target.value.toUpperCase())
                }
                required
                value={currency}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-scale">Scale</Label>
              <Input
                id="product-scale"
                min={0}
                onChange={(event) => setScale(event.target.value)}
                required
                type="number"
                value={scale}
              />
            </div>
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
          <DialogFooter>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving…" : undefined}
              {!isSaving && product ? "Save product" : undefined}
              {isSaving || product ? undefined : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CatalogContent({
  errorMessage,
  isError,
  isLoading,
  onArchive,
  onEdit,
  query,
  rows,
}: {
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  onArchive: (row: ProductRow) => void;
  onEdit: (row: ProductRow) => void;
  query: string;
  rows: ProductRow[];
}) {
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-5" />
        </div>
        <p className="font-medium">Couldn’t load products</p>
        <p className="text-muted-foreground text-sm">
          {errorMessage ?? "Check your connection or permissions and retry."}
        </p>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex flex-col gap-px">
        {SKELETON_KEYS.map((k) => (
          <Skeleton className="h-[68px] rounded-none" key={k} />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Package className="size-5" />
        </div>
        <p className="font-medium">No products found</p>
        <p className="text-muted-foreground text-sm">
          {query
            ? "Try a different search term."
            : "Create a product from the button above."}
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[280px]">Product</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead>Tracking</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p) => (
          <TableRow key={p.id}>
            <TableCell>
              <div className="flex min-w-0 items-center gap-3">
                <ProductThumb product={p} />
                <div className="min-w-0">
                  <Link
                    className="truncate font-medium hover:text-primary hover:underline"
                    params={{ productId: p.id }}
                    to="/products/$productId"
                  >
                    {p.name}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    Shared catalog item
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <span className="font-mono text-muted-foreground text-xs">
                {p.sku}
              </span>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">
                {TRACKING_LABELS[p.trackingMode] ?? p.trackingMode}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-medium font-mono">
              {formatMoney(p.priceMinor, p.currency, p.scale)}
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-2">
                <Button onClick={() => onEdit(p)} size="sm" variant="outline">
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  onClick={() => onArchive(p)}
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

function ProductsScreen() {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<
    ProductRow | undefined
  >();
  const products = useQuery(orpc.product.catalog.queryOptions({ input: {} }));
  const createProduct = useMutation(orpc.product.create.mutationOptions());
  const updateProduct = useMutation(orpc.product.update.mutationOptions());
  const archiveProduct = useMutation(orpc.product.archive.mutationOptions());
  const filtered = useMemo(() => {
    const rows = products.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products.data, query]);
  const settled = !(products.isLoading || products.isError);
  const isSaving = createProduct.isPending || updateProduct.isPending;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Products</h1>
        <p className="text-muted-foreground">
          Your shared catalog — the same items POS and inventory draw from.
        </p>
      </div>
      <DataTableCard
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="relative w-full sm:w-64">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 rounded-lg pl-9"
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or SKU…"
                value={query}
              />
            </div>
            <Button
              onClick={() => {
                setEditingProduct(undefined);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              New product
            </Button>
          </div>
        }
        count={settled ? filtered.length : undefined}
        footer={
          settled && filtered.length > 0
            ? `${filtered.length} product${filtered.length === 1 ? "" : "s"}${query ? ` matching “${query}”` : ""}`
            : undefined
        }
        title="Catalog"
      >
        <CatalogContent
          errorMessage={products.error?.message}
          isError={products.isError}
          isLoading={products.isLoading}
          onArchive={async (row) => {
            try {
              await archiveProduct.mutateAsync({ id: row.id });
              toast.success("Product archived");
              await products.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not archive product."
              );
            }
          }}
          onEdit={(row) => {
            setEditingProduct(row);
            setDialogOpen(true);
          }}
          query={query}
          rows={filtered}
        />
      </DataTableCard>
      {dialogOpen ? (
        <ProductDialog
          isSaving={isSaving}
          key={editingProduct?.id ?? "new"}
          onOpenChange={setDialogOpen}
          onSubmit={async (values) => {
            try {
              if (editingProduct) {
                await updateProduct.mutateAsync({
                  id: editingProduct.id,
                  ...values,
                });
                toast.success("Product updated");
              } else {
                await createProduct.mutateAsync({
                  ...values,
                  costingMethod: "avco",
                });
                toast.success("Product created");
              }
              setDialogOpen(false);
              setEditingProduct(undefined);
              await products.refetch();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not save product."
              );
            }
          }}
          open={dialogOpen}
          product={editingProduct}
        />
      ) : null}
    </div>
  );
}
