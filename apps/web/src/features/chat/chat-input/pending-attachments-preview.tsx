// Third-party Imports

// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import { FileIcon, XIcon } from "lucide-react";
// Type Imports
import type { PendingAttachment } from "@/features/chat/types";
import { formatFileSize } from "./composer-utils";

export interface PendingAttachmentsPreviewProps {
  attachments: PendingAttachment[];
  onRemove: (attachmentId: string) => void;
}

const PendingAttachmentsPreview = (props: PendingAttachmentsPreviewProps) => {
  // Props
  const { attachments, onRemove } = props;

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2 pt-2">
      <p className="mb-2 px-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
        Attachments ({attachments.length})
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {attachments.map((attachment) => (
          <div
            className={cn(
              "group relative shrink-0 overflow-hidden rounded-lg border shadow-sm",
              attachment.type === "image" ? "w-36" : "w-52"
            )}
            key={attachment.id}
          >
            {attachment.type === "image" ? (
              <img
                alt={attachment.file.name}
                className="h-28 w-full object-cover"
                src={attachment.previewUrl}
              />
            ) : (
              <div className="flex items-center gap-3 bg-background p-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                  <FileIcon className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-xs">
                    {attachment.file.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatFileSize(attachment.file.size)}
                  </p>
                </div>
              </div>
            )}

            <button
              aria-label={`Remove ${attachment.file.name}`}
              className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full border bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background"
              onClick={() => onRemove(attachment.id)}
              type="button"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingAttachmentsPreview;
