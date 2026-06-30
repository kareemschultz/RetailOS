// React Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import { Separator } from "@RetailOS/ui/components/separator";
import { Switch } from "@RetailOS/ui/components/switch";
import { Textarea } from "@RetailOS/ui/components/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@RetailOS/ui/components/tooltip";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
// Third-party Imports
import {
  Archive,
  ChevronDown,
  Forward,
  Inbox,
  MoreVertical,
  Reply,
  ReplyAll,
  SendIcon,
  ShieldAlert,
  ShieldCheck,
  StarIcon,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";

// Config Imports
import {
  formatMailDate,
  getInitialsFromName,
  MAIL_CURRENT_USER,
  MAIL_LABEL_STYLES,
} from "@/features/mail/mail-config";
// Type Imports
import type { Email, ThreadMessage } from "@/features/mail/types";
import type { MailDisplayProps } from "./index";
import { LabelManager } from "./label-manager";
import { MailThreadMessage } from "./mail-thread-message";

const LABEL_MANAGE_STATUSES = new Set<Email["status"]>([
  "inbox",
  "sent",
  "archive",
]);

export const MailDisplayContent = ({
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
}: Omit<MailDisplayProps, "email"> & { email: Email }) => {
  // States
  const [replyMessageBody, setReplyMessageBody] = useState(() =>
    email.status === "drafts" ? email.body : ""
  );
  const [isEarlierMessagesExpanded, setIsEarlierMessagesExpanded] =
    useState(false);

  // Refs
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Vars
  const threadMessages = email.thread.messages;
  const earlierThreadMessages = threadMessages.slice(0, -1);
  const latestThreadMessage = threadMessages.at(-1);
  const earlierMessageCount = earlierThreadMessages.length;

  const isDraft = email.status === "drafts";
  const isSent = email.status === "sent";
  const canManageLabels = LABEL_MANAGE_STATUSES.has(email.status);

  const recipientName =
    isSent || isDraft ? (email.to ?? "Unknown") : email.from;
  const recipientEmail =
    isSent || isDraft ? (email.toEmail ?? "") : email.fromEmail;

  const handleReplySubmit = () => {
    if (!replyMessageBody.trim()) {
      return;
    }

    onSendReply(email.id, replyMessageBody);
    setReplyMessageBody("");
  };

  const getThreadMessageAvatar = (message: ThreadMessage) => {
    if (message.isFromMe) {
      return MAIL_CURRENT_USER.avatar;
    }

    if (message.from === email.from) {
      return email.avatar;
    }

    return;
  };

  const handleFooterSubmit = () => {
    if (isDraft) {
      if (!replyMessageBody.trim()) {
        return;
      }

      onSendDraft(email.id, replyMessageBody);

      return;
    }

    handleReplySubmit();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 p-1 max-md:justify-end md:h-15 md:p-3">
        <div className="hidden items-center md:flex">
          {(email.status === "inbox" ||
            email.status === "sent" ||
            email.status === "drafts") && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    onClick={() => onArchive(email.id)}
                    size="icon"
                    title="Archive"
                    variant="ghost"
                  />
                }
              >
                <Archive className="size-4" />
                <span className="sr-only">Archive</span>
              </TooltipTrigger>
              <TooltipContent>Archive</TooltipContent>
            </Tooltip>
          )}

          {email.status === "inbox" && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    onClick={() => onMoveToSpam(email.id)}
                    size="icon"
                    title="Flag"
                    variant="ghost"
                  />
                }
              >
                <ShieldAlert className="size-4" />
                <span className="sr-only">Flag</span>
              </TooltipTrigger>
              <TooltipContent>Flag</TooltipContent>
            </Tooltip>
          )}

          {email.status === "spam" && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    onClick={() => onMarkNotSpam(email.id)}
                    size="icon"
                    title="Unflag"
                    variant="ghost"
                  />
                }
              >
                <ShieldCheck className="size-4" />
                <span className="sr-only">Unflag</span>
              </TooltipTrigger>
              <TooltipContent>Unflag</TooltipContent>
            </Tooltip>
          )}

          {(email.status === "trash" || email.status === "archive") && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    onClick={() => onRestoreToInbox(email.id)}
                    size="icon"
                    title="Restore to inbox"
                    variant="ghost"
                  />
                }
              >
                <Inbox className="size-4" />
                <span className="sr-only">Restore to inbox</span>
              </TooltipTrigger>
              <TooltipContent>Restore to inbox</TooltipContent>
            </Tooltip>
          )}

          {(email.status === "inbox" ||
            email.status === "sent" ||
            email.status === "drafts" ||
            email.status === "spam" ||
            email.status === "archive") && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    onClick={() => onMoveToTrash(email.id)}
                    size="icon"
                    title="Move to trash"
                    variant="ghost"
                  />
                }
              >
                <Trash2 className="size-4" />
                <span className="sr-only">Move to trash</span>
              </TooltipTrigger>
              <TooltipContent>Move to trash</TooltipContent>
            </Tooltip>
          )}

          {(email.status === "spam" || email.status === "trash") && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    className="text-destructive hover:text-destructive"
                    onClick={() => onPermanentDelete(email.id)}
                    size="icon"
                    title="Delete permanently"
                    variant="ghost"
                  />
                }
              >
                <Trash2 className="size-4" />
                <span className="sr-only">Delete permanently</span>
              </TooltipTrigger>
              <TooltipContent>Delete permanently</TooltipContent>
            </Tooltip>
          )}

          {canManageLabels && (
            <LabelManager
              emailId={email.id}
              labels={email.labels}
              onToggleLabel={onToggleLabel}
            />
          )}
        </div>

        <Separator
          className="hidden h-6 data-vertical:self-center md:block"
          orientation="vertical"
        />
        <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onClick={() => onToggleStar(email.id)}
                  size="icon"
                  title={email.isStarred ? "Unstar" : "Star"}
                  variant="ghost"
                />
              }
            >
              <StarIcon
                className={cn(
                  "size-4",
                  email.isStarred && "fill-primary text-primary"
                )}
              />
              <span className="sr-only">
                {email.isStarred ? "Unstar" : "Star"}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {email.isStarred ? "Unstar" : "Star"}
            </TooltipContent>
          </Tooltip>
          {email.labels.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {email.labels.map((label) => {
                const labelStyle = MAIL_LABEL_STYLES.find(
                  (style) => style.id === label
                );

                return (
                  <Badge
                    className="px-1.5 max-xl:border-0 max-xl:p-0"
                    key={label}
                    variant="outline"
                  >
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        labelStyle?.color
                      )}
                    />
                    <span className="max-xl:hidden">{label}</span>
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  disabled={isSent}
                  onClick={() => replyTextareaRef.current?.focus()}
                  size="icon"
                  variant="ghost"
                />
              }
            >
              <Reply className="size-4" />
              <span className="sr-only">Reply</span>
            </TooltipTrigger>
            <TooltipContent>Reply</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={<Button disabled={!email} size="icon" variant="ghost" />}
            >
              <ReplyAll className="size-4" />
              <span className="sr-only">Reply all</span>
            </TooltipTrigger>
            <TooltipContent>Reply all</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={<Button disabled={!email} size="icon" variant="ghost" />}
            >
              <Forward className="size-4" />
              <span className="sr-only">Forward</span>
            </TooltipTrigger>
            <TooltipContent>Forward</TooltipContent>
          </Tooltip>
          <Separator
            className="mx-1 h-6 data-vertical:self-center"
            orientation="vertical"
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button disabled={!email} size="icon" variant="ghost" />}
            >
              <MoreVertical className="size-4" />
              <span className="sr-only">More</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onMarkRead(email.id, !email.isRead)}
              >
                {email.isRead ? "Mark as unread" : "Mark as read"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleStar(email.id)}>
                {email.isStarred ? "Unstar thread" : "Star thread"}
              </DropdownMenuItem>
              {(email.status === "inbox" ||
                email.status === "sent" ||
                email.status === "drafts") && (
                <DropdownMenuItem onClick={() => onArchive(email.id)}>
                  Archive
                </DropdownMenuItem>
              )}
              {email.status === "inbox" && (
                <DropdownMenuItem onClick={() => onMoveToSpam(email.id)}>
                  Flag
                </DropdownMenuItem>
              )}
              {email.status === "spam" && (
                <DropdownMenuItem onClick={() => onMarkNotSpam(email.id)}>
                  Unflag
                </DropdownMenuItem>
              )}
              {(email.status === "trash" || email.status === "archive") && (
                <DropdownMenuItem onClick={() => onRestoreToInbox(email.id)}>
                  Restore to inbox
                </DropdownMenuItem>
              )}
              {email.status === "drafts" && (
                <DropdownMenuItem onClick={() => onSendDraft(email.id)}>
                  Send draft
                </DropdownMenuItem>
              )}
              {(email.status === "inbox" ||
                email.status === "sent" ||
                email.status === "drafts" ||
                email.status === "spam" ||
                email.status === "archive") && (
                <DropdownMenuItem
                  onClick={() => onMoveToTrash(email.id)}
                  variant="destructive"
                >
                  Move to trash
                </DropdownMenuItem>
              )}
              {(email.status === "spam" || email.status === "trash") && (
                <DropdownMenuItem
                  onClick={() => onPermanentDelete(email.id)}
                  variant="destructive"
                >
                  Delete permanently
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Separator />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="border-border border-b p-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Avatar className="shrink-0 max-md:hidden" size="lg">
                {!(isSent || isDraft) && (
                  <AvatarImage alt={email.from} src={email.avatar} />
                )}
                <AvatarFallback>
                  {getInitialsFromName(recipientName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h2 className="line-clamp-2 font-medium text-base text-foreground leading-snug tracking-tight md:font-semibold">
                  {email.subject}
                </h2>
                {isSent || isDraft ? (
                  <>
                    <p className="mt-1 font-medium text-foreground text-sm">
                      <span className="font-normal text-muted-foreground">
                        To:{" "}
                      </span>
                      {recipientName}
                    </p>
                    {recipientEmail && (
                      <p className="mt-0.5 text-muted-foreground text-xs">
                        {recipientEmail}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="mt-1 font-medium text-foreground text-sm">
                      {email.from}
                    </p>
                    <p className="mt-0.5 text-muted-foreground text-xs">
                      Reply-To: {email.fromEmail}
                    </p>
                  </>
                )}
              </div>
            </div>
            <span className="shrink-0 pt-0.5 text-muted-foreground text-xs">
              {formatMailDate(email.date)}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3">
          <div className="flex flex-col gap-5">
            {earlierMessageCount > 0 && (
              <button
                className="flex w-full items-center gap-2 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
                onClick={() =>
                  setIsEarlierMessagesExpanded((currentValue) => !currentValue)
                }
                type="button"
              >
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    isEarlierMessagesExpanded && "rotate-180"
                  )}
                />
                {earlierMessageCount} earlier{" "}
                {earlierMessageCount === 1 ? "message" : "messages"}
              </button>
            )}

            {isEarlierMessagesExpanded &&
              earlierThreadMessages.map((threadMessage) => (
                <MailThreadMessage
                  avatar={getThreadMessageAvatar(threadMessage)}
                  key={threadMessage.id}
                  message={threadMessage}
                />
              ))}

            {latestThreadMessage && (
              <MailThreadMessage
                avatar={getThreadMessageAvatar(latestThreadMessage)}
                message={latestThreadMessage}
                variant="plain"
              />
            )}
          </div>
        </div>

        <div className="mt-auto border-border border-t p-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleFooterSubmit();
            }}
          >
            <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
              <Textarea
                className="resize-none rounded-none border-0 bg-transparent p-2 text-sm shadow-none focus-visible:ring-0 max-md:min-h-10 md:px-4 md:py-3"
                onChange={(event) => setReplyMessageBody(event.target.value)}
                placeholder={
                  isDraft
                    ? "Edit your draft..."
                    : `Reply to ${recipientName}...`
                }
                ref={replyTextareaRef}
                value={replyMessageBody}
              />
              <div className="flex items-center justify-between border-border border-t p-2 md:px-4 md:py-2.5">
                <div className="flex items-center gap-2">
                  <Switch id="mute-thread" />
                  <label
                    className="text-muted-foreground text-sm"
                    htmlFor="mute-thread"
                  >
                    Mute this thread
                  </label>
                </div>
                <Button
                  className="gap-1.5 rounded-lg px-4"
                  disabled={!replyMessageBody.trim()}
                  size="sm"
                  title={isDraft ? "Send draft" : "Send reply"}
                  type="submit"
                  variant="secondary"
                >
                  Send
                  <SendIcon className="size-4" />
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
