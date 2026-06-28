import { Badge } from "@RetailOS/ui/components/badge";
import { Card } from "@RetailOS/ui/components/card";
import { Input } from "@RetailOS/ui/components/input";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Package, Search } from "lucide-react";
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
  scale: number;
  sku: string;
  trackingMode: string;
}

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;

function CatalogContent({
  isLoading,
  rows,
  query,
}: {
  isLoading: boolean;
  rows: ProductRow[];
  query: string;
}) {
  if (isLoading) {
    return (
      <div className="space-y-px">
        {SKELETON_KEYS.map((k) => (
          <Skeleton className="h-14 rounded-none" key={k} />
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="px-5 py-3 font-medium">Product</th>
            <th className="px-5 py-3 font-medium">SKU</th>
            <th className="px-5 py-3 font-medium">Tracking</th>
            <th className="px-5 py-3 text-right font-medium">Price</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr className="border-b last:border-0 hover:bg-muted/40" key={p.id}>
              <td className="px-5 py-3 font-medium">{p.name}</td>
              <td className="px-5 py-3 font-mono text-muted-foreground text-xs">
                {p.sku}
              </td>
              <td className="px-5 py-3">
                <Badge variant="secondary">
                  {TRACKING_LABELS[p.trackingMode] ?? p.trackingMode}
                </Badge>
              </td>
              <td className="px-5 py-3 text-right font-medium font-mono">
                {formatMoney(p.priceMinor, p.currency, p.scale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductsScreen() {
  const [query, setQuery] = useState("");
  const products = useQuery(orpc.product.list.queryOptions({ input: {} }));

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
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
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
        <CatalogContent
          isLoading={products.isLoading}
          query={query}
          rows={filtered}
        />
      </Card>

      {!products.isLoading && filtered.length > 0 ? (
        <p className="text-muted-foreground text-sm">
          {filtered.length} product{filtered.length === 1 ? "" : "s"}
          {query ? ` matching “${query}”` : ""}
        </p>
      ) : null}
    </div>
  );
}
