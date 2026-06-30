// Type imports
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
import { cn } from "@RetailOS/ui/lib/utils";

import type { Contact } from "@/features/contacts/types";
import { getContactInitials } from "@/features/contacts/utils";

interface ContactAvatarProps {
  className?: string;
  contact: Pick<Contact, "firstName" | "lastName" | "image">;
}

const ContactAvatar = ({ contact, className }: ContactAvatarProps) => (
  <Avatar className={cn("size-10 shrink-0", className)}>
    {contact.image && (
      <AvatarImage
        alt={`${contact.firstName} ${contact.lastName}`}
        src={contact.image}
      />
    )}
    <AvatarFallback>
      {getContactInitials(contact.firstName, contact.lastName)}
    </AvatarFallback>
  </Avatar>
);

export default ContactAvatar;
