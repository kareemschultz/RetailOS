import { isSameDay } from "date-fns";

import type { CalendarEvent, EventType } from "./calendar-types";
import { EVENT_TYPE_MAP } from "./event-type-options";

const DEFAULT_TYPE: EventType = "delivery";

export function normalizeEventType(type?: EventType): EventType {
  if (type && EVENT_TYPE_MAP[type]) {
    return type;
  }

  return DEFAULT_TYPE;
}

export function getEventPillClasses(type?: EventType): string {
  return EVENT_TYPE_MAP[normalizeEventType(type)].pillClass;
}

export function getEventDotClass(type?: EventType): string {
  return EVENT_TYPE_MAP[normalizeEventType(type)].dotClass;
}

export function isMultiDayEvent(event: CalendarEvent): boolean {
  const eventStart = new Date(event.start);
  const eventEnd = new Date(event.end);

  return Boolean(event.allDay) || !isSameDay(eventStart, eventEnd);
}

// All events that touch a given day (start, end, or span across it).
export function getAllEventsForDay(
  events: CalendarEvent[],
  day: Date
): CalendarEvent[] {
  return events
    .filter((event) => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);

      return (
        isSameDay(day, eventStart) ||
        isSameDay(day, eventEnd) ||
        (day > eventStart && day < eventEnd)
      );
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}
