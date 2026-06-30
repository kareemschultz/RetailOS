import { addDays, setHours, setMinutes, subDays } from "date-fns";

import type { CalendarEvent } from "./calendar-types";

// RetailOS retail-ops calendar: stock counts, supplier deliveries, promotions,
// shift schedules, and bonded-warehouse clearance dates. Caribbean context.
function at(base: Date, hour: number, minute = 0) {
  return setMinutes(setHours(base, hour), minute);
}

const today = new Date();

export const sampleEvents: CalendarEvent[] = [
  {
    id: "1",
    title: "Quarterly stock count — Georgetown Main",
    description:
      "Full cycle count, all departments. Register downtime 6am-9am.",
    start: at(subDays(today, 2), 6),
    end: at(subDays(today, 2), 9),
    type: "stock_count",
    location: "Georgetown Main",
  },
  {
    id: "2",
    title: "Banks DIH beverage delivery",
    description: "Soft drinks and malt for the holiday weekend.",
    start: at(today, 8),
    end: at(today, 10),
    type: "delivery",
    location: "Georgetown Main",
  },
  {
    id: "3",
    title: "Independence weekend promotion",
    description: "20% off household goods. GYD pricing updated in POS.",
    start: subDays(today, 1),
    end: addDays(today, 2),
    allDay: true,
    type: "promotion",
    location: "All stores",
  },
  {
    id: "4",
    title: "Morning shift — cashiers",
    description: "Anand, Maria, Devon. Drawer floats prepared.",
    start: at(today, 7),
    end: at(today, 15),
    type: "shift",
    location: "Linden Branch",
  },
  {
    id: "5",
    title: "GRA bond clearance — electronics container",
    description: "PO-2031 customs clearance, then release to store stock.",
    start: at(addDays(today, 3), 9),
    end: at(addDays(today, 3), 12),
    type: "bond_clearance",
    location: "Bonded Warehouse 1",
  },
  {
    id: "6",
    title: "Pritipaul Singh frozen goods delivery",
    start: at(addDays(today, 1), 11),
    end: at(addDays(today, 1), 12, 30),
    type: "delivery",
    location: "Georgetown Main",
  },
  {
    id: "7",
    title: "Cycle count — pharmacy chronic meds",
    start: at(addDays(today, 4), 16),
    end: at(addDays(today, 4), 18),
    type: "stock_count",
    location: "Georgetown Main",
  },
  {
    id: "8",
    title: "Evening shift — warehouse pickers",
    start: at(addDays(today, 2), 14),
    end: at(addDays(today, 2), 22),
    type: "shift",
    location: "New Amsterdam",
  },
  {
    id: "9",
    title: "Back-to-school promotion",
    description: "Stationery and uniforms bundle pricing.",
    start: addDays(today, 6),
    end: addDays(today, 13),
    allDay: true,
    type: "promotion",
    location: "All stores",
  },
  {
    id: "10",
    title: "Ansa McAl Pharma delivery",
    start: at(addDays(today, 5), 9),
    end: at(addDays(today, 5), 10, 30),
    type: "delivery",
    location: "Georgetown Main",
  },
];
