import { Button } from "@RetailOS/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";

import type { CatalogItem } from "../data/commerce-types";
import { useCart } from "../lib/cart-store";
import { formatMoney } from "../lib/format";

export function ProductCard({ item }: { item: CatalogItem }) {
  const add = useCart((s) => s.add);
  const soldOut = item.availability === "out_of_stock";

  function addToCart(e: React.MouseEvent) {
    e.preventDefault();
    add({
      handle: item.handle,
      name: item.name,
      image: item.primaryImage?.url ?? null,
      unitPriceMinor: item.price.amountMinor,
      currency: item.price.currency,
      scale: item.price.scale,
    });
    toast.success(`Added ${item.name}`, {
      icon: <Check className="size-4" />,
    });
  }

  return (
    <Link
      to="/products/$handle"
      params={{ handle: item.handle }}
      className="group flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 transition-all hover:ring-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-square overflow-hidden bg-muted/50">
        {item.primaryImage ? (
          <img
            src={item.primaryImage.url}
            alt={item.primaryImage.altText ?? item.name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
          />
        ) : null}
        {soldOut ? (
          <span className="absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 font-medium text-[11px] text-muted-foreground shadow-sm">
            Sold out
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        {item.category ? (
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
            {item.category.name}
          </span>
        ) : null}
        <h3 className="font-medium text-sm leading-snug text-balance">
          {item.name}
        </h3>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-mono font-semibold text-sm tabular-nums">
            {formatMoney(
              item.price.amountMinor,
              item.price.currency,
              item.price.scale
            )}
          </span>
          <Button
            size="icon-sm"
            variant={soldOut ? "ghost" : "default"}
            disabled={soldOut}
            onClick={addToCart}
            aria-label={soldOut ? `${item.name} is sold out` : `Add ${item.name} to cart`}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
    </Link>
  );
}
