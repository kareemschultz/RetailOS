// Third-party Imports

// Component Imports
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@RetailOS/ui/components/input-group";
import { Separator } from "@RetailOS/ui/components/separator";
import { Tabs, TabsList, TabsTrigger } from "@RetailOS/ui/components/tabs";
import { SearchIcon } from "lucide-react";
// Type Imports
import type {
  ChatTab,
  ChatTabCounts,
  ChatUser,
  Conversation,
} from "@/features/chat/types";
import ChatList from "./chat-list";
import ChatSidebarHeader from "./chat-sidebar-header";

export interface ChatSidebarProps {
  activeConversationId: string | null;
  activeTab: ChatTab;
  contacts: ChatUser[];
  currentUser: ChatUser;
  onActiveTabChange: (tab: ChatTab) => void;
  onOpenOwnProfile: () => void;
  onSearchQueryChange: (query: string) => void;
  onSelectConversation: (id: string) => void;
  pinnedConversations: Conversation[];
  searchQuery: string;
  tabCounts: ChatTabCounts;
  unpinnedConversations: Conversation[];
}

const TAB_ITEMS: { value: ChatTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "groups", label: "Groups" },
  { value: "favourites", label: "Favourites" },
];

const ChatSidebar = (props: ChatSidebarProps) => {
  // Props
  const {
    currentUser,
    pinnedConversations,
    unpinnedConversations,
    tabCounts,
    contacts,
    activeConversationId,
    searchQuery,
    activeTab,
    onSearchQueryChange,
    onActiveTabChange,
    onSelectConversation,
    onOpenOwnProfile,
  } = props;

  return (
    <div className="flex h-full flex-col gap-3 py-3">
      <div className="px-3">
        <ChatSidebarHeader
          contacts={contacts}
          currentUser={currentUser}
          onOpenOwnProfile={onOpenOwnProfile}
        />
      </div>

      <Separator />

      <div className="px-3">
        <InputGroup className="h-9">
          <InputGroupAddon>
            <SearchIcon className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search conversations..."
            value={searchQuery}
          />
        </InputGroup>
      </div>

      <Tabs
        onValueChange={(value) => onActiveTabChange(value as ChatTab)}
        value={activeTab}
      >
        <TabsList
          className="w-full border-b **:data-[slot=tabs-trigger]:border-x-0"
          variant="line"
        >
          {TAB_ITEMS.map((tab) => {
            const count = tabCounts[tab.value];

            return (
              <TabsTrigger
                className="gap-1 font-normal text-xs"
                key={tab.value}
                value={tab.value}
              >
                {tab.label}
                {count > 0 && (
                  <span className="text-muted-foreground text-xs">
                    ({count})
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ChatList
          activeConversationId={activeConversationId}
          activeTab={activeTab}
          contacts={contacts}
          currentUser={currentUser}
          onSelectConversation={onSelectConversation}
          pinnedConversations={pinnedConversations}
          unpinnedConversations={unpinnedConversations}
        />
      </div>
    </div>
  );
};

export default ChatSidebar;
