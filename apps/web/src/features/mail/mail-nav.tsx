// Third-party Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { Separator } from "@RetailOS/ui/components/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@RetailOS/ui/components/tooltip";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  ArchiveIcon,
  ArchiveXIcon,
  FileIcon,
  InboxIcon,
  SendIcon,
  TrashIcon,
} from "lucide-react";

// Config Imports
import {
  MAIL_LABEL_STYLES,
  type MailNavLabelItemWithCount,
  type MailNavStatusItemWithCount,
} from "@/features/mail/mail-config";
// Type Imports
import type {
  EmailLabel,
  EmailStatus,
  MailNavType,
} from "@/features/mail/types";

const statusIcons: Record<EmailStatus, LucideIcon> = {
  inbox: InboxIcon,
  sent: SendIcon,
  drafts: FileIcon,
  spam: ArchiveXIcon,
  trash: TrashIcon,
  archive: ArchiveIcon,
};

interface MailNavProps {
  activeLabel: EmailLabel | null;
  activeNavType: MailNavType;
  activeStatus: EmailStatus;
  labelNavItems: MailNavLabelItemWithCount[];
  onLabelChange: (label: EmailLabel) => void;
  onStatusChange: (status: EmailStatus) => void;
  statusNavItems: MailNavStatusItemWithCount[];
}

const MailNav = ({
  statusNavItems,
  labelNavItems,
  activeStatus,
  activeLabel,
  activeNavType,
  onStatusChange,
  onLabelChange,
}: MailNavProps) => (
  <div className="flex flex-1 flex-col gap-4 overflow-auto p-3 max-lg:pt-0">
    <div>
      <p className="px-2 pb-2.5 font-medium text-[11px] text-muted-foreground uppercase">
        Mailboxes
      </p>
      <nav className="grid gap-1">
        {statusNavItems.map((statusItem) => {
          const StatusIcon = statusIcons[statusItem.id];
          const isStatusActive =
            activeNavType === "status" && activeStatus === statusItem.id;

          return (
            <Tooltip key={statusItem.id}>
              <TooltipTrigger
                render={
                  <Button
                    className={cn(
                      "justify-start gap-2.5 px-3",
                      isStatusActive
                        ? "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground"
                        : "text-foreground/80 hover:bg-muted/60"
                    )}
                    onClick={() => onStatusChange(statusItem.id)}
                    variant="ghost"
                  />
                }
              >
                <StatusIcon className="size-4 shrink-0 opacity-70" />
                {statusItem.label}
                {statusItem.count > 0 && (
                  <span className="ml-auto text-muted-foreground text-xs tabular-nums">
                    {statusItem.count}
                  </span>
                )}
              </TooltipTrigger>
              <TooltipContent className="flex items-center gap-2" side="right">
                {statusItem.label}
                {statusItem.count > 0 && (
                  <span className="ml-auto text-primary-foreground">
                    {statusItem.count}
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </div>

    <Separator />

    <div>
      <p className="px-2 pb-2.5 font-medium text-[11px] text-muted-foreground uppercase">
        Labels
      </p>
      <nav className="grid gap-1">
        {labelNavItems.map((labelItem) => {
          const labelStyle = MAIL_LABEL_STYLES.find(
            (labelStyleItem) => labelStyleItem.id === labelItem.id
          );
          const isLabelActive =
            activeNavType === "label" && activeLabel === labelItem.id;

          return (
            <Tooltip key={labelItem.id}>
              <TooltipTrigger
                render={
                  <Button
                    className={cn(
                      "justify-start gap-2.5 px-3",
                      isLabelActive
                        ? "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground"
                        : "text-foreground/80 hover:bg-muted/60"
                    )}
                    onClick={() => onLabelChange(labelItem.id)}
                    variant="ghost"
                  />
                }
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    labelStyle?.color
                  )}
                />
                {labelItem.label}
                {labelItem.count > 0 && (
                  <span className="ml-auto text-muted-foreground text-xs tabular-nums">
                    {labelItem.count}
                  </span>
                )}
              </TooltipTrigger>
              <TooltipContent className="flex items-center gap-2" side="right">
                {labelItem.label}
                {labelItem.count > 0 && (
                  <span className="ml-auto text-primary-foreground">
                    {labelItem.count}
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </div>
  </div>
);

export default MailNav;
