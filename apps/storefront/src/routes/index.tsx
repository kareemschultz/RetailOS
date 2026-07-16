import { Button } from "@RetailOS/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { HomeHero } from "../components/home-hero";
import { ProductCard } from "../components/product-card";
import { StorefrontLoader } from "../components/storefront-loader";
import { FEATURED_HANDLES } from "../data/catalog";
import { useCatalog, useCategories } from "../lib/commerce";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const TRUST = [
  {
    description: "Free delivery in Georgetown on orders over G$15,000.",
    icon: Truck,
    title: "Fast local delivery",
  },
  {
    description: "Every item is stocked and fulfilled from our own warehouse.",
    icon: PackageCheck,
    title: "Real inventory",
  },
  {
    description: "Secure checkout with cash, card, and mobile money.",
    icon: ShieldCheck,
    title: "Safe payments",
  },
];

function HomePage() {
  const catalog = useCatalog();
  const categories = useCategories();

  const items = catalog.data ?? [];
  const featured = items.filter((i) => FEATURED_HANDLES.includes(i.handle));
  const fresh = items.slice(0, 8);

  return (
    <div className="flex flex-col gap-16 pb-16">
      <HomeHero />

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 sm:grid-cols-3">
        {TRUST.map((item) => (
          <div
            className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5"
            key={item.title}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <item.icon className="size-5" />
            </span>
            <div>
              <p className="font-medium text-sm">{item.title}</p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </section>

      {categories.data && categories.data.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4">
          <div className="mb-6">
            <h2 className="font-semibold text-2xl tracking-tight">
              Shop by category
            </h2>
            <p className="text-muted-foreground">
              Appliances and electronics for every room.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.data.map((category) => (
              <Link
                className="group flex flex-col justify-end rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent"
                key={category.handle}
                search={{ category: category.handle }}
                to="/shop"
              >
                <span className="font-medium">{category.name}</span>
                <span className="mt-1 inline-flex items-center gap-1 text-muted-foreground text-sm">
                  {category.productCount}{" "}
                  {category.productCount === 1 ? "item" : "items"}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-6xl px-4">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-semibold text-2xl tracking-tight">Featured</h2>
            <p className="text-muted-foreground">
              Big-ticket favourites, ready for delivery.
            </p>
          </div>
          <Button render={<Link search={{}} to="/shop" />} variant="ghost">
            View all
            <ArrowRight className="size-4" />
          </Button>
        </div>

        {catalog.isLoading ? (
          <StorefrontLoader label="Loading products" />
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {(featured.length > 0 ? featured : fresh.slice(0, 4)).map(
              (item) => (
                <ProductCard item={item} key={item.handle} />
              )
            )}
          </div>
        )}
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <div className="mb-6">
          <h2 className="font-semibold text-2xl tracking-tight">
            New this week
          </h2>
          <p className="text-muted-foreground">
            Fresh arrivals across the catalog.
          </p>
        </div>
        {catalog.isLoading ? (
          <StorefrontLoader label="Loading products" />
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {fresh.map((item) => (
              <ProductCard item={item} key={item.handle} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
