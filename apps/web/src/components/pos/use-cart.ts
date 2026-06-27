import { useReducer } from "react";

// A cart line holds only what the UI needs to DISPLAY a line and what the
// backend needs to QUOTE/SELL it: identity (productId + skuId), qty, and a
// snapshot of the catalog price for display. Money truth (line totals, grand
// total, change) always comes from pos.quote / pos.receipt — never computed here.
export interface CartItem {
  currency: string;
  displayName: string;
  productId: string;
  qty: number;
  scale: number;
  skuId: string;
  unitPriceMinor: number;
}

// The sale-line input shape pos.quote / pos.createSale consume.
export interface SaleLineInput {
  productId: string;
  qty: number;
  skuId: string;
}

type CartAction =
  | { type: "add"; item: Omit<CartItem, "qty">; qty?: number }
  | { type: "setQty"; skuId: string; qty: number }
  | { type: "remove"; skuId: string }
  | { type: "clear" };

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case "add": {
      const addQty = action.qty ?? 1;
      const existing = state.find((line) => line.skuId === action.item.skuId);
      if (existing) {
        return state.map((line) =>
          line.skuId === action.item.skuId
            ? { ...line, qty: line.qty + addQty }
            : line
        );
      }
      return [...state, { ...action.item, qty: addQty }];
    }
    case "setQty": {
      if (action.qty <= 0) {
        return state.filter((line) => line.skuId !== action.skuId);
      }
      return state.map((line) =>
        line.skuId === action.skuId ? { ...line, qty: action.qty } : line
      );
    }
    case "remove":
      return state.filter((line) => line.skuId !== action.skuId);
    case "clear":
      return [];
    default:
      return state;
  }
}

export function useCart() {
  const [items, dispatch] = useReducer(cartReducer, []);

  return {
    items,
    add: (item: Omit<CartItem, "qty">, qty?: number) =>
      dispatch({ type: "add", item, qty }),
    setQty: (skuId: string, qty: number) =>
      dispatch({ type: "setQty", skuId, qty }),
    remove: (skuId: string) => dispatch({ type: "remove", skuId }),
    clear: () => dispatch({ type: "clear" }),
    lines: items.map<SaleLineInput>((line) => ({
      productId: line.productId,
      skuId: line.skuId,
      qty: line.qty,
    })),
    count: items.reduce((sum, line) => sum + line.qty, 0),
  };
}
