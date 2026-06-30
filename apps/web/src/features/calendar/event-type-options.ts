import type { EventType } from "./calendar-types";

export type EventTypeOption = {
  value: EventType;
  label: string;
  // Classes for the day-cell / agenda event pill.
  pillClass: string;
  // Solid dot for legend + mini-calendar markers.
  dotClass: string;
};

export const EVENT_TYPE_OPTIONS: EventTypeOption[] = [
  {
    value: "stock_count",
    label: "Stock count",
    pillClass:
      "bg-amber-200/50 text-amber-950/80 dark:bg-amber-400/25 dark:text-amber-200",
    dotClass: "bg-amber-400",
  },
  {
    value: "delivery",
    label: "Supplier delivery",
    pillClass:
      "bg-violet-200/50 text-violet-950/80 dark:bg-violet-400/25 dark:text-violet-200",
    dotClass: "bg-violet-400",
  },
  {
    value: "promotion",
    label: "Promotion",
    pillClass:
      "bg-rose-200/50 text-rose-950/80 dark:bg-rose-400/25 dark:text-rose-200",
    dotClass: "bg-rose-400",
  },
  {
    value: "shift",
    label: "Shift schedule",
    pillClass:
      "bg-emerald-200/50 text-emerald-950/80 dark:bg-emerald-400/25 dark:text-emerald-200",
    dotClass: "bg-emerald-400",
  },
  {
    value: "bond_clearance",
    label: "Bond clearance",
    pillClass:
      "bg-sky-200/50 text-sky-950/80 dark:bg-sky-400/25 dark:text-sky-200",
    dotClass: "bg-sky-400",
  },
];

export const ALL_EVENT_TYPES: EventType[] = EVENT_TYPE_OPTIONS.map(
  (option) => option.value
);

export const EVENT_TYPE_MAP: Record<EventType, EventTypeOption> =
  Object.fromEntries(
    EVENT_TYPE_OPTIONS.map((option) => [option.value, option])
  ) as Record<EventType, EventTypeOption>;
