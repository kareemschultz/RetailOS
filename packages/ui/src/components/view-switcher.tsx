import {
  ToggleGroup,
  ToggleGroupItem,
} from "@RetailOS/ui/components/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@RetailOS/ui/components/tooltip";
import { cn } from "@RetailOS/ui/lib/utils";
import {
  CalendarDays,
  GitBranch,
  KanbanSquare,
  LayoutGrid,
  type LucideIcon,
  Map as MapIcon,
  Rows3,
  Table as TableIcon,
} from "lucide-react";

// RetailOS multi-view switcher — the design language's "multi-view per module"
// edge (Table · Card · Detail · Timeline, plus Calendar · Kanban · Map ·
// Hierarchy where they fit). A compact, icon-only ToggleGroup with tooltips
// (invisible UI: every icon-only control carries a hover label). Pages own which
// views they expose; this just renders the chosen set consistently.
export type ViewKind =
  | "table"
  | "card"
  | "timeline"
  | "kanban"
  | "calendar"
  | "map"
  | "hierarchy";

const VIEW_META: Record<ViewKind, { icon: LucideIcon; label: string }> = {
  table: { icon: TableIcon, label: "Table" },
  card: { icon: LayoutGrid, label: "Cards" },
  timeline: { icon: Rows3, label: "Timeline" },
  kanban: { icon: KanbanSquare, label: "Kanban" },
  calendar: { icon: CalendarDays, label: "Calendar" },
  map: { icon: MapIcon, label: "Map" },
  hierarchy: { icon: GitBranch, label: "Hierarchy" },
};

interface ViewSwitcherProps {
  className?: string;
  onChange: (view: ViewKind) => void;
  value: ViewKind;
  views: ViewKind[];
}

export function ViewSwitcher({
  views,
  value,
  onChange,
  className,
}: ViewSwitcherProps) {
  return (
    <ToggleGroup
      className={cn("gap-0.5", className)}
      onValueChange={(next) => {
        // Base UI reports the pressed set as an array. We model a single-select
        // switcher, so take the last pressed value and ignore an empty array
        // (can't deselect the active view — there is always exactly one).
        const picked = next.at(-1);
        if (picked) {
          onChange(picked as ViewKind);
        }
      }}
      value={[value]}
      variant="outline"
    >
      {views.map((view) => {
        const meta = VIEW_META[view];
        const Icon = meta.icon;
        return (
          <Tooltip key={view}>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  aria-label={meta.label}
                  className="size-8 p-0"
                  value={view}
                />
              }
            >
              <Icon className="size-4" />
            </TooltipTrigger>
            <TooltipContent>{meta.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </ToggleGroup>
  );
}
