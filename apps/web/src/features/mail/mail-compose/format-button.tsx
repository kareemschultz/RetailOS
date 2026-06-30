// React Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@RetailOS/ui/components/tooltip";
import type { ReactNode } from "react";

export const FormatButton = ({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={onClick}
          size="icon-sm"
          type="button"
          variant="ghost"
        />
      }
    >
      {children}
      <span className="sr-only">{label}</span>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);
