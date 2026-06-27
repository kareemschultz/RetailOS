import type { AppRouterClient } from "@RetailOS/api/routers/index";

// Derive every POS DTO shape from the backend router client so the frontend can
// NEVER drift from the contract: if a backend DTO changes, these types change
// and the UI fails to type-check. The client only ever reads cashier-scoped
// pos.* procedures.
type Pos = AppRouterClient["pos"];

export type SaleQuote = Awaited<ReturnType<Pos["quote"]>>;
export type SaleReceipt = Awaited<ReturnType<Pos["receipt"]>>;
export type CreateSaleResult = Awaited<ReturnType<Pos["createSale"]>>;
export type ItemSearchRow = Awaited<ReturnType<Pos["itemSearch"]>>[number];
export type LocationListResult = Awaited<ReturnType<Pos["locationList"]>>;
export type PosLocation = LocationListResult["locations"][number];
