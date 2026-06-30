export type ChatUserStatus = "online" | "away" | "busy" | "offline";

export type ChatSocialPlatform =
  | "facebook"
  | "twitter"
  | "linkedin"
  | "instagram"
  | "website";

export interface ChatSocialLink {
  platform: ChatSocialPlatform;
  url: string;
}

export type MessageType = "text" | "image" | "file";

export type MessageStatus = "sent" | "delivered" | "read";

export type ConversationType = "direct" | "group";

export type ChatTab = "all" | "unread" | "groups" | "favourites";

export interface ChatUser {
  about?: string;
  availability?: string;
  avatar?: string;
  company?: string;
  country?: string;
  email?: string;
  id: string;
  isBlocked?: boolean;
  location?: string;
  name: string;
  phone?: string;
  role?: string;
  socialLinks?: ChatSocialLink[];
  status: ChatUserStatus;
  tags?: string[];
  timezone?: string;
  website?: string;
}

export type OwnProfileUpdate = Partial<Omit<ChatUser, "id" | "isBlocked">>;

export interface Attachment {
  id: string;
  name: string;
  size: string;
  type: "image" | "file";
  url?: string;
}

export interface Message {
  attachments?: Attachment[];
  content: string;
  id: string;
  replyToId?: string;
  senderId: string;
  status: MessageStatus;
  timestamp: string;
  type: MessageType;
}

export interface Conversation {
  autoReplies: string[];
  contactId?: string;
  groupAvatar?: string;
  groupName?: string;
  id: string;
  isFavourite: boolean;
  isMuted: boolean;
  isPinned: boolean;
  memberIds?: string[];
  messages: Message[];
  suggestions: string[];
  type: ConversationType;
  unreadCount: number;
}

export interface ChatData {
  contacts: ChatUser[];
  conversations: Conversation[];
  currentUser: ChatUser;
}

export interface ChatTabCounts {
  all: number;
  favourites: number;
  groups: number;
  unread: number;
}

export type ComposerMode = "reply" | "note";

export interface PendingAttachment {
  file: File;
  id: string;
  previewUrl: string;
  type: "image" | "file";
}

export interface OwnProfileFormState {
  about: string;
  availability: string;
  avatar: string;
  company: string;
  country: string;
  email: string;
  location: string;
  name: string;
  phone: string;
  role: string;
  status: ChatUserStatus;
  timezone: string;
  website: string;
}
