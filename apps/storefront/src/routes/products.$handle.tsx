import { Button } from "@RetailOS/ui/components/button";
import { Separator } from "@RetailOS/ui/components/separator";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Minus,
  Plus,
  ShoppingBag,
  Star,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProductCard } from "../components/product-card";
import { StorefrontLoader } from "../components/storefront-loader";
import { CONTENT_BY_HANDLE } from "../data/catalog";
import { useCart } from "../lib/cart-store";
import { useCatalog, useProduct } from "../lib/commerce";
import { formatMoney } from "../lib/format";

export const Route = createFileRoute("/products/$handle")({
  component: ProductPage,
});

function ProductPage() {
  const { handle } = Route.useParams();
  const product = useProduct(handle);
  const catalog = useCatalog();
  const add = useCart((s) => s.add);
  const [quantity, setQuantity] = useState(1);

  if (product.isLoading) {
    return (
      <div className="py-24">
        <StorefrontLoader label="Loading product" />
      </div>
    );
  }

  if (product.isError || !product.data) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">
          Product not found
        </h1>
        <p className="text-muted-foreground">
          This item may be unavailable in this store.
        </p>
        <Button render={<Link search={{}} to="/shop" />}>
          <ArrowLeft className="size-4" />
          Back to shop
        </Button>
      </div>
    );
  }

  const item = product.data;
  const content = CONTENT_BY_HANDLE[handle];
  const soldOut = item.availability === "out_of_stock";
  const primary =
    item.images.find((img) => img.isPrimary)?.url ??
    item.images[0]?.url ??
    null;

  const related = (catalog.data ?? [])
    .filter(
      (c) => c.handle !== handle && c.category?.handle === item.category?.handle
    )
    .slice(0, 4);

  function addToCart() {
    add(
      {
        currency: item.price.currency,
        handle: item.handle,
        image: primary,
        name: item.name,
        scale: item.price.scale,
        unitPriceMinor: item.price.amountMinor,
      },
      quantity
    );
    toast.success(`Added ${quantity} × ${item.name}`, {
      icon: <Check className="size-4" />,
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-1.5 text-muted-foreground text-sm"
      >
        <Link
          className="transition-colors hover:text-foreground"
          search={{}}
          to="/shop"
        >
          Shop
        </Link>
        {item.category ? (
          <>
            <ChevronRight className="size-3.5" />
            <Link
              className="transition-colors hover:text-foreground"
              search={{ category: item.category.handle }}
              to="/shop"
            >
              {item.category.name}
            </Link>
          </>
        ) : null}
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">{item.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="overflow-hidden rounded-3xl bg-muted/40 ring-1 ring-foreground/10">
          <div className="aspect-square">
            {primary ? (
              <img
                alt={item.images[0]?.altText ?? item.name}
                className="size-full object-cover"
                height={800}
                src={primary}
                width={800}
              />
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            {item.category ? (
              <span className="text-muted-foreground text-xs uppercase tracking-wide">
                {item.category.name}
              </span>
            ) : null}
            <h1 className="text-balance font-semibold text-3xl tracking-tight">
              {item.name}
            </h1>
            {content ? (
              <p className="text-lg text-muted-foreground">{content.tagline}</p>
            ) : null}

            {content ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      className={
                        i < Math.round(content.rating)
                          ? "size-4 fill-current"
                          : "size-4 text-muted-foreground/30"
                      }
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed 5-star scale
                      key={i}
                    />
                  ))}
                </div>
                <span className="text-muted-foreground text-sm">
                  {content.rating.toFixed(1)} · {content.reviewCount} reviews
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex items-baseline gap-3">
            <span className="font-mono font-semibold text-3xl tabular-nums">
              {formatMoney(
                item.price.amountMinor,
                item.price.currency,
                item.price.scale
              )}
            </span>
            <span
              className={
                soldOut
                  ? "rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground text-xs"
                  : "rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-600 text-xs dark:text-emerald-400"
              }
            >
              {soldOut ? "Sold out" : "In stock"}
            </span>
          </div>

          {content ? (
            <p className="text-pretty text-muted-foreground leading-relaxed">
              {content.description}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-border">
              <Button
                aria-label="Decrease quantity"
                disabled={quantity <= 1 || soldOut}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                size="icon"
                variant="ghost"
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-10 text-center font-medium tabular-nums">
                {quantity}
              </span>
              <Button
                aria-label="Increase quantity"
                disabled={soldOut}
                onClick={() => setQuantity((q) => q + 1)}
                size="icon"
                variant="ghost"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <Button
              className="flex-1"
              disabled={soldOut}
              onClick={addToCart}
              size="lg"
            >
              <ShoppingBag className="size-4" />
              {soldOut ? "Sold out" : "Add to cart"}
            </Button>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-3 text-muted-foreground text-sm">
            <Truck className="size-4 shrink-0" />
            Free delivery in Georgetown on orders over G$15,000.
          </div>

          {content && content.highlights.length > 0 ? (
            <div>
              <Separator className="mb-4" />
              <h2 className="mb-3 font-medium text-sm">Highlights</h2>
              <ul className="flex flex-col gap-2">
                {content.highlights.map((h) => (
                  <li
                    className="flex items-center gap-2 text-muted-foreground text-sm"
                    key={h}
                  >
                    <Check className="size-4 shrink-0 text-primary" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-16">
          <h2 className="mb-6 font-semibold text-2xl tracking-tight">
            You might also like
          </h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {related.map((r) => (
              <ProductCard item={r} key={r.handle} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
