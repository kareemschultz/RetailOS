// React Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
import { Badge } from "@RetailOS/ui/components/badge";
import { ScrollArea } from "@RetailOS/ui/components/scroll-area";
// Third-party Imports
import { format, isToday, isYesterday } from "date-fns";
import { useEffect, useMemo, useRef } from "react";
// Type Imports
import type { ChatUser, Message } from "@/features/chat/types";
// Config Imports
// Util Imports
import {
  getInitialsFromName,
  isSameMessageSender,
} from "@/features/chat/utils";
import ChatMessage from "./chat-message";

export interface ChatMessagesProps {
  contacts: ChatUser[];
  currentUser: ChatUser;
  currentUserId: string;
  isGroupChat?: boolean;
  isTyping: boolean;
  messages: Message[];
  onReplyToMessage?: (messageId: string) => void;
  typingContact?: ChatUser;
}

const getDateLabel = (timestamp: string) => {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  if (isToday(date)) {
    return "Today";
  }

  if (isYesterday(date)) {
    return "Yesterday";
  }

  return format(date, "MMM d");
};

const ChatMessages = (props: ChatMessagesProps) => {
  // Props
  const {
    messages,
    currentUserId,
    contacts,
    currentUser,
    isTyping,
    typingContact,
    isGroupChat = false,
    onReplyToMessage,
  } = props;

  // Refs
  const bottomRef = useRef<HTMLDivElement>(null);

  const getSenderInfo = (message: Message) => {
    if (message.senderId === currentUserId) {
      return {
        name: currentUser.name,
        avatar: currentUser.avatar,
      };
    }

    const contact = contacts.find((item) => item.id === message.senderId);

    return {
      name: contact?.name ?? "Unknown",
      avatar: contact?.avatar,
    };
  };

  const getReferencedSenderName = (referencedMessage: Message) => {
    if (referencedMessage.senderId === currentUserId) {
      return currentUser.name;
    }

    return (
      contacts.find((item) => item.id === referencedMessage.senderId)?.name ??
      "Unknown"
    );
  };

  // Hooks
  const messageGroups = useMemo(() => {
    const groups: { dateKey: string; label: string; messages: Message[] }[] =
      [];

    for (const message of messages) {
      const messageDate = new Date(message.timestamp);
      const dateKey = Number.isNaN(messageDate.getTime())
        ? message.timestamp
        : format(messageDate, "yyyy-MM-dd");
      const existingGroup = groups.find((group) => group.dateKey === dateKey);

      if (existingGroup) {
        existingGroup.messages.push(message);
      } else {
        groups.push({
          dateKey,
          label: getDateLabel(message.timestamp),
          messages: [message],
        });
      }
    }

    return groups;
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <ScrollArea className="min-h-0 flex-1 [&_[data-orientation=vertical][data-slot=scroll-area-scrollbar]]:w-1.5">
      <div className="flex flex-col gap-6 px-2 py-8">
        {messageGroups.map((group) => (
          <div className="flex flex-col" key={group.dateKey}>
            <div className="text-center">
              <Badge
                className="font-normal text-muted-foreground hover:bg-transparent"
                variant="ghost"
              >
                {group.label}
              </Badge>
            </div>

            {group.messages.map((message, messageIndex) => {
              const sender = getSenderInfo(message);
              const previousMessage =
                messageIndex > 0 ? group.messages[messageIndex - 1] : undefined;
              const isGroupedWithPrevious = isSameMessageSender(
                previousMessage,
                message
              );

              const referencedMessage = message.replyToId
                ? messages.find((item) => item.id === message.replyToId)
                : undefined;

              return (
                <ChatMessage
                  allMessages={messages}
                  isFromMe={message.senderId === currentUserId}
                  isGroupedWithPrevious={isGroupedWithPrevious}
                  key={message.id}
                  message={message}
                  onReply={onReplyToMessage}
                  referencedSenderName={
                    referencedMessage
                      ? getReferencedSenderName(referencedMessage)
                      : undefined
                  }
                  senderAvatar={sender.avatar}
                  senderName={sender.name}
                  showAvatar={!isGroupedWithPrevious}
                  showSenderName={isGroupChat && !isGroupedWithPrevious}
                />
              );
            })}
          </div>
        ))}

        {isTyping && typingContact && (
          <div className="flex items-end gap-2 px-2">
            <Avatar className="size-8 shrink-0">
              <AvatarImage
                alt={typingContact.name}
                src={typingContact.avatar}
              />
              <AvatarFallback className="text-xs">
                {getInitialsFromName(typingContact.name)}
              </AvatarFallback>
            </Avatar>
            <div className="rounded-xl bg-muted px-4 py-3">
              <div className="flex items-center gap-1">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
};

export default ChatMessages;
