import { Badge } from "@RetailOS/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import { Input } from "@RetailOS/ui/components/input";
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
import { createFileRoute, Link } from "@tanstack/react-router";
import { ImageIcon, Package, Search, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/products")({
  component: ProductsScreen,
});

const TRACKING_LABELS: Record<string, string> = {
  none: "Standard",
  lot: "Lot / batch",
  serial: "Serial",
};

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

function CatalogContent({
  isLoading,
  isError,
  errorMessage,
  rows,
  query,
}: {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  rows: ProductRow[];
  query: string;
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
            : "Add products to start selling."}
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ProductsScreen() {
  const [query, setQuery] = useState("");
  // product.catalog returns a display-safe DTO (no internal costing/policy fields).
  const products = useQuery(orpc.product.catalog.queryOptions({ input: {} }));

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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Products</h1>
          <p className="text-muted-foreground">
            Your shared catalog — the same items POS and inventory draw from.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 rounded-lg pl-9"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or SKU…"
            value={query}
          />
        </div>
      </div>

      <Card className="overflow-hidden p-0 shadow-sm">
        <CardHeader className="border-b">
          <CardTitle>Catalog</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <CatalogContent
            errorMessage={products.error?.message}
            isError={products.isError}
            isLoading={products.isLoading}
            query={query}
            rows={filtered}
          />
        </CardContent>
      </Card>

      {!(products.isLoading || products.isError) && filtered.length > 0 ? (
        <p className="text-muted-foreground text-sm">
          {filtered.length} product{filtered.length === 1 ? "" : "s"}
          {query ? ` matching “${query}”` : ""}
        </p>
      ) : null}
    </div>
  );
}
