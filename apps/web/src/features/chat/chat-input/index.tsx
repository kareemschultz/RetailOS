// React Imports

// Component Imports
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@RetailOS/ui/components/tabs";
import { useCallback, useEffect, useRef, useState } from "react";
// Third-party Imports
import { toast } from "sonner";
// Type Imports
import type {
  Attachment,
  ComposerMode,
  Conversation,
  Message,
  MessageType,
  PendingAttachment,
} from "@/features/chat/types";
import ComposerBody from "./composer-body";
// Util Imports
import {
  applyBoldFormat,
  applyLinkFormat,
  buildAttachmentFromFile,
  fileToDataUrl,
  formatFileSize,
  getMessageTypeFromAttachments,
  insertAtCursor,
  revokeAttachmentUrls,
} from "./composer-utils";
import ReplyBanner from "./reply-banner";

export interface ChatInputProps {
  activeConversation: Conversation;
  onClearReplyTo: () => void;
  onQuickReply?: (text: string) => void;
  onSendMessage: (
    content: string,
    type?: MessageType,
    attachments?: Attachment[]
  ) => void;
  replyToMessage: Message | null;
}

const ChatInput = (props: ChatInputProps) => {
  // Props
  const {
    activeConversation,
    replyToMessage,
    onSendMessage,
    onClearReplyTo,
    onQuickReply,
  } = props;

  // States
  const [inputValue, setInputValue] = useState("");
  const [composerMode, setComposerMode] = useState<ComposerMode>("reply");
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);

  // Vars
  const canSend = inputValue.trim().length > 0 || pendingAttachments.length > 0;

  const getTextareaSelection = () => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return null;
    }

    return {
      textarea,
      inputValue,
      setInputValue,
    };
  };

  const clearPendingAttachments = useCallback(() => {
    revokeAttachmentUrls(pendingAttachmentsRef.current);
    pendingAttachmentsRef.current = [];
    setPendingAttachments([]);
  }, []);

  const handleAddFiles = (files: File[]) => {
    const nextAttachments = files.map(buildAttachmentFromFile);

    pendingAttachmentsRef.current = [
      ...pendingAttachmentsRef.current,
      ...nextAttachments,
    ];
    setPendingAttachments(pendingAttachmentsRef.current);
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    const removed = pendingAttachmentsRef.current.find(
      (attachment) => attachment.id === attachmentId
    );

    if (removed) {
      URL.revokeObjectURL(removed.previewUrl);
    }

    pendingAttachmentsRef.current = pendingAttachmentsRef.current.filter(
      (attachment) => attachment.id !== attachmentId
    );
    setPendingAttachments(pendingAttachmentsRef.current);
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleInsertEmoji = (emoji: string) => {
    const selection = getTextareaSelection();

    if (selection) {
      insertAtCursor(selection, emoji);
    } else {
      setInputValue((current) => `${current}${emoji}`);
    }

    setIsEmojiOpen(false);
  };

  const handleInsertLink = () => {
    const selection = getTextareaSelection();

    if (!selection) {
      return;
    }

    const urlInput = window.prompt("Enter link URL");

    if (!urlInput?.trim()) {
      return;
    }

    applyLinkFormat(selection, urlInput);
  };

  const handleFormatBold = () => {
    const selection = getTextareaSelection();

    if (!selection) {
      return;
    }

    applyBoldFormat(selection);
  };

  const handleSend = async () => {
    if (composerMode === "note") {
      toast.info(
        "Internal notes are saved locally in this demo and are not sent to the thread."
      );
      setInputValue("");
      clearPendingAttachments();

      return;
    }

    if (!canSend) {
      return;
    }

    const attachments: Attachment[] = await Promise.all(
      pendingAttachments.map(async (attachment) => ({
        id: attachment.id,
        name: attachment.file.name,
        size: formatFileSize(attachment.file.size),
        type: attachment.type,
        url: await fileToDataUrl(attachment.file),
      }))
    );

    const messageType = getMessageTypeFromAttachments(pendingAttachments);

    revokeAttachmentUrls(pendingAttachmentsRef.current);
    pendingAttachmentsRef.current = [];
    setPendingAttachments([]);

    onSendMessage(
      inputValue.trim(),
      messageType,
      attachments.length > 0 ? attachments : undefined
    );
    setInputValue("");
  };

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(
    () => () => {
      revokeAttachmentUrls(pendingAttachmentsRef.current);
    },
    []
  );

  useEffect(() => {
    setTimeout(() => {
      setInputValue("");
      clearPendingAttachments();
      setComposerMode("reply");
    }, 0);
  }, [clearPendingAttachments]);

  const composerBodyProps = {
    inputValue,
    pendingAttachments,
    canSend,
    isEmojiOpen,
    textareaRef,
    onInputChange: setInputValue,
    onSend: handleSend,
    onRemoveAttachment: handleRemoveAttachment,
    onEmojiOpenChange: setIsEmojiOpen,
    onInsertEmoji: handleInsertEmoji,
    onInsertLink: handleInsertLink,
    onFormatBold: handleFormatBold,
    onAttachClick: handleAttachClick,
  };

  return (
    <div className="flex flex-col gap-2 px-2 pb-3">
      {activeConversation.suggestions.length > 0 &&
        !inputValue &&
        pendingAttachments.length === 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {activeConversation.suggestions.map((suggestion) => (
              <button
                className="rounded-full border border-border bg-background px-3 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
                key={suggestion}
                onClick={() =>
                  onQuickReply
                    ? onQuickReply(suggestion)
                    : setInputValue(suggestion)
                }
                type="button"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

      <Tabs
        className="rounded-md border border-border"
        onValueChange={(value) => setComposerMode(value as ComposerMode)}
        value={composerMode}
      >
        <TabsList
          className="w-full justify-start gap-2 border-b px-3 **:data-[slot=tabs-trigger]:border-x-0 **:data-[slot=tabs-trigger]:px-6 group-data-horizontal/tabs:h-10"
          variant="line"
        >
          <TabsTrigger className="flex-none px-1" value="reply">
            Reply
          </TabsTrigger>
          <TabsTrigger className="flex-none px-1" value="note">
            Internal note
          </TabsTrigger>
        </TabsList>

        <TabsContent className="m-0" value="reply">
          {replyToMessage && composerMode === "reply" && (
            <div className="px-3 pt-3">
              <ReplyBanner
                onClearReplyTo={onClearReplyTo}
                replyToMessage={replyToMessage}
              />
            </div>
          )}
          <ComposerBody
            placeholder="Type your message..."
            {...composerBodyProps}
          />
        </TabsContent>

        <TabsContent className="m-0" value="note">
          <ComposerBody
            placeholder="Write an internal note..."
            {...composerBodyProps}
          />
        </TabsContent>
      </Tabs>

      <input
        accept="image/*,.pdf,.doc,.docx,.txt,.zip"
        aria-hidden
        className="sr-only"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);

          if (files.length > 0) {
            handleAddFiles(files);
          }

          event.target.value = "";
        }}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />
    </div>
  );
};

export default ChatInput;
