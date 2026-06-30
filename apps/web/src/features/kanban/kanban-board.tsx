import { Button } from "@RetailOS/ui/components/button";
import { Input } from "@RetailOS/ui/components/input";
import { ScrollArea, ScrollBar } from "@RetailOS/ui/components/scroll-area";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { ColumnEditDialog } from "./kanban-column-edit-dialog";
import { useKanbanStore } from "./kanban-store";
import { TaskColumn } from "./kanban-task-column";
import { TaskEditDialog } from "./kanban-task-edit-dialog";
import type { ColumnSummary } from "./kanban-types";

function AddColumn({
  onAdd,
  validate,
}: {
  onAdd: (title: string) => void;
  validate: (title: string) => string | undefined;
}) {
  const [title, setTitle] = useState("");
  const trimmed = title.trim();
  const error = trimmed ? validate(trimmed) : undefined;

  function handleAdd() {
    if (!trimmed || error) {
      return;
    }

    onAdd(trimmed);
    setTitle("");
  }

  return (
    <div className="flex w-72 shrink-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          aria-invalid={Boolean(error)}
          className="h-8 bg-card"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleAdd();
            }
          }}
          placeholder="Add a stage..."
          value={title}
        />
        <Button
          aria-label="Add stage"
          disabled={!trimmed || Boolean(error)}
          onClick={handleAdd}
          size="icon-sm"
          variant="outline"
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

export function KanbanBoard() {
  const columns = useKanbanStore((s) => s.columns);
  const columnTitles = useKanbanStore((s) => s.columnTitles);
  const addColumn = useKanbanStore((s) => s.addColumn);
  const deleteColumn = useKanbanStore((s) => s.deleteColumn);
  const updateColumnTitle = useKanbanStore((s) => s.updateColumnTitle);
  const validateNewColumnTitle = useKanbanStore(
    (s) => s.validateNewColumnTitle
  );
  const addCard = useKanbanStore((s) => s.addCard);
  const deleteCard = useKanbanStore((s) => s.deleteCard);
  const updateCard = useKanbanStore((s) => s.updateCard);
  const moveCard = useKanbanStore((s) => s.moveCard);

  const [editingTask, setEditingTask] = useState<{
    columnId: string;
    taskId: string;
  } | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);

  const orderedColumnIds = Object.keys(columns);
  const columnSummaries: ColumnSummary[] = orderedColumnIds.map((id) => ({
    id,
    title: columnTitles[id] ?? id,
  }));

  const editingTaskData =
    editingTask &&
    columns[editingTask.columnId]?.find((t) => t.id === editingTask.taskId);

  return (
    <>
      <ScrollArea className="h-full">
        <div className="flex gap-4 p-1">
          {orderedColumnIds.map((columnId) => (
            <TaskColumn
              columnId={columnId}
              columns={columnSummaries}
              key={columnId}
              onAddCard={addCard}
              onDeleteCard={deleteCard}
              onDeleteColumn={deleteColumn}
              onEditCard={(colId, taskId) =>
                setEditingTask({ columnId: colId, taskId })
              }
              onEditColumn={setEditingColumnId}
              onMoveCard={moveCard}
              tasks={columns[columnId] ?? []}
              title={columnTitles[columnId] ?? columnId}
            />
          ))}

          <AddColumn onAdd={addColumn} validate={validateNewColumnTitle} />
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <TaskEditDialog
        onOpenChange={(open) => {
          if (!open) {
            setEditingTask(null);
          }
        }}
        onSave={(updates) => {
          if (editingTask) {
            updateCard(editingTask.columnId, editingTask.taskId, updates);
          }
        }}
        open={Boolean(editingTask) && Boolean(editingTaskData)}
        task={editingTaskData ?? null}
      />

      <ColumnEditDialog
        columnId={editingColumnId ?? ""}
        columnTitles={columnTitles}
        onOpenChange={(open) => {
          if (!open) {
            setEditingColumnId(null);
          }
        }}
        onSave={(title) => {
          if (editingColumnId) {
            updateColumnTitle(editingColumnId, title);
          }
        }}
        open={Boolean(editingColumnId)}
        title={
          editingColumnId
            ? (columnTitles[editingColumnId] ?? editingColumnId)
            : ""
        }
      />
    </>
  );
}
