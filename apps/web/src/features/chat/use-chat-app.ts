// React Imports
import { useCallback, useMemo } from "react";
// Store Imports
import { useChatStore } from "@/features/chat/store";
// Type Imports
import type {
  Attachment,
  ChatTabCounts,
  ChatUser,
  Conversation,
  MessageType,
  OwnProfileUpdate,
} from "@/features/chat/types";

const getConversationDisplayName = (
  conversation: Conversation,
  contacts: ChatUser[]
): string => {
  if (conversation.type === "group" && conversation.groupName) {
    return conversation.groupName;
  }

  const contact = contacts.find((item) => item.id === conversation.contactId);

  return contact?.name ?? "Unknown";
};

const getLastMessage = (conversation: Conversation): string => {
  const lastMessage = conversation.messages.at(-1);

  if (!lastMessage) {
    return "";
  }

  if (lastMessage.type === "image") {
    return "Image";
  }

  if (lastMessage.type === "file") {
    return lastMessage.attachments?.[0]?.name ?? "File";
  }

  return lastMessage.content;
};

const getLastMessageTimestamp = (conversation: Conversation): string => {
  const lastMessage = conversation.messages.at(-1);

  return lastMessage?.timestamp ?? "";
};

const sortConversations = (items: Conversation[]): Conversation[] =>
  [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }

    const aTime = getLastMessageTimestamp(a);
    const bTime = getLastMessageTimestamp(b);

    return bTime.localeCompare(aTime);
  });

