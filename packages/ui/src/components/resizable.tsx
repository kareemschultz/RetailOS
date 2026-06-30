import { cn } from "@RetailOS/ui/lib/utils";
import type { ComponentProps, ReactNode } from "react";

// Simplified resizable layout primitive.
// Ported from the AdminCN `resizable` component, but rendered as STATIC flex
// panels because the upstream `react-resizable-panels` dependency is not yet
// available in this workspace. The public API (ResizablePanelGroup /
// ResizablePanel / ResizableHandle) and the `orientation` / `defaultSize` /
// `minSize` props are preserved so consuming layouts (e.g. the mail 3-pane)
// drop in unchanged; drag-to-resize is a no-op until the dependency lands.

type Orientation = "horizontal" | "vertical";

type ResizablePanelGroupProps = Omit<ComponentProps<"div">, "children"> & {
  orientation?: Orientation;
  children?: ReactNode;
};

function ResizablePanelGroup({
  className,
  orientation = "horizontal",
  ...props
}: ResizablePanelGroupProps) {
  return (
    <div
      className={cn(
        "flex h-full w-full",
        orientation === "vertical" ? "flex-col" : "flex-row",
        className
      )}
      data-orientation={orientation}
      data-slot="resizable-panel-group"
      {...props}
    />
  );
}

type ResizablePanelProps = Omit<ComponentProps<"div">, "style"> & {
  defaultSize?: string | number;
  minSize?: string | number;
};

function toBasis(size?: string | number): string | undefined {
  if (size === undefined) {
    return;
  }
  return typeof size === "number" ? `${size}%` : size;
}

function ResizablePanel({
  className,
  defaultSize,
  minSize,
  ...props
}: ResizablePanelProps) {
  const basis = toBasis(defaultSize);
  return (
    <div
      className={cn("min-h-0 min-w-0 overflow-hidden", className)}
      data-slot="resizable-panel"
      style={{
        flexBasis: basis,
        flexGrow: basis ? 0 : 1,
        flexShrink: 1,
        minWidth: toBasis(minSize),
      }}
      {...props}
    />
  );
}

type ResizableHandleProps = ComponentProps<"div"> & {
  withHandle?: boolean;
};

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizableHandleProps) {
  return (
    <div
      className={cn(
        "relative flex w-px shrink-0 items-center justify-center bg-border",
        "data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full",
        className
      )}
      data-slot="resizable-handle"
      {...props}
    >
      {withHandle ? (
        <div className="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" />
      ) : null}
    </div>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
