// Third-party Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { BellOffIcon, ImageIcon, PaperclipIcon, PinIcon } from "lucide-react";
// Type Imports
import type {
  ChatUser,
  ChatUserStatus,
  Conversation,
} from "@/features/chat/types";
// Config Imports
import { getInitialsFromName } from "@/features/chat/utils";

export interface ChatListItemProps {
  contact?: ChatUser;
  conversation: Conversation;
  currentUser: ChatUser;
  isActive: boolean;
  onSelect: (id: string) => void;
}

const STATUS_DOT_CLASSES: Record<ChatUserStatus, string> = {
  online: "bg-green-500",
  away: "bg-yellow-500",
  busy: "bg-red-500",
  offline: "bg-muted-foreground",
};

const formatMessageTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60_000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  if (isToday(date)) {
    return format(date, "h:mm a");
  }

  if (isYesterday(date)) {
    return "Yesterday";
  }

  return format(date, "MMM d");
};

const ChatListItem = (props: ChatListItemProps) => {
  // Props
  const { conversation, contact, currentUser, isActive, onSelect } = props;

  // Vars
  const lastMessage = conversation.messages.at(-1);
  const displayName =
    conversation.type === "group"
      ? (conversation.groupName ?? "Group")
      : (contact?.name ?? "Unknown");
  const avatarSrc =
    conversation.type === "group" ? conversation.groupAvatar : contact?.avatar;
  const hasUnread = conversation.unreadCount > 0;
  const isOwnLastMessage = lastMessage?.senderId === currentUser.id;

  const lastMessagePreview = (() => {
    if (!lastMessage) {
      return "No messages yet";
    }

    if (lastMessage.type === "image") {
      return (
        <span className="inline-flex items-center gap-1">
          <ImageIcon className="size-3 shrink-0" />
          Photo
        </span>
      );
    }

    if (lastMessage.type === "file") {
      const fileName = lastMessage.attachments?.[0]?.name ?? "File";

      return (
        <span className="inline-flex items-center gap-1">
          <PaperclipIcon className="size-3 shrink-0" />
          {fileName}
        </span>
      );
    }

    return (
      <>
        {isOwnLastMessage && <span>You: </span>}
        {lastMessage.content}
      </>
    );
  })();

  const timestamp = lastMessage
    ? formatMessageTimestamp(lastMessage.timestamp)
    : "";

  return (
    <button
      className={cn(
        "w-full overflow-hidden rounded-lg px-2.5 py-2.5 text-left ring-inset transition-colors",
        isActive ? "bg-muted ring-1 ring-border" : "hover:bg-muted/75"
      )}
      onClick={(event) => {
        event.currentTarget.blur();
        onSelect(conversation.id);
      }}
      type="button"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="relative shrink-0">
          <Avatar size="lg">
            <AvatarImage alt={displayName} src={avatarSrc} />
            <AvatarFallback
              className={cn("text-xs", isActive && "bg-background/50")}
            >
              {getInitialsFromName(displayName)}
            </AvatarFallback>
          </Avatar>
          {conversation.type === "direct" && contact && (
            <span
              className={cn(
                "absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-background",
                STATUS_DOT_CLASSES[contact.status]
              )}
            />
          )}
        </div>

        <div className="w-0 min-w-0 flex-1 overflow-hidden">
          <div className="flex w-full items-center justify-between gap-2">
            <div
              className={cn(
                "truncate text-sm leading-5",
                hasUnread
                  ? "font-semibold text-foreground"
                  : "font-medium text-foreground/90"
              )}
            >
              {displayName}
            </div>
            {timestamp && (
              <span className="shrink-0 text-muted-foreground text-xs tabular-nums leading-5">
                {timestamp}
              </span>
            )}
          </div>

          <div className="flex min-w-0 items-end gap-2">
            <div className="w-0 min-w-0 flex-1 overflow-hidden">
              <div className="truncate text-muted-foreground text-xs leading-4">
                {lastMessagePreview}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {conversation.isPinned && (
                <div className="grid size-5 place-items-center">
                  <PinIcon className="size-3 fill-current opacity-70" />
                </div>
              )}
              {conversation.isMuted && (
                <div className="grid size-5 place-items-center">
                  <BellOffIcon className="size-3 text-muted-foreground" />
                </div>
              )}
              {hasUnread && (
                <div className="grid size-5 min-w-5 place-items-center rounded-full bg-primary px-1 font-medium text-primary-foreground text-xs">
                  {conversation.unreadCount}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};

export default ChatListItem;