export const useChatApp = () => {
  // Hooks
  const currentUser = useChatStore((state) => state.currentUser);
  const contacts = useChatStore((state) => state.contacts);
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore(
    (state) => state.activeConversationId
  );
  const searchQuery = useChatStore((state) => state.searchQuery);
  const activeTab = useChatStore((state) => state.activeTab);
  const profileSheetUserId = useChatStore((state) => state.profileSheetUserId);
  const replyToMessageId = useChatStore((state) => state.replyToMessageId);
  const isTyping = useChatStore((state) => state.isTyping);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const clearChat = useChatStore((state) => state.clearChat);
  const deleteContact = useChatStore((state) => state.deleteContact);
  const togglePinConversation = useChatStore(
    (state) => state.togglePinConversation
  );
  const toggleMuteConversation = useChatStore(
    (state) => state.toggleMuteConversation
  );
  const toggleFavouriteConversation = useChatStore(
    (state) => state.toggleFavouriteConversation
  );
  const toggleBlockContact = useChatStore((state) => state.toggleBlockContact);
  const markConversationAsRead = useChatStore(
    (state) => state.markConversationAsRead
  );
  const setActiveConversationId = useChatStore(
    (state) => state.setActiveConversationId
  );
  const setSearchQuery = useChatStore((state) => state.setSearchQuery);
  const setActiveTab = useChatStore((state) => state.setActiveTab);
  const setProfileSheetUserId = useChatStore(
    (state) => state.setProfileSheetUserId
  );
  const setReplyToMessageId = useChatStore(
    (state) => state.setReplyToMessageId
  );
  const updateOwnProfile = useChatStore((state) => state.updateOwnProfile);

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === activeConversationId
      ) ?? null,
    [activeConversationId, conversations]
  );

  const activeContact = useMemo((): ChatUser | ChatUser[] | null => {
    if (!activeConversation) {
      return null;
    }

    if (activeConversation.type === "direct" && activeConversation.contactId) {
      return (
        contacts.find(
          (contact) => contact.id === activeConversation.contactId
        ) ?? null
      );
    }

    if (activeConversation.type === "group" && activeConversation.memberIds) {
      return contacts.filter((contact) =>
        activeConversation.memberIds?.includes(contact.id)
      );
    }

    return null;
  }, [activeConversation, contacts]);

  const filteredConversations = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    let filtered = conversations;

    if (activeTab === "unread") {
      filtered = filtered.filter(
        (conversation) => conversation.unreadCount > 0
      );
    } else if (activeTab === "groups") {
      filtered = filtered.filter(
        (conversation) => conversation.type === "group"
      );
    } else if (activeTab === "favourites") {
      filtered = filtered.filter((conversation) => conversation.isFavourite);
    }

    if (normalizedSearchQuery) {
      filtered = filtered.filter((conversation) => {
        const displayName = getConversationDisplayName(
          conversation,
          contacts
        ).toLowerCase();
        const lastMessage = getLastMessage(conversation).toLowerCase();

        return (
          displayName.includes(normalizedSearchQuery) ||
          lastMessage.includes(normalizedSearchQuery)
        );
      });
    }

    return sortConversations(filtered);
  }, [activeTab, contacts, conversations, searchQuery]);

  const pinnedConversations = useMemo(
    () => filteredConversations.filter((c) => c.isPinned),
    [filteredConversations]
  );

  const unpinnedConversations = useMemo(
    () => filteredConversations.filter((c) => !c.isPinned),
    [filteredConversations]
  );

  const tabCounts = useMemo<ChatTabCounts>(
    () => ({
      all: conversations.length,
      unread: conversations.filter((c) => c.unreadCount > 0).length,
      groups: conversations.filter((c) => c.type === "group").length,
      favourites: conversations.filter((c) => c.isFavourite).length,
    }),
    [conversations]
  );

  const replyToMessage = useMemo(() => {
    if (!(activeConversation && replyToMessageId)) {
      return null;
    }

    return (
      activeConversation.messages.find(
        (message) => message.id === replyToMessageId
      ) ?? null
    );
  }, [activeConversation, replyToMessageId]);

  const unreadTotal = useMemo(
    () =>
      conversations.reduce(
        (total, conversation) => total + conversation.unreadCount,
        0
      ),
    [conversations]
  );

  const profileSheetUser = useMemo(() => {
    if (!profileSheetUserId) {
      return null;
    }

    if (profileSheetUserId === currentUser.id) {
      return currentUser;
    }

    return (
      contacts.find((contact) => contact.id === profileSheetUserId) ?? null
    );
  }, [contacts, currentUser, profileSheetUserId]);

  const profileConversation = useMemo(
    () =>
      profileSheetUserId
        ? (conversations.find(
            (c) => c.type === "direct" && c.contactId === profileSheetUserId
          ) ?? null)
        : null,
    [conversations, profileSheetUserId]
  );

  const activeDirectContact = useMemo(() => {
    if (activeConversation?.type !== "direct") {
      return null;
    }

    return contacts.find((c) => c.id === activeConversation.contactId) ?? null;
  }, [activeConversation, contacts]);

  const typingContact = useMemo(() => {
    if (!(isTyping && activeConversation)) {
      return null;
    }

    if (activeConversation.type === "direct") {
      return (
        contacts.find((c) => c.id === activeConversation.contactId) ?? null
      );
    }

    const typerId = activeConversation.memberIds?.find(
      (id) => id !== currentUser.id
    );

    return typerId ? (contacts.find((c) => c.id === typerId) ?? null) : null;
  }, [isTyping, activeConversation, contacts, currentUser.id]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      setActiveConversationId(id);
      markConversationAsRead(id);
    },
    [markConversationAsRead, setActiveConversationId]
  );

  const handleSendMessage = useCallback(
    (content: string, type?: MessageType, attachments?: Attachment[]) => {
      if (!activeConversationId) {
        return;
      }

      sendMessage(
        activeConversationId,
        content,
        type,
        replyToMessageId ?? undefined,
        attachments
      );
    },
    [activeConversationId, replyToMessageId, sendMessage]
  );

  const handleSendAttachment = useCallback(
    (file: File) => {
      if (!activeConversationId) {
        return;
      }

      const attachmentType: Attachment["type"] = file.type.startsWith("image/")
        ? "image"
        : "file";
      const messageType: MessageType =
        attachmentType === "image" ? "image" : "file";

      const attachment: Attachment = {
        id: `${Date.now()}-att`,
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        type: attachmentType,
      };

      sendMessage(
        activeConversationId,
        file.name,
        messageType,
        replyToMessageId ?? undefined,
        [attachment]
      );
    },
    [activeConversationId, replyToMessageId, sendMessage]
  );

  const handleSetReplyTo = useCallback(
    (messageId: string) => {
      setReplyToMessageId(messageId);
    },
    [setReplyToMessageId]
  );

  const handleClearReplyTo = useCallback(() => {
    setReplyToMessageId(null);
  }, [setReplyToMessageId]);

  const handlePinConversation = useCallback(
    (id: string) => {
      togglePinConversation(id);
    },
    [togglePinConversation]
  );

  const handleMuteConversation = useCallback(
    (id: string) => {
      toggleMuteConversation(id);
    },
    [toggleMuteConversation]
  );

  const handleFavouriteConversation = useCallback(
    (id: string) => {
      toggleFavouriteConversation(id);
    },
    [toggleFavouriteConversation]
  );

  const handleBlockContact = useCallback(
    (contactId: string) => {
      toggleBlockContact(contactId);
    },
    [toggleBlockContact]
  );

  const handleClearChat = useCallback(
    (conversationId: string) => {
      clearChat(conversationId);
    },
    [clearChat]
  );

  const handleDeleteContact = useCallback(
    (contactId: string) => {
      deleteContact(contactId);
      setActiveConversationId(null);
    },
    [deleteContact, setActiveConversationId]
  );

  const handleOpenProfile = useCallback(
    (userId: string) => {
      setProfileSheetUserId(userId);
    },
    [setProfileSheetUserId]
  );

  const handleCloseProfile = useCallback(() => {
    setProfileSheetUserId(null);
  }, [setProfileSheetUserId]);

  const handleUpdateOwnProfile = useCallback(
    (updates: OwnProfileUpdate) => {
      updateOwnProfile(updates);
    },
    [updateOwnProfile]
  );

  const handleQuickReply = useCallback(
    (text: string) => {
      handleSendMessage(text);
    },
    [handleSendMessage]
  );

  const handleSearchQueryChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
    },
    [setSearchQuery]
  );

  const handleActiveTabChange = useCallback(
    (tab: Parameters<typeof setActiveTab>[0]) => {
      setActiveTab(tab);
    },
    [setActiveTab]
  );

  return {
    currentUser,
    contacts,
    conversations,
    activeConversationId,
    activeConversation,
    activeContact,
    filteredConversations,
    pinnedConversations,
    unpinnedConversations,
    tabCounts,
    replyToMessage,
    unreadTotal,
    searchQuery,
    activeTab,
    profileSheetUser,
    profileSheetUserId,
    profileConversation,
    activeDirectContact,
    typingContact,
    isTyping,
    handleSearchQueryChange,
    handleActiveTabChange,
    handleSelectConversation,
    handleSendMessage,
    handleSendAttachment,
    handleSetReplyTo,
    handleClearReplyTo,
    handlePinConversation,
    handleMuteConversation,
    handleFavouriteConversation,
    handleBlockContact,
    handleClearChat,
    handleDeleteContact,
    handleOpenProfile,
    handleCloseProfile,
    handleUpdateOwnProfile,
    handleQuickReply,
  };
};
