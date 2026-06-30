// Third-party Imports

// Component Imports
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@RetailOS/ui/components/collapsible";
import { ScrollArea } from "@RetailOS/ui/components/scroll-area";
import { ChevronDownIcon, MessageSquareIcon } from "lucide-react";
// Type Imports
import type { ChatTab, ChatUser, Conversation } from "@/features/chat/types";
import ChatListItem from "./chat-list-item";

export interface ChatListProps {
  activeConversationId: string | null;
  activeTab: ChatTab;
  contacts: ChatUser[];
  currentUser: ChatUser;
  onSelectConversation: (id: string) => void;
  pinnedConversations: Conversation[];
  unpinnedConversations: Conversation[];
}

const SECTION_LABELS: Record<ChatTab, string> = {
  all: "Recent",
  unread: "Unread",
  groups: "Groups",
  favourites: "Favourites",
};

const ChatList = (props: ChatListProps) => {
  // Props
  const {
    pinnedConversations,
    unpinnedConversations,
    contacts,
    currentUser,
    activeConversationId,
    activeTab,
    onSelectConversation,
  } = props;

  // Vars
  const sectionLabel = SECTION_LABELS[activeTab];
  const isEmpty =
    pinnedConversations.length === 0 && unpinnedConversations.length === 0;

  const resolveContact = (conversation: Conversation) => {
    if (conversation.type === "direct" && conversation.contactId) {
      return contacts.find((contact) => contact.id === conversation.contactId);
    }

    return;
  };

  if (isEmpty) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center text-muted-foreground">
        <MessageSquareIcon className="size-9 text-muted-foreground/40" />
        <p className="font-medium text-foreground text-sm">No conversations</p>
      </div>
    );
  }

  const renderSection = (title: string, items: Conversation[]) => (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-1 px-3 pb-2 font-medium text-muted-foreground text-xs hover:text-foreground [&[data-panel-open]>svg]:rotate-180">
        {title}
        <ChevronDownIcon className="size-3 transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-1 px-2">
          {items.map((conversation) => (
            <ChatListItem
              contact={resolveContact(conversation)}
              conversation={conversation}
              currentUser={currentUser}
              isActive={activeConversationId === conversation.id}
              key={conversation.id}
              onSelect={onSelectConversation}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  return (
    <ScrollArea className="h-full min-h-0 [&_[data-orientation=vertical][data-slot=scroll-area-scrollbar]]:w-1.5">
      <div className="flex flex-col gap-3">
        {pinnedConversations.length > 0 &&
          renderSection("Pinned", pinnedConversations)}
        {unpinnedConversations.length > 0 &&
          renderSection(sectionLabel, unpinnedConversations)}
      </div>
    </ScrollArea>
  );
};

export default ChatList;
