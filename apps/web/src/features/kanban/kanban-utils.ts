import type { Task } from "./kanban-types";

export const priorityItems: Array<{ label: string; value: Task["priority"] }> =
  [
    { label: "Low", value: "low" },
    { label: "Medium", value: "medium" },
    { label: "High", value: "high" },
  ];

export const MAX_VISIBLE_ASSIGNEES = 3;

export function isDuplicateColumnTitle(
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

export function getAssigneeInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function parseDueDate(value?: string): Date | undefined {
  if (!value) {
    return;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

const GYD_FORMATTER = new Intl.NumberFormat("en-GY", {
  style: "currency",
  currency: "GYD",
  maximumFractionDigits: 0,
});

export function formatGyd(amount: number) {
  return GYD_FORMATTER.format(amount);
}
