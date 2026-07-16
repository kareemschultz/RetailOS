import { Button } from "@RetailOS/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
import { PackageSearch } from "lucide-react";
import { useMemo, useState } from "react";
import type { CatalogItem } from "../data/commerce-types";
import { ProductCard } from "./product-card";
import { StorefrontLoader } from "./storefront-loader";

type SortKey = "featured" | "price-asc" | "price-desc" | "name";

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: "Featured", value: "featured" },
  { label: "Price: low to high", value: "price-asc" },
  { label: "Price: high to low", value: "price-desc" },
  { label: "Name: A–Z", value: "name" },
];

function sortItems(items: CatalogItem[], sort: SortKey) {
  const copy = [...items];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => a.price.amountMinor - b.price.amountMinor);
    case "price-desc":
      return copy.sort((a, b) => b.price.amountMinor - a.price.amountMinor);
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return copy;
  }
}

export function CatalogListing({
  items,
  isLoading,
}: {
  items: CatalogItem[];
  isLoading: boolean;
}) {
  const [sort, setSort] = useState<SortKey>("featured");
  const [inStockOnly, setInStockOnly] = useState(false);

  const visible = useMemo(() => {
    const filtered = inStockOnly
      ? items.filter((i) => i.availability !== "out_of_stock")
      : items;
    return sortItems(filtered, sort);
  }, [items, sort, inStockOnly]);

  if (isLoading) {
    return <StorefrontLoader label="Loading products" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-border border-b pb-4">
        <p className="text-muted-foreground text-sm">
          {visible.length} {visible.length === 1 ? "product" : "products"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setInStockOnly((prev) => !prev)}
            size="sm"
            variant={inStockOnly ? "default" : "outline"}
          >
            In stock only
          </Button>
          <Select onValueChange={(v) => setSort(v as SortKey)} value={sort}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border border-dashed bg-card py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <PackageSearch className="size-6" />
          </span>
          <div>
            <p className="font-medium">No products match your filters</p>
            <p className="text-muted-foreground text-sm">
              Try turning off &ldquo;In stock only&rdquo; to see everything.
            </p>
          </div>
          <Button onClick={() => setInStockOnly(false)} variant="outline">
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((item) => (
            <ProductCard item={item} key={item.handle} />
          ))}
        </div>
      )}
    </div>
  );
}
