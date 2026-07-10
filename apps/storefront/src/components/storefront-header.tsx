import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { cn } from "@RetailOS/ui/lib/utils";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, ShoppingBag } from "lucide-react";
import { useState } from "react";

import { useCartCount } from "../lib/cart-store";
import { IS_MOCK_DATA } from "../lib/commerce";

const NAV = [
  { label: "Shop all", to: "/shop", search: {} as { category?: string } },
  { label: "Home & Living", to: "/shop", search: { category: "home-living" } },
  { label: "Kitchen", to: "/shop", search: { category: "kitchen" } },
  { label: "Coffee & Pantry", to: "/shop", search: { category: "coffee-pantry" } },
];

export function StorefrontHeader() {
  const count = useCartCount();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/shop", search: term.trim() ? { q: term.trim() } : {} });
  }

  return (
    <header className="sticky top-0 z-40 border-border/70 border-b bg-background/85 backdrop-blur-md">
      {IS_MOCK_DATA ? (
        <div className="flex items-center justify-center gap-2 bg-primary/10 px-4 py-1.5 text-center text-[11px] text-primary">
          <span className="font-medium">Preview storefront</span>
          <span className="text-primary/70">
            Showing sample catalog data — wires to the live commerce API with one flag.
          </span>
        </div>
      ) : null}

      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link
          className="flex shrink-0 items-center gap-2"
          to="/"
          aria-label="Shopix home"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShoppingBag className="size-4" />
          </span>
          <span className="font-semibold text-lg tracking-tight">Shopix</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              search={item.search}
              className="rounded-md px-3 py-2 font-medium text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground [&.active]:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <form
          onSubmit={submitSearch}
          className="ml-auto hidden w-full max-w-xs items-center md:flex"
          role="search"
        >
          <div className="relative w-full">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search products"
              aria-label="Search products"
              className="h-10 w-full rounded-lg border border-border bg-muted/40 pr-3 pl-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
        </form>

        <Button
          render={
            <Link
              to="/cart"
              aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}
            />
          }
          variant="outline"
          className={cn("relative ml-auto h-10 px-3 md:ml-0")}
        >
          <ShoppingBag className="size-4" />
          <span className="hidden sm:inline">Cart</span>
          {count > 0 ? (
            <Badge className="-right-1.5 -top-1.5 absolute flex size-5 items-center justify-center rounded-full p-0 text-[10px] tabular-nums">
              {count}
            </Badge>
          ) : null}
        </Button>
      </div>
    </header>
  );
}
