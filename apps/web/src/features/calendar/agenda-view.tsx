import { cn } from "@RetailOS/ui/lib/utils";
import { addDays, format, isToday } from "date-fns";
import { CalendarX2Icon } from "lucide-react";

import { AGENDA_DAYS_TO_SHOW } from "./calendar-store";
import type { CalendarEvent } from "./calendar-types";
import {
  getAllEventsForDay,
  getEventDotClass,
  normalizeEventType,
} from "./calendar-utils";
import { EVENT_TYPE_MAP } from "./event-type-options";

interface AgendaViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventSelect: (event: CalendarEvent) => void;
}

export function AgendaView({
  currentDate,
  events,
  onEventSelect,
}: AgendaViewProps) {
  const days = Array.from({ length: AGENDA_DAYS_TO_SHOW }, (_, index) =>
    addDays(currentDate, index)
  );

  const daysWithEvents = days
    .map((day) => ({ day, dayEvents: getAllEventsForDay(events, day) }))
    .filter((entry) => entry.dayEvents.length > 0);

  if (daysWithEvents.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center text-muted-foreground">
        <CalendarX2Icon className="size-8" />
        <p className="text-sm">No events scheduled in this period.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 divide-y overflow-auto">
      {daysWithEvents.map(({ day, dayEvents }) => (
        <div className="flex gap-4 p-4" key={day.toISOString()}>
          <div className="w-16 shrink-0">
            <div
              className={cn(
                "font-medium text-sm",
                isToday(day) && "text-primary"
              )}
            >
              {format(day, "EEE")}
            </div>
            <div className="font-semibold text-2xl tabular-nums">
              {format(day, "d")}
            </div>
            <div className="text-muted-foreground text-xs">
              {format(day, "MMM")}
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            {dayEvents.map((event) => (
              <button
                className="flex items-start gap-3 rounded-md border bg-card p-3 text-left transition-colors hover:bg-accent"
                key={event.id}
                onClick={() => onEventSelect(event)}
                type="button"
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    getEventDotClass(event.type)
                  )}
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-medium text-sm">{event.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {event.allDay
                      ? "All day"
                      : `${format(new Date(event.start), "HH:mm")} - ${format(new Date(event.end), "HH:mm")}`}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {EVENT_TYPE_MAP[normalizeEventType(event.type)].label}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
