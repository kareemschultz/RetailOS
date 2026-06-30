// Third-party Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import { StarIcon } from "lucide-react";

// Config Imports
import {
  formatMailDate,
  getInitialsFromName,
  MAIL_LABEL_STYLES,
} from "@/features/mail/mail-config";
// Type Imports
import type { Email } from "@/features/mail/types";

interface MailItemProps {
  email: Email;
  isSelected: boolean;
  onClick: () => void;
}

const MailItem = ({ email, isSelected, onClick }: MailItemProps) => {
  // Vars
  const threadMessageCount = email.thread.messages.length;

  return (
    <button
      className={cn(
        "relative flex w-full items-start gap-3 rounded-md border border-transparent p-3 text-left text-sm transition-colors",
        isSelected ? "border-border bg-accent" : "hover:bg-muted/40",
        !email.isRead && ""
      )}
      onClick={onClick}
      type="button"
    >
      <Avatar className="size-10 shrink-0">
        <AvatarImage alt={email.from} src={email.avatar} />
        <AvatarFallback>{getInitialsFromName(email.from)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              email.isRead
                ? "text-foreground/80"
                : "font-semibold text-foreground"
            )}
          >
            {email.from}
          </span>
          {email.isStarred && (
            <StarIcon className="size-3.5 shrink-0 fill-primary text-primary" />
          )}
          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
            {formatMailDate(email.date)}
          </span>
        </div>
        <p
          className={cn(
            "line-clamp-1 flex items-center justify-between gap-1 text-xs leading-snug",
            email.isRead
              ? "text-foreground/75"
              : "font-semibold text-foreground"
          )}
        >
          <span>
            {email.subject}
            {threadMessageCount > 1 && (
              <span className="ml-1 font-normal text-muted-foreground">
                ({threadMessageCount})
              </span>
            )}
          </span>
          {email.labels.length > 0 && (
            <span className="flex flex-1 justify-end gap-1">
              {email.labels.map((label) => {
                const labelStyle = MAIL_LABEL_STYLES.find(
                  (style) => style.id === label
                );

                return (
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      labelStyle?.color
                    )}
                    key={label}
                  />
                );
              })}
            </span>
          )}
        </p>
        <p className="line-clamp-1 text-[11px] text-muted-foreground leading-relaxed">
          {email.preview}
        </p>
      </div>
    </button>
  );
};

export default MailItem;
