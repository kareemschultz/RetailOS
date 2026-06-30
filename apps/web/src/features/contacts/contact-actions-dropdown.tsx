// Third-party imports

import { Button } from "@RetailOS/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import { cn } from "@RetailOS/ui/lib/utils";
import {
  BanIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  StarIcon,
  TrashIcon,
} from "lucide-react";
// Store imports
import { useContactStore } from "@/features/contacts/store";
import type { Contact } from "@/features/contacts/types";
// Utils imports
import { getContactDropdownActions } from "@/features/contacts/utils";

interface ContactActionsDropdownProps {
  contact: Contact;
  onAction?: () => void;
  onEdit?: () => void;
  triggerClassName?: string;
  triggerVariant?: "ghost" | "outline";
}

const ContactActionsDropdown = ({
  contact,
  triggerClassName,
  triggerVariant = "ghost",
  onEdit,
  onAction,
}: ContactActionsDropdownProps) => {
  const openEditContact = useContactStore((state) => state.openEditContact);
  const toggleFavourite = useContactStore((state) => state.toggleFavourite);
  const toggleSpam = useContactStore((state) => state.toggleSpam);
  const toggleBlocked = useContactStore((state) => state.toggleBlocked);
  const deleteContact = useContactStore((state) => state.deleteContact);

  const {
    showEditAction,
    showDeleteAction,
    showFavouriteAction,
    showSpamAction,
    showNotSpamAction,
    showBlockAction,
  } = getContactDropdownActions(contact);

  const handleEdit = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // Run after the parent row click from menu dismiss, which would reset isEditingContact.
    queueMicrotask(() => {
      openEditContact(contact.phone);
      onEdit?.();
    });
  };

  const runAction = (event: React.MouseEvent, action: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    action();
    onAction?.();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className={triggerClassName}
            onClick={
              triggerVariant === "ghost"
                ? (event) => event.stopPropagation()
                : undefined
            }
            size="icon-sm"
            variant={triggerVariant}
          />
        }
      >
        <EllipsisVerticalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {showEditAction && (
          <DropdownMenuItem
            onClick={handleEdit}
            onMouseDown={(event) => event.preventDefault()}
          >
            <PencilIcon />
            Edit
          </DropdownMenuItem>
        )}
        {showFavouriteAction && (
          <DropdownMenuItem
            onClick={(event) =>
              runAction(event, () => toggleFavourite(contact.phone))
            }
            onMouseDown={(event) => event.preventDefault()}
          >
            <StarIcon
              className={cn(contact.isFavourite && "fill-primary text-primary")}
            />
            {contact.isFavourite ? "Unfavourite" : "Favourite"}
          </DropdownMenuItem>
        )}
        {showSpamAction && (
          <DropdownMenuItem
            onClick={(event) =>
              runAction(event, () => toggleSpam(contact.phone))
            }
            onMouseDown={(event) => event.preventDefault()}
          >
            <ShieldAlertIcon />
            Spam
          </DropdownMenuItem>
        )}
        {showNotSpamAction && (
          <DropdownMenuItem
            onClick={(event) =>
              runAction(event, () => toggleSpam(contact.phone))
            }
            onMouseDown={(event) => event.preventDefault()}
          >
            <ShieldCheckIcon />
            Not spam
          </DropdownMenuItem>
        )}
        {showBlockAction && (
          <DropdownMenuItem
            onClick={(event) =>
              runAction(event, () => toggleBlocked(contact.phone))
            }
            onMouseDown={(event) => event.preventDefault()}
          >
            <BanIcon />
            {contact.isBlocked ? "Unblock" : "Block"}
          </DropdownMenuItem>
        )}
        {showDeleteAction && (
          <DropdownMenuItem
            onClick={(event) =>
              runAction(event, () => deleteContact(contact.phone))
            }
            onMouseDown={(event) => event.preventDefault()}
            variant="destructive"
          >
            <TrashIcon />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ContactActionsDropdown;
