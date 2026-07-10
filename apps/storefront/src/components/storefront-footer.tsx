import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { label: "All products", to: "/shop", search: {} as Record<string, string> },
      { label: "Home & Living", to: "/shop", search: { category: "home-living" } },
      { label: "Kitchen", to: "/shop", search: { category: "kitchen" } },
      { label: "Coffee & Pantry", to: "/shop", search: { category: "coffee-pantry" } },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Shipping & delivery", to: "/shop", search: {} },
      { label: "Returns", to: "/shop", search: {} },
      { label: "Track an order", to: "/shop", search: {} },
      { label: "Contact us", to: "/shop", search: {} },
    ],
  },
];

export function StorefrontFooter() {
  return (
    <footer className="border-border/70 border-t bg-muted/30">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="max-w-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShoppingBag className="size-4" />
            </span>
            <span className="font-semibold text-lg tracking-tight">Shopix</span>
          </div>
          <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
            Considered goods for everyday rituals — home, kitchen and pantry
            essentials, chosen to last. A demo storefront running on RetailOS.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="font-medium text-sm">{col.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    search={link.search}
                    className="text-muted-foreground text-sm transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-border/70 border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-muted-foreground text-xs sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} Shopix. All prices in Guyanese dollars (GYD).</p>
          <p>Powered by RetailOS</p>
        </div>
      </div>
    </footer>
  );
}
