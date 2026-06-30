import { addDays, addMonths, subMonths } from "date-fns";
import { useMemo } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { sampleEvents } from "./calendar-data";
import type { CalendarEvent, CalendarView, EventType } from "./calendar-types";
import { normalizeEventType } from "./calendar-utils";
import { ALL_EVENT_TYPES } from "./event-type-options";

// Number of days shown in the agenda view.
export const AGENDA_DAYS_TO_SHOW = 30;

type CalendarData = {
  events: CalendarEvent[];
  currentDate: Date;
  view: CalendarView;
  selectedDate: Date;
  isEventDialogOpen: boolean;
  selectedEvent: CalendarEvent | null;
  showAllTypes: boolean;
  selectedTypes: EventType[];
};

type CalendarActions = {
  setView: (view: CalendarView) => void;
  goToPrevious: () => void;
  goToNext: () => void;
  goToToday: () => void;
  selectDate: (date: Date) => void;
  setShowAllTypes: (checked: boolean) => void;
  toggleTypeFilter: (type: EventType, checked: boolean) => void;
  openNewEventDialog: (start?: Date) => void;
  openEventDialog: (event: CalendarEvent) => void;
  closeEventDialog: () => void;
  saveEvent: (event: CalendarEvent) => void;
  deleteEvent: (eventId: string) => void;
};

export type CalendarStore = CalendarData & CalendarActions;

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  events: sampleEvents,
  currentDate: new Date(),
  view: "month",
  selectedDate: new Date(),
  isEventDialogOpen: false,
  selectedEvent: null,
  showAllTypes: true,
  selectedTypes: [...ALL_EVENT_TYPES],

  setView: (view) => {
    if (get().view === view) {
      return;
    }

    set({ view });
  },

  goToPrevious: () => {
    const { view, currentDate } = get();

    set({
      currentDate:
        view === "month"
          ? subMonths(currentDate, 1)
          : addDays(currentDate, -AGENDA_DAYS_TO_SHOW),
    });
  },

  goToNext: () => {
    const { view, currentDate } = get();

    set({
      currentDate:
        view === "month"
          ? addMonths(currentDate, 1)
          : addDays(currentDate, AGENDA_DAYS_TO_SHOW),
    });
  },

  goToToday: () => set({ currentDate: new Date(), selectedDate: new Date() }),

  selectDate: (date) => set({ selectedDate: date, currentDate: date }),

  setShowAllTypes: (checked) => {
    set(
      checked
        ? { showAllTypes: true, selectedTypes: [...ALL_EVENT_TYPES] }
        : { showAllTypes: false, selectedTypes: [] }
    );
  },

  toggleTypeFilter: (type, checked) => {
    const { showAllTypes, selectedTypes } = get();
    const active = showAllTypes ? [...ALL_EVENT_TYPES] : selectedTypes;
    const next = checked
      ? [...new Set([...active, type])]
      : active.filter((item) => item !== type);

    set({
      showAllTypes: next.length === ALL_EVENT_TYPES.length,
      selectedTypes: next,
    });
  },

  openNewEventDialog: (start) => {
    const base = start ?? get().selectedDate;
    const startTime = new Date(base);

    startTime.setHours(9, 0, 0, 0);

    const endTime = new Date(startTime);

    endTime.setHours(10, 0, 0, 0);

    set({
      selectedEvent: {
        id: "",
        title: "",
        start: startTime,
        end: endTime,
        allDay: false,
        type: "delivery",
      },
      isEventDialogOpen: true,
    });
  },

  openEventDialog: (event) =>
    set({ selectedEvent: event, isEventDialogOpen: true }),

  closeEventDialog: () =>
    set({ isEventDialogOpen: false, selectedEvent: null }),

  saveEvent: (event) => {
    set((state) => {
      if (event.id) {
        return {
          events: state.events.map((item) =>
            item.id === event.id ? event : item
          ),
          isEventDialogOpen: false,
          selectedEvent: null,
        };
      }

      return {
        events: [...state.events, { ...event, id: generateId() }],
        isEventDialogOpen: false,
        selectedEvent: null,
      };
    });
  },

  deleteEvent: (eventId) =>
    set((state) => ({
      events: state.events.filter((item) => item.id !== eventId),
      isEventDialogOpen: false,
      selectedEvent: null,
    })),
}));

export function useFilteredEvents() {
  const events = useCalendarStore((state) => state.events);
  const showAllTypes = useCalendarStore((state) => state.showAllTypes);
  const selectedTypes = useCalendarStore((state) => state.selectedTypes);

  return useMemo(() => {
    if (showAllTypes) {
      return events;
    }

    return events.filter((event) =>
      selectedTypes.includes(normalizeEventType(event.type))
    );
  }, [events, showAllTypes, selectedTypes]);
}

export function useCalendarNavigation() {
  return useCalendarStore(
    useShallow((state) => ({
      currentDate: state.currentDate,
      selectedDate: state.selectedDate,
      view: state.view,
      setView: state.setView,
      goToPrevious: state.goToPrevious,
      goToNext: state.goToNext,
      goToToday: state.goToToday,
      selectDate: state.selectDate,
    }))
  );
}

export function useCalendarFilters() {
  return useCalendarStore(
    useShallow((state) => ({
      showAllTypes: state.showAllTypes,
      selectedTypes: state.selectedTypes,
      setShowAllTypes: state.setShowAllTypes,
      toggleTypeFilter: state.toggleTypeFilter,
    }))
  );
}

export function useEventDialog() {
  return useCalendarStore(
    useShallow((state) => ({
      isEventDialogOpen: state.isEventDialogOpen,
      selectedEvent: state.selectedEvent,
      openNewEventDialog: state.openNewEventDialog,
      openEventDialog: state.openEventDialog,
      closeEventDialog: state.closeEventDialog,
      saveEvent: state.saveEvent,
      deleteEvent: state.deleteEvent,
    }))
  );
}
