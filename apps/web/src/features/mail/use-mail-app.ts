// Ported from AdminCN use-mail-app. Framework change: dropped 'use client'.
// Reframe: labelCounts keys track the operational label set (alerts / approvals
// / finance / operations / logistics). All mailbox/thread logic is unchanged.

import { useCallback, useMemo } from "react";

import {
  deriveRecipientEmailAddress,
  getEmailPreviewText,
  MAIL_CURRENT_USER,
} from "@/features/mail/mail-config";
import { useMailStore } from "@/features/mail/store";
import type {
  ComposeEmailPayload,
  Email,
  EmailLabel,
  EmailStatus,
  MailSortOrder,
} from "@/features/mail/types";

const sortEmails = (items: Email[], sortOrder: MailSortOrder): Email[] => {
  if (sortOrder === "default") {
    return items;
  }

  const sorted = [...items];

  sorted.sort((a, b) => {
    const aTime = a.date.getTime();
    const bTime = b.date.getTime();

    if (sortOrder === "newest") {
      return bTime - aTime;
    }

    return aTime - bTime;
  });

  return sorted;
};

const createThreadMessageId = (emailId: string, messageCount: number) =>
  `${emailId}-${messageCount + 1}`;

const buildEmailFromComposePayload = (
  payload: ComposeEmailPayload,
  status: "sent" | "drafts"
): Email | null => {
  const trimmedBody = payload.body.trim();
  const trimmedSubject = payload.subject.trim();
  const trimmedTo = payload.to.trim();
  const trimmedCc = payload.cc?.trim();
  const trimmedBcc = payload.bcc?.trim();

  if (status === "sent" && !(trimmedBody && trimmedSubject && trimmedTo)) {
    return null;
  }

  if (status === "drafts" && !trimmedBody && !trimmedSubject && !trimmedTo) {
    return null;
  }

  const newId = String(Date.now());
  const body = trimmedBody || "[Draft incomplete - save for later]";
  const subject = trimmedSubject || "Draft: No subject";
  const preview = getEmailPreviewText(trimmedBody);

  const newMessage = {
    id: `${newId}-1`,
    from: MAIL_CURRENT_USER.name,
    fromEmail: MAIL_CURRENT_USER.email,
    body,
    date: new Date(),
    isFromMe: true,
  };

  return {
    id: newId,
    from: MAIL_CURRENT_USER.name,
    fromEmail: MAIL_CURRENT_USER.email,
    to: trimmedTo || undefined,
    toEmail: trimmedTo ? deriveRecipientEmailAddress(trimmedTo) : undefined,
    cc: trimmedCc || undefined,
    bcc: trimmedBcc || undefined,
    subject,
    preview,
    body,
    date: new Date(),
    isRead: true,
    isStarred: false,
    labels: [],
    status,
    thread: {
      messages: [newMessage],
    },
  };
};

