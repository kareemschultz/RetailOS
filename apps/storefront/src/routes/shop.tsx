import { Button } from "@RetailOS/ui/components/button";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { CatalogListing } from "../components/catalog-listing";
import { useCatalog, useCategories } from "../lib/commerce";

interface ShopSearch {
  category?: string;
  q?: string;
}

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    category: typeof search.category === "string" ? search.category : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: ShopPage,
});

function ShopPage() {
  const { category, q } = Route.useSearch();
  const navigate = useNavigate();
  const catalog = useCatalog(q);
  const categories = useCategories();

  const items = useMemo(() => {
    const all = catalog.data ?? [];
    return category ? all.filter((i) => i.category?.handle === category) : all;
  }, [catalog.data, category]);

  const activeCategory = (categories.data ?? []).find(
    (c) => c.handle === category
  );

  function selectCategory(next?: string) {
    navigate({
      to: "/shop",
      search: (prev: ShopSearch) => ({ ...prev, category: next }),
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-semibold text-3xl tracking-tight">
          {activeCategory?.name ?? (q ? `Results for “${q}”` : "All products")}
        </h1>
        <p className="max-w-2xl text-muted-foreground leading-relaxed">
          Thoughtfully made goods for the kitchen, table, and home — every price
          in Guyana dollars, straight from our live inventory.
        </p>
      </header>

      {categories.data && categories.data.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => selectCategory(undefined)}
            size="sm"
            variant={category ? "outline" : "default"}
          >
            All
          </Button>
          {categories.data.map((c) => (
            <Button
              key={c.handle}
              onClick={() => selectCategory(c.handle)}
              size="sm"
              variant={category === c.handle ? "default" : "outline"}
            >
              {c.name}
            </Button>
          ))}
        </div>
      ) : null}

      {items.length === 0 && !catalog.isLoading ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border border-dashed bg-card py-16 text-center">
          <p className="font-medium">Nothing here yet</p>
          <p className="text-muted-foreground text-sm">
            {q
              ? "No products matched your search."
              : "This category has no products right now."}
          </p>
          <Button render={<Link search={{}} to="/shop" />} variant="outline">
            Browse all products
          </Button>
        </div>
      ) : (
        <CatalogListing isLoading={catalog.isLoading} items={items} />
      )}
    </div>
  );
}
