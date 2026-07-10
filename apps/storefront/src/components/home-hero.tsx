import { Button } from "@RetailOS/ui/components/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function HomeHero() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl bg-muted">
        <img
          src="/img/hero.png"
          alt="A bright, minimal living space styled with Shopix home goods"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent" />
        <div className="relative flex max-w-xl flex-col gap-5 px-6 py-16 sm:px-12 sm:py-24 lg:py-32">
          <span className="w-fit rounded-full bg-primary/10 px-3 py-1 font-medium text-primary text-xs">
            New season · Home & Living
          </span>
          <h1 className="text-pretty font-semibold text-4xl leading-[1.05] tracking-tight sm:text-5xl">
            Considered goods for everyday rituals
          </h1>
          <p className="max-w-md text-pretty text-muted-foreground leading-relaxed">
            Home, kitchen and pantry essentials — chosen to last, priced fairly,
            and ready to ship across Guyana.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="h-11 px-5 text-sm"
              render={<Link to="/shop" search={{}} />}
            >
              Shop the collection
              <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-5 text-sm"
              render={<Link to="/shop" search={{ category: "kitchen" }} />}
            >
              Explore kitchen
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
