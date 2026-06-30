// Ported from AdminCN mailConfig. Framework changes: none (pure helpers).
// Reframe: the current user is a RetailOS operator; labels are operational
// (alerts / approvals / finance / operations / logistics); mailbox statuses keep
// their IDs (the move/spam/trash logic depends on them) with operator-facing
// display labels.

import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";

import type { EmailLabel, EmailStatus } from "@/features/mail/types";

const ABOUT_PREFIX_REGEX = /^about /;

export const MAIL_CURRENT_USER = {
  name: "Anita Persaud",
  email: "anita.persaud@retailos.gy",
  avatar: undefined as string | undefined,
};

export const MAIL_COMPOSE_SESSION = {
  OPEN: "compose-open",
  CLOSED: "compose-closed",
} as const;

export interface MailNavStatusItem {
  id: EmailStatus;
  label: string;
}

export interface MailNavLabelItem {
  id: EmailLabel;
  label: string;
}

export type MailNavLabelStyle = MailNavLabelItem & {
  color: string;
};

export type MailNavStatusItemWithCount = MailNavStatusItem & {
  count: number;
};

export type MailNavLabelItemWithCount = MailNavLabelItem & {
  count: number;
};

export const MAIL_STATUS_NAV_ITEMS: MailNavStatusItem[] = [
  { id: "inbox", label: "Inbox" },
  { id: "drafts", label: "Drafts" },
  { id: "sent", label: "Sent" },
  { id: "spam", label: "Flagged" },
  { id: "trash", label: "Trash" },
  { id: "archive", label: "Archive" },
];

export const MAIL_LABEL_NAV_ITEMS: MailNavLabelItem[] = [
  { id: "alerts", label: "Alerts" },
  { id: "approvals", label: "Approvals" },
  { id: "finance", label: "Finance" },
  { id: "operations", label: "Operations" },
  { id: "logistics", label: "Logistics" },
];

export const MAIL_LABEL_STYLES: MailNavLabelStyle[] = [
  { id: "alerts", label: "Alerts", color: "bg-red-500" },
  { id: "approvals", label: "Approvals", color: "bg-amber-500" },
  { id: "finance", label: "Finance", color: "bg-emerald-500" },
  { id: "operations", label: "Operations", color: "bg-blue-500" },
  { id: "logistics", label: "Logistics", color: "bg-violet-500" },
];

export const deriveRecipientEmailAddress = (recipient: string) => {
  if (recipient.includes("@")) {
    return recipient;
  }

  return `${recipient.toLowerCase().replace(/\s+/g, ".")}@retailos.gy`;
};

export const getEmailPreviewText = (body: string, maxLength = 80) => {
  if (!body) {
    return "Working on a draft...";
  }

  return body.slice(0, maxLength) + (body.length > maxLength ? "..." : "");
};

export const getInitialsFromName = (name: string) =>
  name
    .split(" ")
    .map((namePart) => namePart[0])
    .join("");

export const formatMailDate = (date: Date) => {
  const diffMs = Date.now() - date.getTime();

  if (diffMs < 60_000) {
    return "Just now";
  }

  if (isToday(date)) {
    return formatDistanceToNow(date, { addSuffix: true }).replace(
      ABOUT_PREFIX_REGEX,
      ""
    );
  }

  if (isYesterday(date)) {
    return "Yesterday";
  }

  return format(date, "MMM d");
};
