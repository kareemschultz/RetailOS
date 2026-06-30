// Third-party Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@RetailOS/ui/components/popover";
import { LinkIcon, PaperclipIcon, SendIcon, SmileIcon } from "lucide-react";

// Data Imports
import { COMMON_EMOJIS } from "./composer-constants";

export interface ComposerToolbarProps {
  canSend: boolean;
  isEmojiOpen: boolean;
  onAttachClick: () => void;
  onEmojiOpenChange: (open: boolean) => void;
  onFormatBold: () => void;
  onInsertEmoji: (emoji: string) => void;
  onInsertLink: () => void;
  onSend: () => void;
}

const ComposerToolbar = (props: ComposerToolbarProps) => {
  // Props
  const {
    canSend,
    isEmojiOpen,
    onEmojiOpenChange,
    onInsertEmoji,
    onFormatBold,
    onInsertLink,
    onAttachClick,
    onSend,
  } = props;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        <Button
          aria-label="Bold"
          onClick={onFormatBold}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <span className="font-medium text-base leading-none">B</span>
        </Button>

        <Popover onOpenChange={onEmojiOpenChange} open={isEmojiOpen}>
          <PopoverTrigger
            render={
              <Button
                aria-label="Insert emoji"
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <SmileIcon className="size-4" />
              </Button>
            }
          />
          <PopoverContent align="start" className="w-64 p-2">
            <div className="grid grid-cols-5 gap-1">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  className="rounded-md p-2 text-lg transition-colors hover:bg-muted"
                  key={emoji}
                  onClick={() => onInsertEmoji(emoji)}
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          aria-label="Attach file"
          onClick={onAttachClick}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <PaperclipIcon className="size-4" />
        </Button>

        <Button
          aria-label="Insert link"
          onClick={onInsertLink}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <LinkIcon className="size-4" />
        </Button>
      </div>

      <Button
        aria-label="Send message"
        disabled={!canSend}
        onClick={onSend}
        size="icon-sm"
        type="button"
      >
        <SendIcon className="size-4" />
      </Button>
    </div>
  );
};

export default ComposerToolbar;
