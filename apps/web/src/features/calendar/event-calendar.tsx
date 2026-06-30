import { Button } from "@RetailOS/ui/components/button";
import { Checkbox } from "@RetailOS/ui/components/checkbox";
import { Label } from "@RetailOS/ui/components/label";
import { Tabs, TabsList, TabsTrigger } from "@RetailOS/ui/components/tabs";
import { cn } from "@RetailOS/ui/lib/utils";
import { addDays, format, isSameMonth } from "date-fns";
import {
  CalendarCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from "lucide-react";
import { useMemo } from "react";

import { AgendaView } from "./agenda-view";
import {
  AGENDA_DAYS_TO_SHOW,
  useCalendarFilters,
  useCalendarNavigation,
  useEventDialog,
  useFilteredEvents,
} from "./calendar-store";
import type { CalendarView } from "./calendar-types";
import { EventDialog } from "./event-dialog";
import { EVENT_TYPE_OPTIONS } from "./event-type-options";
import { MiniCalendar } from "./mini-calendar";
import { MonthView } from "./month-view";

export function EventCalendar() {
  const {
    currentDate,
    selectedDate,
    view,
    setView,
    goToPrevious,
    goToNext,
    goToToday,
    selectDate,
  } = useCalendarNavigation();
  const { showAllTypes, selectedTypes, setShowAllTypes, toggleTypeFilter } =
    useCalendarFilters();
  const {
    isEventDialogOpen,
    selectedEvent,
    openNewEventDialog,
    openEventDialog,
    closeEventDialog,
    saveEvent,
    deleteEvent,
  } = useEventDialog();

  const filteredEvents = useFilteredEvents();

  const eventDays = useMemo(() => {
    const set = new Set<string>();

    for (const event of filteredEvents) {
      set.add(format(new Date(event.start), "yyyy-MM-dd"));
    }

    return set;
  }, [filteredEvents]);

  const viewTitle = useMemo(() => {
    if (view === "month") {
      return format(currentDate, "MMMM yyyy");
    }

    const end = addDays(currentDate, AGENDA_DAYS_TO_SHOW - 1);

    return isSameMonth(currentDate, end)
      ? format(currentDate, "MMMM yyyy")
      : `${format(currentDate, "MMM")} - ${format(end, "MMM yyyy")}`;
  }, [currentDate, view]);

  return (
    <div className="grid grid-cols-1 rounded-lg border bg-card lg:grid-cols-9">
      <aside className="divide-y border-b lg:col-span-3 lg:border-r lg:border-b-0 2xl:col-span-2">
        <div className="p-4">
          <Button className="w-full" onClick={() => openNewEventDialog()}>
            <PlusIcon className="size-4" />
            <span>New event</span>
          </Button>
        </div>

        <div className="p-3">
          <MiniCalendar
            eventDays={eventDays}
            onSelect={selectDate}
            selected={selectedDate}
          />
        </div>

        <div className="flex flex-col gap-3 p-4">
          <span className="font-semibold text-sm">Event filters</span>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={showAllTypes}
              id="filter-all"
              onCheckedChange={(checked) => setShowAllTypes(checked === true)}
            />
            <Label className="cursor-pointer font-normal" htmlFor="filter-all">
              All
            </Label>
          </div>
          {EVENT_TYPE_OPTIONS.map((option) => {
            const isChecked =
              showAllTypes || selectedTypes.includes(option.value);

            return (
              <div className="flex items-center gap-2" key={option.value}>
                <Checkbox
                  aria-label={option.label}
                  checked={isChecked}
                  id={`filter-${option.value}`}
                  onCheckedChange={(checked) =>
                    toggleTypeFilter(option.value, checked === true)
                  }
                />
                <span className={cn("size-2 rounded-full", option.dotClass)} />
                <Label
                  className="cursor-pointer font-normal"
                  htmlFor={`filter-${option.value}`}
                >
                  {option.label}
                </Label>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="flex min-h-[36rem] flex-col lg:col-span-6 2xl:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 sm:p-4">
          <div className="flex items-center gap-1">
            <Button onClick={goToToday} variant="outline">
              <CalendarCheckIcon className="size-4" />
              <span className="max-sm:sr-only">Today</span>
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              aria-label="Previous"
              onClick={goToPrevious}
              size="icon-sm"
              variant="ghost"
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <h2 className="font-semibold text-sm sm:text-lg">{viewTitle}</h2>
            <Button
              aria-label="Next"
              onClick={goToNext}
              size="icon-sm"
              variant="ghost"
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
          <Tabs
            onValueChange={(value) => setView(value as CalendarView)}
            value={view}
          >
            <TabsList>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-1 flex-col">
          {view === "month" ? (
            <MonthView
              currentDate={currentDate}
              events={filteredEvents}
              onDateCreate={(day) => openNewEventDialog(day)}
              onEventSelect={openEventDialog}
            />
          ) : (
            <AgendaView
              currentDate={currentDate}
              events={filteredEvents}
              onEventSelect={openEventDialog}
            />
          )}
        </div>
      </div>

      <EventDialog
        event={selectedEvent}
        onDelete={deleteEvent}
        onOpenChange={(open) => {
          if (!open) {
            closeEventDialog();
          }
        }}
        onSave={saveEvent}
        open={isEventDialogOpen}
      />
    </div>
  );
}
