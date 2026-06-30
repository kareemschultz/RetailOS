import { Button } from "@RetailOS/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@RetailOS/ui/components/dialog";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
import { Switch } from "@RetailOS/ui/components/switch";
import { Textarea } from "@RetailOS/ui/components/textarea";
import { format } from "date-fns";
import { Trash2Icon } from "lucide-react";
import { useId, useState } from "react";

import type { CalendarEvent, EventType } from "./calendar-types";
import { EVENT_TYPE_OPTIONS } from "./event-type-options";

interface EventDialogProps {
  event: CalendarEvent | null;
  onDelete: (eventId: string) => void;
  onOpenChange: (open: boolean) => void;
  onSave: (event: CalendarEvent) => void;
  open: boolean;
}

function combine(dateValue: string, timeValue: string, allDay: boolean) {
  const time = allDay ? "00:00" : timeValue || "00:00";

  return new Date(`${dateValue}T${time}`);
}

function EventDialogForm({
  event,
  onOpenChange,
  onSave,
  onDelete,
}: {
  event: CalendarEvent;
  onOpenChange: (open: boolean) => void;
  onSave: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
}) {
  const titleId = useId();
  const typeId = useId();
  const allDayId = useId();
  const startDateId = useId();
  const startTimeId = useId();
  const endDateId = useId();
  const endTimeId = useId();
  const locationId = useId();
  const descriptionId = useId();

  const [title, setTitle] = useState(event.title);
  const [type, setType] = useState<EventType>(event.type ?? "delivery");
  const [allDay, setAllDay] = useState(Boolean(event.allDay));
  const [startDate, setStartDate] = useState(format(event.start, "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState(format(event.start, "HH:mm"));
  const [endDate, setEndDate] = useState(format(event.end, "yyyy-MM-dd"));
  const [endTime, setEndTime] = useState(format(event.end, "HH:mm"));
  const [location, setLocation] = useState(event.location ?? "");
  const [description, setDescription] = useState(event.description ?? "");

  function handleSave() {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      return;
    }

    onSave({
      ...event,
      title: trimmedTitle,
      type,
      allDay,
      start: combine(startDate, startTime, allDay),
      end: combine(endDate, endTime, allDay),
      location: location.trim() || undefined,
      description: description.trim() || undefined,
    });
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{event.id ? "Edit event" : "New event"}</DialogTitle>
        <DialogDescription>
          Schedule a retail operation — stock count, delivery, promotion, shift,
          or bond clearance.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label htmlFor={titleId}>Title</Label>
          <Input
            id={titleId}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            value={title}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={typeId}>Type</Label>
          <Select
            onValueChange={(value) => setType(value as EventType)}
            value={type}
          >
            <SelectTrigger className="w-full" id={typeId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {EVENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <Label htmlFor={allDayId}>All day</Label>
          <Switch
            checked={allDay}
            id={allDayId}
            onCheckedChange={(checked) => setAllDay(checked === true)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor={startDateId}>Start date</Label>
            <Input
              id={startDateId}
              onChange={(e) => setStartDate(e.target.value)}
              type="date"
              value={startDate}
            />
          </div>
          {!allDay && (
            <div className="grid gap-2">
              <Label htmlFor={startTimeId}>Start time</Label>
              <Input
                id={startTimeId}
                onChange={(e) => setStartTime(e.target.value)}
                type="time"
                value={startTime}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor={endDateId}>End date</Label>
            <Input
              id={endDateId}
              onChange={(e) => setEndDate(e.target.value)}
              type="date"
              value={endDate}
            />
          </div>
          {!allDay && (
            <div className="grid gap-2">
              <Label htmlFor={endTimeId}>End time</Label>
              <Input
                id={endTimeId}
                onChange={(e) => setEndTime(e.target.value)}
                type="time"
                value={endTime}
              />
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={locationId}>Location</Label>
          <Input
            id={locationId}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Store / warehouse"
            value={location}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={descriptionId}>Description</Label>
          <Textarea
            id={descriptionId}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a note..."
            rows={2}
            value={description}
          />
        </div>
      </div>

      <DialogFooter className="sm:justify-between">
        {event.id ? (
          <Button
            onClick={() => onDelete(event.id)}
            type="button"
            variant="outline"
          >
            <Trash2Icon className="size-4" />
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button disabled={!title.trim()} onClick={handleSave}>
            Save
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

export function EventDialog({
  event,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: EventDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {event && (
        <EventDialogForm
          event={event}
          key={event.id || "new"}
          onDelete={onDelete}
          onOpenChange={onOpenChange}
          onSave={onSave}
        />
      )}
    </Dialog>
  );
}
