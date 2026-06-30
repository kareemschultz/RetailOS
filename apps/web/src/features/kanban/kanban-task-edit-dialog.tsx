import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@RetailOS/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
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
import { Textarea } from "@RetailOS/ui/components/textarea";
import { format } from "date-fns";
import { ChevronDownIcon, UsersIcon } from "lucide-react";
import { useId, useState } from "react";

import { teamMembers } from "./kanban-data";
import { resolveAssignees } from "./kanban-store";
import type { Task } from "./kanban-types";
import { parseDueDate, priorityItems } from "./kanban-utils";

interface TaskEditDialogProps {
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Partial<Task>) => void;
  open: boolean;
  task: Task | null;
}

function toDateInputValue(value?: string) {
  const parsed = parseDueDate(value);

  return parsed ? format(parsed, "yyyy-MM-dd") : "";
}

function TaskEditDialogContent({
  task,
  onOpenChange,
  onSave,
}: {
  task: Task;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Partial<Task>) => void;
}) {
  const priorityId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const supplierId = useId();
  const storeId = useId();
  const amountId = useId();
  const dueDateId = useId();

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<Task["priority"]>(task.priority);
  const [supplier, setSupplier] = useState(task.supplier ?? "");
  const [store, setStore] = useState(task.store ?? "");
  const [amount, setAmount] = useState(
    typeof task.amountGyd === "number" ? String(task.amountGyd) : ""
  );
  const [dueDate, setDueDate] = useState(toDateInputValue(task.dueDate));
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(
    task.assignees?.map((assignee) => assignee.name) ?? []
  );

  function toggleAssignee(name: string, checked: boolean) {
    setSelectedAssignees((prev) =>
      checked ? [...new Set([...prev, name])] : prev.filter((n) => n !== name)
    );
  }

  function handleSave() {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      return;
    }

    const assignees = resolveAssignees(selectedAssignees);
    const parsedAmount = Number.parseInt(amount, 10);
    const parsedDate = dueDate ? new Date(`${dueDate}T00:00:00`) : undefined;

    onSave({
      title: trimmedTitle,
      description: description.trim() || undefined,
      priority,
      supplier: supplier.trim() || undefined,
      store: store.trim() || undefined,
      amountGyd: Number.isNaN(parsedAmount) ? undefined : parsedAmount,
      assignees: assignees.length > 0 ? assignees : undefined,
      dueDate:
        parsedDate && !Number.isNaN(parsedDate.getTime())
          ? format(parsedDate, "MMM d, yyyy")
          : undefined,
    });
    onOpenChange(false);
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Edit purchase order</DialogTitle>
        <DialogDescription>Update the order details below.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label htmlFor={titleId}>Title</Label>
          <Input
            id={titleId}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Order title"
            value={title}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={descriptionId}>Description</Label>
          <Textarea
            id={descriptionId}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
            rows={3}
            value={description}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor={supplierId}>Supplier</Label>
            <Input
              id={supplierId}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Supplier"
              value={supplier}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={storeId}>Destination</Label>
            <Input
              id={storeId}
              onChange={(e) => setStore(e.target.value)}
              placeholder="Store / warehouse"
              value={store}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor={amountId}>Amount (GYD)</Label>
            <Input
              id={amountId}
              inputMode="numeric"
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              type="number"
              value={amount}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={priorityId}>Priority</Label>
            <Select
              onValueChange={(value) => setPriority(value as Task["priority"])}
              value={priority}
            >
              <SelectTrigger className="w-full" id={priorityId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {priorityItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Assignees</Label>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  className="w-full justify-between font-normal"
                  variant="outline"
                />
              }
            >
              <span className="flex items-center gap-2">
                <UsersIcon className="size-4" />
                {selectedAssignees.length > 0 ? (
                  `${selectedAssignees.length} selected`
                ) : (
                  <span className="text-muted-foreground">Assign buyers</span>
                )}
              </span>
              <ChevronDownIcon className="size-4 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {teamMembers.map((member) => (
                <DropdownMenuCheckboxItem
                  checked={selectedAssignees.includes(member.name)}
                  closeOnClick={false}
                  key={member.name}
                  onCheckedChange={(checked) =>
                    toggleAssignee(member.name, checked === true)
                  }
                >
                  {member.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {selectedAssignees.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedAssignees.map((name) => (
                <Badge key={name} variant="secondary">
                  {name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={dueDateId}>Expected date</Label>
          <Input
            id={dueDateId}
            onChange={(e) => setDueDate(e.target.value)}
            type="date"
            value={dueDate}
          />
        </div>
      </div>

      <DialogFooter>
        <Button onClick={() => onOpenChange(false)} variant="outline">
          Cancel
        </Button>
        <Button disabled={!title.trim()} onClick={handleSave}>
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function TaskEditDialog({
  task,
  open,
  onOpenChange,
  onSave,
}: TaskEditDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {task && (
        <TaskEditDialogContent
          key={task.id}
          onOpenChange={onOpenChange}
          onSave={onSave}
          task={task}
        />
      )}
    </Dialog>
  );
}
