import { Button } from "@RetailOS/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { OrderSummary } from "../components/order-summary";
import { useCart } from "../lib/cart-store";
import { useQuote } from "../lib/commerce";
import { formatMoney } from "../lib/format";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const lines = useCart((s) => s.lines);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);

  const quoteLines = useMemo(
    () => lines.map((l) => ({ handle: l.handle, quantity: l.quantity })),
    [lines]
  );
  const quote = useQuote(quoteLines);

  if (lines.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <ShoppingBag className="size-6" />
        </span>
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            Your cart is empty
          </h1>
          <p className="text-muted-foreground">
            Browse the collection and add something you love.
          </p>
        </div>
        <Button render={<Link search={{}} to="/shop" />} size="lg">
          Start shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="mb-8 font-semibold text-3xl tracking-tight">Your cart</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
          {lines.map((line) => (
            <li className="flex gap-4 p-4" key={line.handle}>
              <Link
                className="size-20 shrink-0 overflow-hidden rounded-xl bg-muted/50"
                params={{ handle: line.handle }}
                to="/products/$handle"
              >
                {line.image ? (
                  <img
                    alt={line.name}
                    className="size-full object-cover"
                    height={80}
                    src={line.image}
                    width={80}
                  />
                ) : null}
              </Link>

              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    className="font-medium text-sm hover:underline"
                    params={{ handle: line.handle }}
                    to="/products/$handle"
                  >
                    {line.name}
                  </Link>
                  <span className="font-mono font-semibold text-sm tabular-nums">
                    {formatMoney(
                      line.unitPriceMinor * line.quantity,
                      line.currency,
                      line.scale
                    )}
                  </span>
                </div>
                <span className="font-mono text-muted-foreground text-xs tabular-nums">
                  {formatMoney(line.unitPriceMinor, line.currency, line.scale)}{" "}
                  each
                </span>

                <div className="mt-auto flex items-center justify-between">
                  <div className="flex items-center rounded-lg border border-border">
                    <Button
                      aria-label="Decrease quantity"
                      onClick={() =>
                        setQuantity(line.handle, line.quantity - 1)
                      }
                      size="icon-sm"
                      variant="ghost"
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-9 text-center text-sm tabular-nums">
                      {line.quantity}
                    </span>
                    <Button
                      aria-label="Increase quantity"
                      onClick={() =>
                        setQuantity(line.handle, line.quantity + 1)
                      }
                      size="icon-sm"
                      variant="ghost"
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  <Button
                    aria-label={`Remove ${line.name}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remove(line.handle)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-4">
          <OrderSummary isLoading={quote.isLoading} quote={quote.data} />
          <Button className="w-full" render={<Link to="/checkout" />} size="lg">
            Proceed to checkout
          </Button>
          <Button render={<Link search={{}} to="/shop" />} variant="ghost">
            Continue shopping
          </Button>
        </div>
      </div>
    </div>
  );
}
