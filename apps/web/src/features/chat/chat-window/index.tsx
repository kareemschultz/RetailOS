// Third-party Imports
import { MessageSquareIcon } from "lucide-react";
// Component Imports
import ChatInput from "@/features/chat/chat-input";
// Type Imports
import type {
  Attachment,
  ChatUser,
  Conversation,
  Message,
  MessageType,
} from "@/features/chat/types";
import ChatMessages from "./chat-messages";
import ChatWindowHeader from "./chat-window-header";

export interface ChatWindowProps {
  activeDirectContact: ChatUser | null;
  contacts: ChatUser[];
  conversation: Conversation | null;
  currentUser: ChatUser;
  isTyping: boolean;
  onBack?: () => void;
  onBlockContact: (contactId: string) => void;
  onClearChat: (conversationId: string) => void;
  onClearReplyTo: () => void;
  onDeleteContact: (contactId: string) => void;
  onFavouriteConversation: (id: string) => void;
  onMuteConversation: (id: string) => void;
  onOpenProfile: (userId: string) => void;
  onPinConversation: (id: string) => void;
  onQuickReply: (text: string) => void;
  onSendMessage: (
    content: string,
    type?: MessageType,
    attachments?: Attachment[]
  ) => void;
  onSetReplyTo: (messageId: string) => void;
  replyToMessage: Message | null;
  typingContact: ChatUser | null;
}

const ChatWindow = (props: ChatWindowProps) => {
  // Props
  const {
    currentUser,
    conversation,
    activeDirectContact,
    contacts,
    replyToMessage,
    isTyping,
    typingContact,
    onSendMessage,
    onSetReplyTo,
    onClearReplyTo,
    onQuickReply,
    onPinConversation,
    onMuteConversation,
    onFavouriteConversation,
    onClearChat,
    onOpenProfile,
    onBlockContact,
    onDeleteContact,
    onBack,
  } = props;

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <MessageSquareIcon className="size-12 text-muted-foreground/30" />
        <p className="font-medium text-muted-foreground text-sm">
          Select a conversation
        </p>
        <p className="text-muted-foreground/70 text-xs">
          Choose from your existing conversations
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatWindowHeader
        activeContact={activeDirectContact}
        activeConversation={conversation}
        onBack={onBack}
        onBlockContact={onBlockContact}
        onClearChat={onClearChat}
        onDeleteContact={onDeleteContact}
        onFavouriteConversation={onFavouriteConversation}
        onMuteConversation={onMuteConversation}
        onOpenProfile={onOpenProfile}
        onPinConversation={onPinConversation}
      />

      <ChatMessages
        contacts={contacts}
        currentUser={currentUser}
        currentUserId={currentUser.id}
        isGroupChat={conversation.type === "group"}
        isTyping={isTyping}
        messages={conversation.messages}
        onReplyToMessage={onSetReplyTo}
        typingContact={typingContact ?? undefined}
      />

      <ChatInput
        activeConversation={conversation}
        onClearReplyTo={onClearReplyTo}
        onQuickReply={onQuickReply}
        onSendMessage={onSendMessage}
        replyToMessage={replyToMessage}
      />
    </div>
  );
};

export default ChatWindow;
