// React Imports

// Component Imports
import { Textarea } from "@RetailOS/ui/components/textarea";
import type React from "react";
// Type Imports
import type { PendingAttachment } from "@/features/chat/types";
import ComposerToolbar from "./composer-toolbar";
import PendingAttachmentsPreview from "./pending-attachments-preview";

export interface ComposerBodyProps {
  canSend: boolean;
  inputValue: string;
  isEmojiOpen: boolean;
  onAttachClick: () => void;
  onEmojiOpenChange: (open: boolean) => void;
  onFormatBold: () => void;
  onInputChange: (value: string) => void;
  onInsertEmoji: (emoji: string) => void;
  onInsertLink: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onSend: () => void;
  pendingAttachments: PendingAttachment[];
  placeholder: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

const ComposerBody = (props: ComposerBodyProps) => {
  // Props
  const {
    placeholder,
    inputValue,
    pendingAttachments,
    canSend,
    isEmojiOpen,
    textareaRef,
    onInputChange,
    onSend,
    onRemoveAttachment,
    onEmojiOpenChange,
    onInsertEmoji,
    onInsertLink,
    onFormatBold,
    onAttachClick,
  } = props;

  return (
    <div className="flex flex-col gap-3 px-3 pb-2">
      <PendingAttachmentsPreview
        attachments={pendingAttachments}
        onRemove={onRemoveAttachment}
      />

      <Textarea
        className="max-h-32 min-h-10 resize-none border-0 px-0 py-2 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
        placeholder={placeholder}
        ref={textareaRef}
        rows={1}
        value={inputValue}
      />

      <ComposerToolbar
        canSend={canSend}
        isEmojiOpen={isEmojiOpen}
        onAttachClick={onAttachClick}
        onEmojiOpenChange={onEmojiOpenChange}
        onFormatBold={onFormatBold}
        onInsertEmoji={onInsertEmoji}
        onInsertLink={onInsertLink}
        onSend={onSend}
      />
    </div>
  );
};

export default ComposerBody;
