import { Input } from "@RetailOS/ui/components/input";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import { cn } from "@RetailOS/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { PackageSearch, ScanLine } from "lucide-react";
import { type KeyboardEvent, useEffect, useState } from "react";
import { formatMoney } from "@/lib/format";
import { orpc } from "@/utils/orpc";

import { EmptyState, ErrorState } from "../states";
import type { ItemSearchRow } from "./types";
import type { CartItem } from "./use-cart";

function rowToCartItem(row: ItemSearchRow): Omit<CartItem, "qty"> {
  return {
    productId: row.productId,
    skuId: row.skuId,
    displayName: row.displayName,
    unitPriceMinor: row.priceMinor,
    currency: row.currency,
    scale: row.scale,
  };
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

// Cashier item lookup via pos.itemSearch. Search by name / SKU code / barcode;
// an exact barcode scan + Enter adds in one action (the fast scan path). Each
// row carries the skuId the sale needs. No admin catalog reads.
export function ProductSearch({
  onAdd,
}: {
  onAdd: (item: Omit<CartItem, "qty">) => void;
}) {
  const [term, setTerm] = useState("");
  const debounced = useDebounced(term.trim(), 200);
  const enabled = debounced.length >= 1;

  const query = useQuery(
    orpc.pos.itemSearch.queryOptions({
      input: { q: debounced, limit: 20 },
      enabled,
    })
  );

  const rows = query.data ?? [];

  function addRow(row: ItemSearchRow) {
    onAdd(rowToCartItem(row));
    setTerm("");
  }

  // Enter: prefer an exact barcode match (the scan path), else the first result.
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || rows.length === 0) {
      return;
    }
    event.preventDefault();
    const scanned = rows.find((row) => row.matchedBarcode === debounced);
    addRow(scanned ?? rows[0]);
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative">
        <ScanLine className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search or scan an item"
          autoComplete="off"
          className="pl-9"
          inputMode="search"
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search or scan an item…"
          value={term}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {query.isLoading && enabled ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton className="h-14 w-full" key={i} />
            ))}
          </div>
        ) : null}

        {query.isError ? (
          <ErrorState
            message="Item search failed."
            onRetry={() => query.refetch()}
          />
        ) : null}

        {enabled && !query.isLoading && !query.isError && rows.length === 0 ? (
          <EmptyState
            description="Try a different name, SKU, or barcode."
            icon={PackageSearch}
            title="No items found"
          />
        ) : null}

        {enabled ? null : (
          <EmptyState
            description="Scan a barcode or start typing to find an item."
            icon={ScanLine}
            title="Search the catalog"
          />
        )}

        <ul className="flex flex-col gap-1">
          {rows.map((row) => (
            <li key={row.skuId}>
              <button
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent",
                  "min-h-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                onClick={() => addRow(row)}
                type="button"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-sm">
                    {row.displayName}
                  </span>
                  {row.skuCode ? (
                    <span className="truncate text-muted-foreground text-xs">
                      {row.skuCode}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 font-mono text-sm tabular-nums">
                  {formatMoney(row.priceMinor, row.currency, row.scale)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
