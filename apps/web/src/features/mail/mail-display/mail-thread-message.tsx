// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";

// Config Imports
import {
  formatMailDate,
  getInitialsFromName,
} from "@/features/mail/mail-config";
// Type Imports
import type { ThreadMessage } from "@/features/mail/types";

export const MailThreadMessage = ({
  message,
  avatar,
  variant = "card",
}: {
  message: ThreadMessage;
  avatar?: string;
  variant?: "card" | "plain";
}) => {
  // Vars
  const content = (
    <>
      <div className="mb-4 flex items-start gap-3">
        <Avatar className="size-9 shrink-0">
          <AvatarImage alt={message.from} src={avatar} />
          <AvatarFallback>{getInitialsFromName(message.from)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm">{message.from}</span>
            <span className="shrink-0 text-muted-foreground text-xs">
              {formatMailDate(message.date)}
            </span>
          </div>
          <div className="text-muted-foreground text-xs">
            {message.fromEmail}
          </div>
        </div>
      </div>
      <div className="whitespace-pre-wrap text-foreground/80 text-sm">
        {message.body}
      </div>
    </>
  );

  if (variant === "plain") {
    return <div className="px-3">{content}</div>;
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
      {content}
    </div>
  );
};
