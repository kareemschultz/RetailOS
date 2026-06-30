import { cn } from "@RetailOS/ui/lib/utils";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import type { CalendarEvent } from "./calendar-types";
import { getAllEventsForDay, getEventPillClasses } from "./calendar-utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_EVENTS = 3;

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onDateCreate: (day: Date) => void;
  onEventSelect: (event: CalendarEvent) => void;
}

export function MonthView({
  currentDate,
  events,
  onEventSelect,
  onDateCreate,
}: MonthViewProps) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 }),
  });

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden"
      data-slot="month-view"
    >
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map((weekday) => (
          <div
            className="py-2 text-center font-medium text-muted-foreground text-xs"
            key={weekday}
          >
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid flex-1 auto-rows-fr grid-cols-7">
        {days.map((day) => {
          const dayEvents = getAllEventsForDay(events, day);
          const visible = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const hiddenCount = dayEvents.length - visible.length;
          const inMonth = isSameMonth(day, currentDate);

          return (
            <div
              className={cn(
                "min-h-24 border-r border-b p-1 last:border-r-0 [&:nth-child(7n)]:border-r-0",
                !inMonth && "bg-muted/30"
              )}
              key={day.toISOString()}
            >
              <button
                className={cn(
                  "flex size-6 items-center justify-center rounded-md text-xs transition-colors hover:bg-accent",
                  !inMonth && "text-muted-foreground/50",
                  isToday(day) &&
                    "bg-primary font-medium text-primary-foreground"
                )}
                onClick={() => onDateCreate(day)}
                title="Add event"
                type="button"
              >
                {format(day, "d")}
              </button>
              <div className="mt-1 space-y-1">
                {visible.map((event) => (
                  <button
                    className={cn(
                      "block w-full truncate rounded-sm px-1.5 py-0.5 text-left text-xs",
                      getEventPillClasses(event.type)
                    )}
                    key={event.id}
                    onClick={() => onEventSelect(event)}
                    type="button"
                  >
                    {!event.allDay && (
                      <span className="font-mono opacity-70">
                        {format(new Date(event.start), "HH:mm")}{" "}
                      </span>
                    )}
                    {event.title}
                  </button>
                ))}
                {hiddenCount > 0 && (
                  <span className="block px-1.5 text-muted-foreground text-xs">
                    +{hiddenCount} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
