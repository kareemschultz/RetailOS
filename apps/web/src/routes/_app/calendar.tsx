import { createFileRoute } from "@tanstack/react-router";

import { EventCalendar } from "@/features/calendar/event-calendar";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarScreen,
});

function CalendarScreen() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">
          Operations calendar
        </h1>
        <p className="text-muted-foreground text-sm">
          Stock counts, supplier deliveries, promotions, shift schedules, and
          bond clearance dates across your stores.
        </p>
      </div>
      <EventCalendar />
    </div>
  );
}
