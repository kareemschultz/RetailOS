// Type Imports

// Component Imports
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@RetailOS/ui/components/sheet";
import type {
  ChatUser,
  Conversation,
  OwnProfileUpdate,
} from "@/features/chat/types";
import ProfileContent from "./profile-content";

export interface ProfileSheetProps {
  contactConversation: Conversation | null;
  isOwnProfile: boolean;
  onBlockContact: (contactId: string) => void;
  onClearChat: (conversationId: string) => void;
  onClose: () => void;
  onDeleteContact: (contactId: string) => void;
  onFavouriteConversation: (id: string) => void;
  onMuteConversation: (id: string) => void;
  onPinConversation: (id: string) => void;
  onUpdateOwnProfile: (updates: OwnProfileUpdate) => void;
  open: boolean;
  user: ChatUser | null;
  variant?: "sheet" | "panel";
}

const ProfileSheet = (props: ProfileSheetProps) => {
  // Props
  const { user, open, onClose, variant = "sheet", ...contentProps } = props;

  if (!user) {
    return null;
  }

  if (variant === "panel") {
    return <ProfileContent onClose={onClose} user={user} {...contentProps} />;
  }

  return (
    <Sheet onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <SheetContent className="w-80 p-0" showCloseButton={false} side="right">
        <SheetTitle className="sr-only">
          {contentProps.isOwnProfile ? "My profile" : `${user.name} profile`}
        </SheetTitle>
        <SheetDescription className="sr-only">
          View profile details and manage conversation options
        </SheetDescription>
        <ProfileContent onClose={onClose} user={user} {...contentProps} />
      </SheetContent>
    </Sheet>
  );
};

export default ProfileSheet;
