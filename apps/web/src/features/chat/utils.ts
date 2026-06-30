// Type Imports
import type { Message } from "@/features/chat/types";

export const getMessagePreview = (message: Message) => {
  if (message.type === "image") {
    return "Photo";
  }

  if (message.type === "file") {
    return message.attachments?.[0]?.name ?? "File";
  }

  return message.content;
};

export const isSameMessageSender = (
  previousMessage: Message | undefined,
  message: Message
) => previousMessage?.senderId === message.senderId;

// Co-located from the AdminCN mailConfig (chat dialogs/avatars use it for the
// avatar fallback initials); kept here so the chat feature has no mail dependency.
export const getInitialsFromName = (name: string) =>
  name
    .split(" ")
    .map((namePart) => namePart[0])
    .join("");
