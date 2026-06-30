// React Imports

import { useIsMobile } from "@RetailOS/ui/hooks/use-mobile";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import { type CSSProperties, useState } from "react";
// Hook Imports
import { useChatApp } from "@/features/chat/use-chat-app";
// Component Imports
import ChatSidebar from "./chat-sidebar";
import ChatWindow from "./chat-window";
import ProfileSheet from "./dialogs/profile-sheet";

const ChatApp = () => {
  // States
  const [showThread, setShowThread] = useState(false);

  // Hooks
  const isMobile = useIsMobile();

  const {
    currentUser,
    contacts,
    activeConversationId,
    activeConversation,
    pinnedConversations,
    unpinnedConversations,
    tabCounts,
    replyToMessage,
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
  } = useChatApp();

  // Vars
  const showProfile = Boolean(profileSheetUser);
  const isOwnProfile = profileSheetUserId === currentUser.id;

  const profileSheetProps = {
    user: profileSheetUser,
    open: showProfile,
    onClose: handleCloseProfile,
    isOwnProfile,
    contactConversation: profileConversation,
    onMuteConversation: handleMuteConversation,
    onPinConversation: handlePinConversation,
    onFavouriteConversation: handleFavouriteConversation,
    onClearChat: handleClearChat,
    onBlockContact: handleBlockContact,
    onDeleteContact: handleDeleteContact,
    onUpdateOwnProfile: handleUpdateOwnProfile,
  };

  const handleConversationSelect = (id: string) => {
    handleSelectConversation(id);
    setShowThread(true);
  };

  const handleBackToList = () => {
    setShowThread(false);
  };

  return (
    <>
      <div className="flex h-[calc(100dvh-12rem)] flex-col lg:h-[calc(100dvh-11rem)] lg:min-h-130">
        <div
          className="grid h-full min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden rounded-lg border bg-background transition-[grid-template-columns] duration-300 ease-out *:min-h-0 *:min-w-0 md:grid-cols-[19rem_minmax(0,1fr)] md:*:first:border-r lg:grid-cols-[22.5rem_minmax(0,1fr)_var(--profile-width)]"
          onClick={showProfile && !isMobile ? handleCloseProfile : undefined}
          style={
            {
              "--profile-width": showProfile && !isMobile ? "20rem" : "0rem",
            } as CSSProperties
          }
        >
          <div
            className={cn(
              "bg-card transition-transform duration-300 ease-out will-change-transform max-md:col-start-1 max-md:row-start-1",
              showThread &&
                "max-md:pointer-events-none max-md:-translate-x-full"
            )}
          >
            <ChatSidebar
              activeConversationId={activeConversationId}
              activeTab={activeTab}
              contacts={contacts}
              currentUser={currentUser}
              onActiveTabChange={handleActiveTabChange}
              onOpenOwnProfile={() => handleOpenProfile(currentUser.id)}
              onSearchQueryChange={handleSearchQueryChange}
              onSelectConversation={handleConversationSelect}
              pinnedConversations={pinnedConversations}
              searchQuery={searchQuery}
              tabCounts={tabCounts}
              unpinnedConversations={unpinnedConversations}
            />
          </div>

          <div
            className={cn(
              "flex min-h-0 flex-col bg-background transition-transform duration-300 ease-out will-change-transform max-md:col-start-1 max-md:row-start-1",
              showThread
                ? "max-md:translate-x-0"
                : "max-md:pointer-events-none max-md:translate-x-full"
            )}
          >
            <ChatWindow
              activeDirectContact={activeDirectContact}
              contacts={contacts}
              conversation={activeConversation}
              currentUser={currentUser}
              isTyping={isTyping}
              onBack={isMobile ? handleBackToList : undefined}
              onBlockContact={handleBlockContact}
              onClearChat={handleClearChat}
              onClearReplyTo={handleClearReplyTo}
              onDeleteContact={handleDeleteContact}
              onFavouriteConversation={handleFavouriteConversation}
              onMuteConversation={handleMuteConversation}
              onOpenProfile={handleOpenProfile}
              onPinConversation={handlePinConversation}
              onQuickReply={handleQuickReply}
              onSendMessage={handleSendMessage}
              onSetReplyTo={handleSetReplyTo}
              replyToMessage={replyToMessage}
              typingContact={typingContact}
            />
          </div>

          <div
            aria-hidden={!showProfile}
            className={cn(
              "hidden overflow-hidden border-l transition-colors duration-300 lg:block",
              !showProfile && "pointer-events-none border-l-transparent"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={cn(
                "h-full w-80 transition-[opacity,transform] duration-300 ease-out",
                showProfile
                  ? "translate-x-0 opacity-100"
                  : "translate-x-full opacity-0"
              )}
            >
              {profileSheetUser && (
                <ProfileSheet {...profileSheetProps} variant="panel" />
              )}
            </div>
          </div>
        </div>
      </div>

      {isMobile && <ProfileSheet {...profileSheetProps} />}
    </>
  );
};

export default ChatApp;
