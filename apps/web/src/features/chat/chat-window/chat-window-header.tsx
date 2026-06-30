// Third-party Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
import { Button } from "@RetailOS/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import { Separator } from "@RetailOS/ui/components/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@RetailOS/ui/components/tooltip";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import {
  ChevronLeftIcon,
  MoreVerticalIcon,
  PhoneIcon,
  VideoIcon,
} from "lucide-react";
// Type Imports
import type {
  ChatUser,
  ChatUserStatus,
  Conversation,
} from "@/features/chat/types";
// Config Imports
import { getInitialsFromName } from "@/features/chat/utils";

export interface ChatWindowHeaderProps {
  activeContact: ChatUser | null;
  activeConversation: Conversation;
  onBack?: () => void;
  onBlockContact: (contactId: string) => void;
  onClearChat: (conversationId: string) => void;
  onDeleteContact: (contactId: string) => void;
  onFavouriteConversation: (id: string) => void;
  onMuteConversation: (id: string) => void;
  onOpenProfile: (userId: string) => void;
  onPinConversation: (id: string) => void;
}

const STATUS_DOT_CLASSES: Record<ChatUserStatus, string> = {
  online: "bg-green-500",
  away: "bg-yellow-500",
  busy: "bg-red-500",
  offline: "bg-muted-foreground",
};

const ChatWindowHeader = (props: ChatWindowHeaderProps) => {
  // Props
  const {
    activeContact,
    activeConversation,
    onBack,
    onOpenProfile,
    onMuteConversation,
    onPinConversation,
    onFavouriteConversation,
    onClearChat,
    onBlockContact,
    onDeleteContact,
  } = props;

  // Vars
  const isDirect = activeConversation.type === "direct";
  const displayName = isDirect
    ? (activeContact?.name ?? "Unknown")
    : (activeConversation.groupName ?? "Group");
  const displayAvatar = isDirect
    ? activeContact?.avatar
    : activeConversation.groupAvatar;
  const displayStatus = isDirect
    ? (activeContact?.status ?? "offline")
    : "online";

  const subtitle = isDirect
    ? displayStatus
    : `${activeConversation.memberIds?.length ?? 0} members`;

  const contactId = activeConversation.contactId;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4 px-2 pt-3">
        <div className="flex min-w-0 items-center gap-3">
          {onBack && (
            <Button
              aria-label="Back to conversations"
              className="md:hidden"
              onClick={onBack}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
          )}

          <button
            className={cn(
              "relative shrink-0 rounded-full ring-offset-background transition-opacity",
              isDirect && contactId && "hover:opacity-80"
            )}
            disabled={!(isDirect && contactId)}
            onClick={() => {
              if (isDirect && contactId) {
                onOpenProfile(contactId);
              }
            }}
            title={isDirect && contactId ? "View profile" : undefined}
            type="button"
          >
            <Avatar>
              <AvatarImage alt={displayName} src={displayAvatar} />
              <AvatarFallback>
                {getInitialsFromName(displayName)}
              </AvatarFallback>
            </Avatar>
            {isDirect && (
              <span
                className={cn(
                  "absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-background",
                  STATUS_DOT_CLASSES[displayStatus]
                )}
              />
            )}
          </button>

          <div className="min-w-0">
            <p className="truncate font-medium text-sm">{displayName}</p>
            <p className="truncate text-muted-foreground text-xs leading-3">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button aria-label="Call" size="icon-sm" variant="ghost" />
              }
            >
              <PhoneIcon className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Call</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Video call"
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <VideoIcon className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Video call</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label="More actions"
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <MoreVerticalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {isDirect && contactId && (
                <DropdownMenuItem onClick={() => onOpenProfile(contactId)}>
                  View profile
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onMuteConversation(activeConversation.id)}
              >
                {activeConversation.isMuted ? "Unmute" : "Mute notifications"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onPinConversation(activeConversation.id)}
              >
                {activeConversation.isPinned ? "Unpin" : "Pin to top"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onFavouriteConversation(activeConversation.id)}
              >
                {activeConversation.isFavourite
                  ? "Remove favourite"
                  : "Add to favourites"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onClearChat(activeConversation.id)}
              >
                Clear chat
              </DropdownMenuItem>
              {isDirect && contactId && (
                <>
                  <DropdownMenuItem
                    onClick={() => onBlockContact(contactId)}
                    variant="destructive"
                  >
                    Block contact
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDeleteContact(contactId)}
                    variant="destructive"
                  >
                    Delete contact
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Separator />
    </div>
  );
};

export default ChatWindowHeader;
