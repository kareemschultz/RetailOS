import { Button } from "@RetailOS/ui/components/button";
import { cn } from "@RetailOS/ui/lib/utils";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

interface MiniCalendarProps {
  eventDays: Set<string>;
  onSelect: (date: Date) => void;
  selected: Date;
}

export function MiniCalendar({
  selected,
  eventDays,
  onSelect,
}: MiniCalendarProps) {
  const [month, setMonth] = useState<Date>(startOfMonth(selected));

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  });

  return (
    <div className="select-none">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="font-medium text-sm">
          {format(month, "MMMM yyyy")}
        </span>
        <div className="flex items-center gap-1">
          <Button
            aria-label="Previous month"
            onClick={() => setMonth((m) => subMonths(m, 1))}
            size="icon-xs"
            variant="ghost"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            aria-label="Next month"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            size="icon-xs"
            variant="ghost"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-muted-foreground text-xs">
        {WEEKDAY_LABELS.map((label, index) => (
          <span className="py-1" key={`${label}-${index}`}>
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const isSelected = isSameDay(day, selected);
          const hasEvent = eventDays.has(format(day, "yyyy-MM-dd"));

          return (
            <button
              className={cn(
                "relative flex h-8 items-center justify-center rounded-md text-sm transition-colors hover:bg-accent",
                !inMonth && "text-muted-foreground/40",
                isToday(day) && !isSelected && "bg-muted font-medium",
                isSelected &&
                  "bg-primary font-medium text-primary-foreground hover:bg-primary"
              )}
              key={day.toISOString()}
              onClick={() => onSelect(day)}
              type="button"
            >
              {format(day, "d")}
              {hasEvent && !isSelected && (
                <span className="absolute bottom-1 size-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
