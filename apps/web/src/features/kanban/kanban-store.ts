import { create } from "zustand";

import { initialColumns, teamMembers } from "./kanban-data";
import type { Assignee, Task } from "./kanban-types";

// Ported from the AdminCN use-kanban-store. The drag-and-drop reorder action
// (setColumns) is kept, plus a moveCard action that replaces dnd-kit drag (not
// available in this repo) with an explicit "move to column" menu action.
const INITIAL_COLUMN_TITLES: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  ordered: "Ordered",
  received: "Received",
};

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function isDuplicateColumnTitle(
  title: string,
  columnTitles: Record<string, string>,
  excludeColumnId?: string
) {
  const normalized = title.trim().toLowerCase();

  return Object.entries(columnTitles).some(
    ([id, existing]) =>
      id !== excludeColumnId && existing.trim().toLowerCase() === normalized
  );
}

export function resolveAssignees(names: string[]): Assignee[] {
  return names.map(
    (name) => teamMembers.find((member) => member.name === name) ?? { name }
  );
}

interface KanbanState {
  // Card mutations
  addCard: (columnId: string, title: string) => void;

  // Column mutations
  addColumn: (title: string) => void;
  columns: Record<string, Task[]>;
  columnTitles: Record<string, string>;
  deleteCard: (columnId: string, taskId: string) => void;
  deleteColumn: (columnId: string) => void;
  moveCard: (fromColumnId: string, toColumnId: string, taskId: string) => void;
  updateCard: (
    columnId: string,
    taskId: string,
    updates: Partial<Task>
  ) => void;
  updateColumnTitle: (columnId: string, title: string) => void;
  validateNewColumnTitle: (title: string) => string | undefined;
}

export const useKanbanStore = create<KanbanState>()((set, get) => ({
  columns: initialColumns,
  columnTitles: INITIAL_COLUMN_TITLES,

  addColumn: (title) => {
    const trimmed = title.trim();
    const { columnTitles } = get();

    if (!trimmed || isDuplicateColumnTitle(trimmed, columnTitles)) {
      return;
    }

    const id = `${trimmed.toLowerCase().replace(/\s+/g, "-")}-${generateId()}`;

    set((state) => ({
      columnTitles: { ...state.columnTitles, [id]: trimmed },
      columns: { ...state.columns, [id]: [] },
    }));
  },

  deleteColumn: (columnId) => {
    set((state) => {
      const columnTitles = { ...state.columnTitles };
      const columns = { ...state.columns };

      delete columnTitles[columnId];
      delete columns[columnId];

      return { columnTitles, columns };
    });
  },

  updateColumnTitle: (columnId, title) => {
    const trimmed = title.trim();
    const { columnTitles } = get();

    if (!trimmed || isDuplicateColumnTitle(trimmed, columnTitles, columnId)) {
      return;
    }

    set((state) => ({
      columnTitles: { ...state.columnTitles, [columnId]: trimmed },
    }));
  },

  validateNewColumnTitle: (title) => {
    const { columnTitles } = get();

    if (isDuplicateColumnTitle(title, columnTitles)) {
      return "A column with this name already exists.";
    }

    return;
  },

  addCard: (columnId, title) => {
    const trimmed = title.trim();

    if (!trimmed) {
      return;
    }

    const newTask: Task = {
      id: generateId(),
      title: trimmed,
      priority: "medium",
    };

    set((state) => ({
      columns: {
        ...state.columns,
        [columnId]: [...(state.columns[columnId] ?? []), newTask],
      },
    }));
  },

  deleteCard: (columnId, taskId) => {
    set((state) => ({
      columns: {
        ...state.columns,
        [columnId]: (state.columns[columnId] ?? []).filter(
          (t) => t.id !== taskId
        ),
      },
    }));
  },

  updateCard: (columnId, taskId, updates) => {
    set((state) => ({
      columns: {
        ...state.columns,
        [columnId]: (state.columns[columnId] ?? []).map((t) =>
          t.id === taskId ? { ...t, ...updates } : t
        ),
      },
    }));
  },

  moveCard: (fromColumnId, toColumnId, taskId) => {
    if (fromColumnId === toColumnId) {
      return;
    }

    set((state) => {
      const fromTasks = state.columns[fromColumnId] ?? [];
      const card = fromTasks.find((t) => t.id === taskId);

      if (!card) {
        return state;
      }

      return {
        columns: {
          ...state.columns,
          [fromColumnId]: fromTasks.filter((t) => t.id !== taskId),
          [toColumnId]: [...(state.columns[toColumnId] ?? []), card],
        },
      };
    });
  },
}));
