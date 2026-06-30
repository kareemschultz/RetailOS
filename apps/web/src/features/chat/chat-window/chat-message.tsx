// React Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
// Third-party Imports
import { format } from "date-fns";
import { CheckCheckIcon, CheckIcon, FileIcon } from "lucide-react";
import { useRef } from "react";
import MessageContent from "@/features/chat/chat-window/message-content";
// Type Imports
import type { Message } from "@/features/chat/types";
// Config Imports
import { getInitialsFromName, getMessagePreview } from "@/features/chat/utils";

export interface ChatMessageProps {
  allMessages: Message[];
  isFromMe: boolean;
  isGroupedWithPrevious?: boolean;
  message: Message;
  onReply?: (messageId: string) => void;
  referencedSenderName?: string;
  senderAvatar?: string;
  senderName: string;
  showAvatar?: boolean;
  showSenderName?: boolean;
}

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return format(date, "h:mm a");
};

const ChatMessage = (props: ChatMessageProps) => {
  // Props
  const {
    message,
    isFromMe,
    senderAvatar,
    senderName,
    allMessages,
    referencedSenderName,
    showSenderName = false,
    showAvatar = true,
    isGroupedWithPrevious = false,
    onReply,
  } = props;

  // Refs
  const lastTapRef = useRef(0);

  // Vars
  const referencedMessage = message.replyToId
    ? allMessages.find((item) => item.id === message.replyToId)
    : undefined;
  const imageAttachments =
    message.attachments?.filter((attachment) => attachment.type === "image") ??
    [];
  const fileAttachments =
    message.attachments?.filter((attachment) => attachment.type === "file") ??
    [];
  const hasImageAttachments = imageAttachments.length > 0;

  return (
    <div
      className={cn(
        "flex items-end gap-2 px-2",
        isFromMe && "flex-row-reverse",
        isGroupedWithPrevious ? "mt-1" : "mt-4 first:mt-0"
      )}
    >
      {showAvatar ? (
        <Avatar className="size-8 shrink-0">
          <AvatarImage alt={senderName} src={senderAvatar} />
          <AvatarFallback
            className={cn(
              "text-xs",
              isFromMe
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            )}
          >
            {getInitialsFromName(senderName)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div aria-hidden className="size-8 shrink-0" />
      )}

      <div
        className={cn("flex max-w-sm flex-col gap-1", isFromMe && "items-end")}
      >
        {showSenderName && !isFromMe && (
          <p className="px-1 font-medium text-muted-foreground text-xs">
            {senderName}
          </p>
        )}

        <div
          className={cn(
            "flex w-full flex-col overflow-hidden rounded-xl text-sm",
            hasImageAttachments ? "gap-0" : "gap-2 px-3 py-2",
            isFromMe
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
            onReply && "cursor-pointer"
          )}
          onDoubleClick={() => onReply?.(message.id)}
          onKeyDown={(event) => {
            if (onReply && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              onReply(message.id);
            }
          }}
          onTouchEnd={(event) => {
            if (!onReply) {
              return;
            }

            const now = Date.now();

            if (now - lastTapRef.current < 300) {
              event.preventDefault();
              onReply(message.id);
              lastTapRef.current = 0;
            } else {
              lastTapRef.current = now;
            }
          }}
          role={onReply ? "button" : undefined}
          tabIndex={onReply ? 0 : undefined}
        >
          {referencedMessage && (
            <div
              className={cn(
                "rounded-lg border-l-2 px-2.5 py-1.5 text-xs",
                hasImageAttachments ? "mx-3 mt-2" : "mb-0.5",
                isFromMe
                  ? "border-primary-foreground/50 bg-primary-foreground/15 text-primary-foreground"
                  : "border-primary/70 bg-background text-foreground"
              )}
            >
              <p
                className={cn(
                  "font-semibold",
                  isFromMe ? "text-primary-foreground" : "text-primary"
                )}
              >
                {referencedSenderName ?? "Unknown"}
              </p>
              <p className="opacity-80">
                {getMessagePreview(referencedMessage)}
              </p>
            </div>
          )}

          {imageAttachments.map((attachment) => (
            <img
              alt={attachment.name}
              className="max-h-56 w-full object-cover"
              key={attachment.id}
              src={attachment.url}
            />
          ))}

          {(fileAttachments.length > 0 || message.content) && (
            <div
              className={cn(
                "flex flex-col gap-2",
                hasImageAttachments && "px-3 py-2"
              )}
            >
              {fileAttachments.map((attachment) => (
                <a
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
                    isFromMe
                      ? "border-primary-foreground/20 bg-primary-foreground/10 hover:bg-primary-foreground/15"
                      : "border-border bg-background hover:bg-background/80"
                  )}
                  download={attachment.name}
                  href={attachment.url}
                  key={attachment.id}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <FileIcon className="size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-xs">
                      {attachment.name}
                    </p>
                    <p className="text-[10px] opacity-70">{attachment.size}</p>
                  </div>
                </a>
              ))}

              {message.content && (
                <p className="space-x-1 leading-relaxed">
                  <MessageContent
                    content={message.content}
                    isFromMe={isFromMe}
                  />
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px]",
                      isFromMe
                        ? "justify-end text-primary-foreground/75"
                        : "text-muted-foreground/75"
                    )}
                  >
                    <span>{formatTimestamp(message.timestamp)}</span>
                    {isFromMe &&
                      (message.status === "read" ? (
                        <CheckCheckIcon className="size-3" />
                      ) : message.status === "delivered" ? (
                        <CheckCheckIcon className="size-3 opacity-70" />
                      ) : (
                        <CheckIcon className="size-3 opacity-70" />
                      ))}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
