import { cn } from "@RetailOS/ui/lib/utils";
import type { ComponentProps } from "react";

// Dropped in from the AdminCN template (Assembly Law). Owned, RetailOS-formatted.
function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-sm bg-muted px-1 font-medium font-sans text-muted-foreground text-xs",
        className
      )}
      data-slot="kbd"
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <kbd
      className={cn("inline-flex items-center gap-1", className)}
      data-slot="kbd-group"
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
