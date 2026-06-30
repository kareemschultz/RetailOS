// Third-party Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@RetailOS/ui/components/popover";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import { CheckIcon, Tag } from "lucide-react";

// Config Imports
import {
  MAIL_LABEL_NAV_ITEMS,
  MAIL_LABEL_STYLES,
} from "@/features/mail/mail-config";
// Type Imports
import type { EmailLabel } from "@/features/mail/types";

export const LabelManager = ({
  emailId,
  labels,
  onToggleLabel,
}: {
  emailId: string;
  labels: EmailLabel[];
  onToggleLabel: (id: string, label: EmailLabel) => void;
}) => (
  <Popover>
    <PopoverTrigger
      render={
        <Button size="icon" title="Manage labels" variant="ghost">
          <Tag className="size-4" />
          <span className="sr-only">Manage labels</span>
        </Button>
      }
    />
    <PopoverContent align="start" className="flex w-40 flex-col gap-1 p-1">
      {MAIL_LABEL_NAV_ITEMS.map((labelItem) => {
        const labelStyle = MAIL_LABEL_STYLES.find(
          (labelStyleItem) => labelStyleItem.id === labelItem.id
        );
        const isActive = labels.includes(labelItem.id);

        return (
          <Button
            className="w-full justify-start gap-2"
            key={labelItem.id}
            onClick={() => onToggleLabel(emailId, labelItem.id)}
            size="sm"
            title={labelItem.label}
            type="button"
            variant="ghost"
          >
            <span
              className={cn(
                "size-2.5 shrink-0 rounded-full",
                labelStyle?.color
              )}
            />
            <span className="flex-1 text-left">{labelItem.label}</span>
            {isActive && <CheckIcon className="size-4 shrink-0" />}
          </Button>
        );
      })}
    </PopoverContent>
  </Popover>
);
