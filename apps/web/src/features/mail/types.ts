// Ported from AdminCN mail-types, reframed as the RetailOS operational inbox:
// "emails" model system notifications (low-stock alerts, PO approvals, bond
// clearance, shift-close summaries, overdue invoices). The data SHAPE is
// unchanged; only the EmailLabel value set was retheme to operational labels.

export interface ThreadMessage {
  body: string;
  date: Date;
  from: string;
  fromEmail: string;
  id: string;
  isFromMe?: boolean;
}

export type EmailLabel =
  | "alerts"
  | "approvals"
  | "finance"
  | "operations"
  | "logistics";

export type EmailStatus =
  | "inbox"
  | "sent"
  | "drafts"
  | "spam"
  | "trash"
  | "archive";

export interface Email {
  avatar?: string;
  bcc?: string;
  body: string;
  cc?: string;
  date: Date;
  from: string;
  fromEmail: string;
  id: string;
  isRead: boolean;
  isStarred: boolean;
  labels: EmailLabel[];
  preview: string;
  status: EmailStatus;
  subject: string;
  thread: {
    messages: ThreadMessage[];
  };
  to?: string;
  toEmail?: string;
}

export interface MailData {
  emails: Email[];
}

export type MailFilterTab = "all" | "unread";

export type MailSortOrder = "default" | "newest" | "oldest";

export type MailNavType = "status" | "label";

export interface ComposeEmailPayload {
  bcc?: string;
  body: string;
  cc?: string;
  subject: string;
  to: string;
  toEmail: string;
}
