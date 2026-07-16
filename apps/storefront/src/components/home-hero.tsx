import { Button } from "@RetailOS/ui/components/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function HomeHero() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl bg-muted">
        <img
          src="/img/hero-appliances.png"
          alt="Unitech appliance showroom with refrigerators, washing machines and televisions on display"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent" />
        <div className="relative flex max-w-xl flex-col gap-5 px-6 py-16 sm:px-12 sm:py-24 lg:py-32">
          <span className="w-fit rounded-full bg-primary/10 px-3 py-1 font-medium text-primary text-xs">
            Appliances & Electronics · Guyana
          </span>
          <h1 className="text-pretty font-semibold text-4xl leading-[1.05] tracking-tight sm:text-5xl">
            Everything for your home, in one place
          </h1>
          <p className="max-w-md text-pretty text-muted-foreground leading-relaxed">
            Fridges, stoves, washers, TVs and more — genuine stock with warranty
            options and islandwide delivery across Guyana.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="h-11 px-5 text-sm"
              render={<Link to="/shop" search={{}} />}
            >
              Shop all products
              <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-5 text-sm"
              render={<Link to="/shop" search={{ category: "fridges" }} />}
            >
              Browse fridges
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
