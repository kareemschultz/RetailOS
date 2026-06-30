export type CalendarView = "month" | "agenda";

// Event category. Ported from the AdminCN calendar `events` union and reframed
// for RetailOS retail operations.
export type EventType =
  | "stock_count"
  | "delivery"
  | "promotion"
  | "shift"
  | "bond_clearance";

export interface CalendarEvent {
  allDay?: boolean;
  description?: string;
  end: Date;
  id: string;
  location?: string;
  start: Date;
  title: string;
  type?: EventType;
}
