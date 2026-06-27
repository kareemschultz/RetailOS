import { Button } from "@RetailOS/ui/components/button";
import { Input } from "@RetailOS/ui/components/input";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { formatMoney } from "@/lib/format";

import { EmptyState } from "../states";
import type { CartItem } from "./use-cart";

// A per-sku line total straight from pos.quote (keyed by skuId). The cart never
// computes a line total itself — it asks the quote.
export type QuoteLineMap = Map<string, number>;

export function CartPanel({
  items,
  quoteLines,
  currency,
  scale,
  onSetQty,
  onRemove,
}: {
  items: CartItem[];
  quoteLines: QuoteLineMap;
  currency: string | null;
  scale: number | null;
  onSetQty: (skuId: string, qty: number) => void;
  onRemove: (skuId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        description="Search or scan an item to start a sale."
        icon={ShoppingCart}
        title="Cart is empty"
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y">
      {items.map((item) => {
        const lineTotal = quoteLines.get(item.skuId);
        return (
          <li className="flex items-center gap-3 py-3" key={item.skuId}>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium text-sm">
                {item.displayName}
              </span>
              <span className="font-mono text-muted-foreground text-xs tabular-nums">
                {formatMoney(item.unitPriceMinor, item.currency, item.scale)}{" "}
                each
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                aria-label={`Decrease quantity of ${item.displayName}`}
                onClick={() => onSetQty(item.skuId, item.qty - 1)}
                size="icon"
                variant="outline"
              >
                <Minus className="size-4" />
              </Button>
              <Input
                aria-label={`Quantity of ${item.displayName}`}
                className="h-9 w-14 text-center font-mono tabular-nums"
                inputMode="numeric"
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value, 10);
                  onSetQty(item.skuId, Number.isNaN(next) ? 0 : next);
                }}
                value={item.qty}
              />
              <Button
                aria-label={`Increase quantity of ${item.displayName}`}
                onClick={() => onSetQty(item.skuId, item.qty + 1)}
                size="icon"
                variant="outline"
              >
                <Plus className="size-4" />
              </Button>
            </div>

            <span className="w-24 shrink-0 text-right font-mono text-sm tabular-nums">
              {lineTotal != null && currency != null && scale != null
                ? formatMoney(lineTotal, currency, scale)
                : "—"}
            </span>

            <Button
              aria-label={`Remove ${item.displayName}`}
              onClick={() => onRemove(item.skuId)}
              size="icon"
              variant="ghost"
            >
              <Trash2 className="size-4 text-muted-foreground" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