export const useMailApp = () => {
  const emails = useMailStore((state) => state.emails);
  const selectedEmailId = useMailStore((state) => state.selectedEmailId);
  const searchQuery = useMailStore((state) => state.searchQuery);
  const activeStatus = useMailStore((state) => state.activeStatus);
  const activeLabel = useMailStore((state) => state.activeLabel);
  const activeNavType = useMailStore((state) => state.activeNavType);
  const filterTab = useMailStore((state) => state.filterTab);
  const sortOrder = useMailStore((state) => state.sortOrder);
  const isComposeOpen = useMailStore((state) => state.isComposeOpen);
  const updateEmail = useMailStore((state) => state.updateEmail);
  const addEmail = useMailStore((state) => state.addEmail);
  const removeEmail = useMailStore((state) => state.removeEmail);
  const setSelectedEmailId = useMailStore((state) => state.setSelectedEmailId);
  const setSearchQuery = useMailStore((state) => state.setSearchQuery);
  const setActiveStatus = useMailStore((state) => state.setActiveStatus);
  const setActiveLabel = useMailStore((state) => state.setActiveLabel);
  const setActiveNavType = useMailStore((state) => state.setActiveNavType);
  const setFilterTab = useMailStore((state) => state.setFilterTab);
  const setSortOrder = useMailStore((state) => state.setSortOrder);
  const setIsComposeOpen = useMailStore((state) => state.setIsComposeOpen);

  const statusCounts = useMemo(() => {
    const counts: Record<EmailStatus, number> = {
      inbox: 0,
      sent: 0,
      drafts: 0,
      spam: 0,
      trash: 0,
      archive: 0,
    };

    for (const email of emails) {
      counts[email.status] += 1;
    }

    return counts;
  }, [emails]);

  const labelCounts = useMemo(() => {
    const counts: Record<EmailLabel, number> = {
      alerts: 0,
      approvals: 0,
      finance: 0,
      operations: 0,
      logistics: 0,
    };

    for (const email of emails) {
      if (email.status === "inbox") {
        for (const label of email.labels) {
          counts[label] += 1;
        }
      }
    }

    return counts;
  }, [emails]);

  const filteredEmails = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    const filtered = emails.filter((email) => {
      if (activeNavType === "label") {
        if (
          email.status !== "inbox" ||
          !activeLabel ||
          !email.labels.includes(activeLabel)
        ) {
          return false;
        }
      } else if (email.status !== activeStatus) {
        return false;
      }

      if (!normalizedSearchQuery) {
        return true;
      }

      return (
        email.subject.toLowerCase().includes(normalizedSearchQuery) ||
        email.from.toLowerCase().includes(normalizedSearchQuery) ||
        email.preview.toLowerCase().includes(normalizedSearchQuery) ||
        email.body.toLowerCase().includes(normalizedSearchQuery)
      );
    });

    return sortEmails(filtered, sortOrder);
  }, [
    activeLabel,
    activeNavType,
    activeStatus,
    emails,
    searchQuery,
    sortOrder,
  ]);

  const visibleEmails = useMemo(() => {
    if (filterTab === "unread") {
      return filteredEmails.filter((email) => !email.isRead);
    }

    return filteredEmails;
  }, [filterTab, filteredEmails]);

  const selectedEmail = useMemo(() => {
    if (selectedEmailId) {
      const matched = emails.find((email) => email.id === selectedEmailId);

      if (matched && visibleEmails.some((email) => email.id === matched.id)) {
        return matched;
      }
    }

    return visibleEmails[0] ?? null;
  }, [emails, selectedEmailId, visibleEmails]);

  const unreadCount = useMemo(
    () => filteredEmails.filter((email) => !email.isRead).length,
    [filteredEmails]
  );

  const handleStatusChange = useCallback(
    (status: EmailStatus) => {
      setActiveNavType("status");
      setActiveStatus(status);
      setActiveLabel(null);
      setSelectedEmailId(null);
    },
    [setActiveLabel, setActiveNavType, setActiveStatus, setSelectedEmailId]
  );

  const handleLabelChange = useCallback(
    (label: EmailLabel) => {
      setActiveNavType("label");
      setActiveLabel(label);
      setSelectedEmailId(null);
    },
    [setActiveLabel, setActiveNavType, setSelectedEmailId]
  );

  const handleEmailSelect = useCallback(
    (email: Email) => {
      setSelectedEmailId(email.id);

      if (!email.isRead) {
        updateEmail(email.id, (currentEmail) => ({
          ...currentEmail,
          isRead: true,
        }));
      }
    },
    [setSelectedEmailId, updateEmail]
  );

  const handleToggleStar = useCallback(
    (id: string) => {
      updateEmail(id, (email) => ({ ...email, isStarred: !email.isStarred }));
    },
    [updateEmail]
  );

  const handleMarkRead = useCallback(
    (id: string, isRead: boolean) => {
      updateEmail(id, (email) => ({ ...email, isRead }));
    },
    [updateEmail]
  );

  const handleMoveToStatus = useCallback(
    (id: string, status: EmailStatus) => {
      updateEmail(id, (email) => ({ ...email, status }));

      const {
        activeNavType: currentNavType,
        activeStatus: currentStatus,
        selectedEmailId: currentSelectedId,
      } = useMailStore.getState();

      if (
        currentNavType === "status" &&
        status !== currentStatus &&
        currentSelectedId === id
      ) {
        setSelectedEmailId(null);
      }
    },
    [setSelectedEmailId, updateEmail]
  );

  const handleArchive = useCallback(
    (id: string) => {
      handleMoveToStatus(id, "archive");
    },
    [handleMoveToStatus]
  );

  const handleMoveToTrash = useCallback(
    (id: string) => {
      handleMoveToStatus(id, "trash");
    },
    [handleMoveToStatus]
  );

  const handleMoveToSpam = useCallback(
    (id: string) => {
      handleMoveToStatus(id, "spam");
    },
    [handleMoveToStatus]
  );

  const handleMarkNotSpam = useCallback(
    (id: string) => {
      handleMoveToStatus(id, "inbox");
    },
    [handleMoveToStatus]
  );

  const handleRestoreToInbox = useCallback(
    (id: string) => {
      handleMoveToStatus(id, "inbox");
    },
    [handleMoveToStatus]
  );

  const handlePermanentDelete = useCallback(
    (id: string) => {
      removeEmail(id);
    },
    [removeEmail]
  );

  const handleSendDraft = useCallback(
    (id: string, body?: string) => {
      const trimmedBody = body?.trim();

      updateEmail(id, (email) => {
        if (!trimmedBody) {
          return { ...email, status: "sent" };
        }

        const messages = email.thread.messages.map((message, index) =>
          index === email.thread.messages.length - 1
            ? { ...message, body: trimmedBody }
            : message
        );

        return {
          ...email,
          status: "sent",
          body: trimmedBody,
          preview: getEmailPreviewText(trimmedBody),
          thread: { messages },
        };
      });
      setActiveNavType("status");
      setActiveStatus("sent");
      setActiveLabel(null);
      setSelectedEmailId(id);
    },
    [
      setActiveLabel,
      setActiveNavType,
      setActiveStatus,
      setSelectedEmailId,
      updateEmail,
    ]
  );

  const handleToggleLabel = useCallback(
    (id: string, label: EmailLabel) => {
      updateEmail(id, (email) => ({
        ...email,
        labels: email.labels.includes(label)
          ? email.labels.filter((currentLabel) => currentLabel !== label)
          : [...email.labels, label],
      }));
    },
    [updateEmail]
  );

  const handleSendReply = useCallback(
    (id: string, body: string) => {
      const trimmedBody = body.trim();

      if (!trimmedBody) {
        return;
      }

      updateEmail(id, (email) => {
        const newMessage = {
          id: createThreadMessageId(email.id, email.thread.messages.length),
          from: MAIL_CURRENT_USER.name,
          fromEmail: MAIL_CURRENT_USER.email,
          body: trimmedBody,
          date: new Date(),
          isFromMe: true,
        };

        const messages = [...email.thread.messages, newMessage];

        return {
          ...email,
          body: trimmedBody,
          preview: getEmailPreviewText(trimmedBody),
          date: new Date(),
          thread: { messages },
        };
      });
    },
    [updateEmail]
  );

  const handleComposeSend = useCallback(
    (payload: ComposeEmailPayload) => {
      const newEmail = buildEmailFromComposePayload(
        {
          ...payload,
          toEmail:
            payload.toEmail.trim() ||
            deriveRecipientEmailAddress(payload.to.trim()),
        },
        "sent"
      );

      if (!newEmail) {
        return;
      }

      addEmail(newEmail);
      setActiveNavType("status");
      setActiveStatus("sent");
      setActiveLabel(null);
      setSelectedEmailId(newEmail.id);
      setIsComposeOpen(false);
    },
    [
      addEmail,
      setActiveLabel,
      setActiveNavType,
      setActiveStatus,
      setIsComposeOpen,
      setSelectedEmailId,
    ]
  );

  const handleComposeSaveDraft = useCallback(
    (payload: ComposeEmailPayload) => {
      const newEmail = buildEmailFromComposePayload(payload, "drafts");

      if (!newEmail) {
        return;
      }

      addEmail(newEmail);
      setActiveNavType("status");
      setActiveStatus("drafts");
      setActiveLabel(null);
      setSelectedEmailId(newEmail.id);
      setIsComposeOpen(false);
    },
    [
      addEmail,
      setActiveLabel,
      setActiveNavType,
      setActiveStatus,
      setIsComposeOpen,
      setSelectedEmailId,
    ]
  );

  return {
    emails,
    activeStatus,
    activeLabel,
    activeNavType,
    filterTab,
    sortOrder,
    searchQuery,
    isComposeOpen,
    statusCounts,
    labelCounts,
    visibleEmails,
    selectedEmail,
    unreadCount,
    setFilterTab,
    setSortOrder,
    setSearchQuery,
    setIsComposeOpen,
    handleStatusChange,
    handleLabelChange,
    handleEmailSelect,
    handleToggleStar,
    handleMarkRead,
    handleArchive,
    handleMoveToTrash,
    handleMoveToStatus,
    handleMoveToSpam,
    handleMarkNotSpam,
    handleRestoreToInbox,
    handlePermanentDelete,
    handleSendDraft,
    handleToggleLabel,
    handleSendReply,
    handleComposeSend,
    handleComposeSaveDraft,
  };
};
