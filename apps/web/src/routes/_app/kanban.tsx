import { createFileRoute } from "@tanstack/react-router";

import { KanbanBoard } from "@/features/kanban/kanban-board";

export const Route = createFileRoute("/_app/kanban")({
  component: KanbanScreen,
});

function KanbanScreen() {
  return (
    <div className="flex h-full w-full flex-col gap-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">
          Procurement board
        </h1>
        <p className="text-muted-foreground text-sm">
          Track purchase orders from draft to received across your stores and
          warehouses.
        </p>
      </div>
      <KanbanBoard />
    </div>
  );
}
