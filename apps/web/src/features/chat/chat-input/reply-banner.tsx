// Third-party Imports
import { XIcon } from "lucide-react";

// Type Imports
import type { Message } from "@/features/chat/types";

// Util Imports
import { getMessagePreview } from "@/features/chat/utils";

export interface ReplyBannerProps {
  onClearReplyTo: () => void;
  replyToMessage: Message;
}

const ReplyBanner = (props: ReplyBannerProps) => {
  // Props
  const { replyToMessage, onClearReplyTo } = props;

  return (
    <div className="flex items-center gap-2 rounded-lg border-primary border-l-2 bg-muted/50 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-primary text-xs">Replying to</p>
        <p className="truncate text-muted-foreground text-xs">
          {getMessagePreview(replyToMessage)}
        </p>
      </div>
      <button
        aria-label="Clear reply"
        className="shrink-0 text-muted-foreground hover:text-foreground"
        onClick={onClearReplyTo}
        type="button"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
};

export default ReplyBanner;
