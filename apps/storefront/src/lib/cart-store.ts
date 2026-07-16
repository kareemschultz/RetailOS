import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OrderConfirmation } from "../data/commerce-types";

// Client-side cart (session state, not durable app data). Lines carry the same
// { handle, quantity } identity the public commerce cart endpoints use, plus a
// small display snapshot (name/image/unit price) so the cart renders instantly
// without a round-trip. The AUTHORITATIVE money — line totals, tax, grand total
// — is never taken from this snapshot; it always comes from a fresh
// `useQuote()` (mock buildMockQuote today, commerce.quote when live), exactly as
// the design requires (server owns totals).

export type CartLine = {
  handle: string;
  quantity: number;
  // Display snapshot captured at add-time (presentation only).
  name: string;
  image: string | null;
  unitPriceMinor: number;
  currency: string;
  scale: number;
};

type CartState = {
  lines: CartLine[];
  add: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (handle: string, quantity: number) => void;
  remove: (handle: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (line, quantity = 1) =>
        set((state) => {
          const existing = state.lines.find((l) => l.handle === line.handle);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.handle === line.handle
                  ? { ...l, quantity: l.quantity + quantity }
                  : l
              ),
            };
          }
          return { lines: [...state.lines, { ...line, quantity }] };
        }),
      setQuantity: (handle, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.handle !== handle)
              : state.lines.map((l) =>
                  l.handle === handle ? { ...l, quantity } : l
                ),
        })),
      remove: (handle) =>
        set((state) => ({
          lines: state.lines.filter((l) => l.handle !== handle),
        })),
      clear: () => set({ lines: [] }),
    }),
    { name: "unitech-cart" }
  )
);

// Derived selectors — kept out of the store so components subscribe narrowly.
export function useCartCount(): number {
  return useCart((s) => s.lines.reduce((sum, l) => sum + l.quantity, 0));
}

// Hands the just-placed order to the confirmation page (session-only, cleared
// on view). Not persisted — a refresh on the confirmation page returns home.
type OrderState = {
  order: OrderConfirmation | null;
  setOrder: (order: OrderConfirmation) => void;
  clearOrder: () => void;
};

export const useOrder = create<OrderState>((set) => ({
  order: null,
  setOrder: (order) => set({ order }),
  clearOrder: () => set({ order: null }),
}));
