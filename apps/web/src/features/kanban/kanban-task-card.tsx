import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@RetailOS/ui/components/avatar";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@RetailOS/ui/components/tooltip";
import { cn } from "@RetailOS/ui/lib/utils";
import {
  CalendarIcon,
  EllipsisVerticalIcon,
  MapPinIcon,
  MoveRightIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import type { Assignee, ColumnSummary, Task } from "./kanban-types";
import {
  formatGyd,
  getAssigneeInitials,
  MAX_VISIBLE_ASSIGNEES,
} from "./kanban-utils";

function TaskAssigneeAvatars({ assignees }: { assignees: Assignee[] }) {
  const visibleAssignees = assignees.slice(0, MAX_VISIBLE_ASSIGNEES);
  const hiddenCount = assignees.length - MAX_VISIBLE_ASSIGNEES;

  return (
    <AvatarGroup className="*:data-[slot=avatar]:size-5 *:data-[slot=avatar]:ring-1">
      {visibleAssignees.map((assignee) => (
        <Tooltip key={assignee.name}>
          <TooltipTrigger
            render={
              <Avatar className="ring-2 ring-background" data-size="sm">
                <AvatarFallback className="text-xs">
                  {getAssigneeInitials(assignee.name)}
                </AvatarFallback>
              </Avatar>
            }
          />
          <TooltipContent>{assignee.name}</TooltipContent>
        </Tooltip>
      ))}
      {hiddenCount > 0 && (
        <Tooltip>
          <TooltipTrigger
            render={
              <AvatarGroupCount className="size-5 text-xs ring-2">
                +{hiddenCount}
              </AvatarGroupCount>
            }
          />
          <TooltipContent>+{hiddenCount} more</TooltipContent>
        </Tooltip>
      )}
    </AvatarGroup>
  );
}

interface TaskCardProps {
  className?: string;
  columns: ColumnSummary[];
  currentColumnId: string;
  onDelete?: (taskId: string) => void;
  onEdit?: () => void;
  onMove?: (toColumnId: string) => void;
  task: Task;
}

export function TaskCard({
  task,
  columns,
  currentColumnId,
  className,
  onEdit,
  onDelete,
  onMove,
}: TaskCardProps) {
  const hasFooter =
    (task.assignees && task.assignees.length > 0) || task.dueDate;
  const moveTargets = columns.filter((column) => column.id !== currentColumnId);
  const hasActions = Boolean(onEdit || onDelete || onMove);

  return (
    <Card className={cn("group/card rounded-lg py-3", className)}>
      <CardContent className="px-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                className={cn(
                  "capitalize",
                  task.priority === "high"
                    ? "bg-destructive/10 text-destructive"
                    : task.priority === "medium"
                      ? "bg-amber-600/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400"
                      : "bg-indigo-500/10 text-indigo-500"
                )}
              >
                {task.priority}
              </Badge>
              {task.code && (
                <Badge className="font-mono" variant="outline">
                  {task.code}
                </Badge>
              )}
            </div>

            {hasActions && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      className="shrink-0 opacity-100 transition-opacity group-hover/card:opacity-100 sm:opacity-0"
                      size="icon-xs"
                      variant="ghost"
                    />
                  }
                >
                  <EllipsisVerticalIcon className="size-3.5" />
                  <span className="sr-only">Card actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {onEdit && (
                    <DropdownMenuItem onClick={onEdit}>
                      <PencilIcon />
                      Edit order
                    </DropdownMenuItem>
                  )}
                  {onMove && moveTargets.length > 0 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <MoveRightIcon />
                        Move to
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {moveTargets.map((column) => (
                          <DropdownMenuItem
                            key={column.id}
                            onClick={() => onMove(column.id)}
                          >
                            {column.title}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  {onDelete && (onEdit || onMove) && <DropdownMenuSeparator />}
                  {onDelete && (
                    <DropdownMenuItem
                      onClick={() => onDelete(task.id)}
                      variant="destructive"
                    >
                      <Trash2Icon />
                      Delete order
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="space-y-1">
            <p className="line-clamp-2 font-medium text-sm leading-snug">
              {task.title}
            </p>
            {task.supplier && (
              <p className="text-muted-foreground text-xs">{task.supplier}</p>
            )}
          </div>

          {(task.store || typeof task.amountGyd === "number") && (
            <div className="flex items-center justify-between gap-2">
              {task.store ? (
                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                  <MapPinIcon className="size-3" />
                  {task.store}
                </span>
              ) : (
                <span />
              )}
              {typeof task.amountGyd === "number" && (
                <span className="font-medium font-mono text-xs">
                  {formatGyd(task.amountGyd)}
                </span>
              )}
            </div>
          )}

          {hasFooter && (
            <div className="flex items-center justify-between gap-2 pt-0.5">
              {task.assignees && task.assignees.length > 0 ? (
                <TaskAssigneeAvatars assignees={task.assignees} />
              ) : (
                <span />
              )}
              {task.dueDate && (
                <div className="flex shrink-0 items-center gap-1 text-muted-foreground text-xs">
                  <CalendarIcon className="size-3" />
                  <time>{task.dueDate}</time>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
