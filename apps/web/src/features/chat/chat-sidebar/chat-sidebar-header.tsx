// React Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
import { Button } from "@RetailOS/ui/components/button";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
// Third-party Imports
import { UserPlusIcon } from "lucide-react";
import { useState } from "react";
import InviteDialog from "@/features/chat/dialogs/invite-dialog";
// Type Imports
import type { ChatUser, ChatUserStatus } from "@/features/chat/types";
// Config Imports
import { getInitialsFromName } from "@/features/chat/utils";

export interface ChatSidebarHeaderProps {
  contacts: ChatUser[];
  currentUser: ChatUser;
  onOpenOwnProfile: () => void;
}

const STATUS_DOT_CLASSES: Record<ChatUserStatus, string> = {
  online: "bg-green-500",
  away: "bg-yellow-500",
  busy: "bg-red-500",
  offline: "bg-muted-foreground",
};

const ChatSidebarHeader = (props: ChatSidebarHeaderProps) => {
  // Props
  const { currentUser, contacts, onOpenOwnProfile } = props;

  // States
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            className="relative shrink-0 rounded-full ring-offset-background transition-opacity hover:opacity-80"
            onClick={onOpenOwnProfile}
            title="My profile"
            type="button"
          >
            <Avatar className="size-8">
              <AvatarImage alt={currentUser.name} src={currentUser.avatar} />
              <AvatarFallback className="text-xs">
                {getInitialsFromName(currentUser.name)}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-background",
                STATUS_DOT_CLASSES[currentUser.status]
              )}
            />
          </button>

          <h2 className="truncate font-semibold text-lg">Chats</h2>
        </div>

        <Button
          aria-label="Invite to chat"
          onClick={() => setIsInviteDialogOpen(true)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <UserPlusIcon className="size-4" />
        </Button>
      </div>

      <InviteDialog
        contacts={contacts}
        onOpenChange={setIsInviteDialogOpen}
        open={isInviteDialogOpen}
      />
    </>
  );
};

export default ChatSidebarHeader;
