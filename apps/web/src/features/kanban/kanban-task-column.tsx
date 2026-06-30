import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent, CardHeader } from "@RetailOS/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import { Input } from "@RetailOS/ui/components/input";
import { cn } from "@RetailOS/ui/lib/utils";
import {
  EllipsisVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { TaskCard } from "./kanban-task-card";
import type { ColumnSummary, Task } from "./kanban-types";

interface TaskColumnProps {
  columnId: string;
  columns: ColumnSummary[];
  onAddCard: (columnId: string, title: string) => void;
  onDeleteCard: (columnId: string, taskId: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onEditCard: (columnId: string, taskId: string) => void;
  onEditColumn: (columnId: string) => void;
  onMoveCard: (
    fromColumnId: string,
    toColumnId: string,
    taskId: string
  ) => void;
  tasks: Task[];
  title: string;
}

export function TaskColumn({
  columnId,
  title,
  tasks,
  columns,
  onEditColumn,
  onDeleteColumn,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onMoveCard,
}: TaskColumnProps) {
  const [newCardTitle, setNewCardTitle] = useState("");

  function handleAddCard() {
    const trimmed = newCardTitle.trim();

    if (!trimmed) {
      return;
    }

    onAddCard(columnId, trimmed);
    setNewCardTitle("");
  }

  return (
    <Card className="mb-2.5 w-72 shrink-0 bg-muted py-4">
      <CardHeader className="flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <span className="line-clamp-1 max-w-25 overflow-hidden text-ellipsis font-semibold text-sm">
            {title}
          </span>
          <Badge variant="outline">{tasks.length}</Badge>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button size="icon-xs" variant="ghost" />}
          >
            <EllipsisVerticalIcon className="size-3.5" />
            <span className="sr-only">Column actions</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onEditColumn(columnId)}>
              <PencilIcon />
              Edit column
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDeleteColumn(columnId)}
              variant="destructive"
            >
              <Trash2Icon />
              Delete column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="flex flex-col gap-2.5 px-4">
        <div
          className={cn(
            "flex flex-col gap-2.5",
            tasks.length === 0 && "hidden"
          )}
        >
          {tasks.map((task) => (
            <TaskCard
              columns={columns}
              currentColumnId={columnId}
              key={task.id}
              onDelete={(taskId) => onDeleteCard(columnId, taskId)}
              onEdit={() => onEditCard(columnId, task.id)}
              onMove={(toColumnId) => onMoveCard(columnId, toColumnId, task.id)}
              task={task}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input
            className="h-8"
            onChange={(e) => setNewCardTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAddCard();
              }
            }}
            placeholder="Add an order..."
            value={newCardTitle}
          />
          <Button
            aria-label="Add order"
            disabled={!newCardTitle.trim()}
            onClick={handleAddCard}
            size="icon-sm"
            variant="outline"
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
