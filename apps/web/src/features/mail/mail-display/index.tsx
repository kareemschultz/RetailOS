// Type Imports
import type { Email, EmailLabel } from "@/features/mail/types";
import { MailDisplayContent } from "./mail-display-content";

export interface MailDisplayProps {
  email: Email | null;
  onArchive: (id: string) => void;
  onMarkNotSpam: (id: string) => void;
  onMarkRead: (id: string, isRead: boolean) => void;
  onMoveToSpam: (id: string) => void;
  onMoveToTrash: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onRestoreToInbox: (id: string) => void;
  onSendDraft: (id: string, body?: string) => void;
  onSendReply: (id: string, body: string) => void;
  onToggleLabel: (id: string, label: EmailLabel) => void;
  onToggleStar: (id: string) => void;
}

export const MailDisplay = ({
  email,
  onToggleStar,
  onMarkRead,
  onArchive,
  onMoveToTrash,
  onMoveToSpam,
  onMarkNotSpam,
  onRestoreToInbox,
  onPermanentDelete,
  onSendDraft,
  onToggleLabel,
  onSendReply,
}: MailDisplayProps) => {
  if (!email) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center text-muted-foreground">
        <p className="font-medium text-foreground text-sm">
          No message selected
        </p>
        <p className="text-xs">
          Choose a message from the list to read it here.
        </p>
      </div>
    );
  }

  return (
    <MailDisplayContent
      email={email}
      key={email.id}
      onArchive={onArchive}
      onMarkNotSpam={onMarkNotSpam}
      onMarkRead={onMarkRead}
      onMoveToSpam={onMoveToSpam}
      onMoveToTrash={onMoveToTrash}
      onPermanentDelete={onPermanentDelete}
      onRestoreToInbox={onRestoreToInbox}
      onSendDraft={onSendDraft}
      onSendReply={onSendReply}
      onToggleLabel={onToggleLabel}
      onToggleStar={onToggleStar}
    />
  );
};

export default MailDisplay;
