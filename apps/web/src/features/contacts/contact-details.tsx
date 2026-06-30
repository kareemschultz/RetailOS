// Third-party imports

import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { ScrollArea } from "@RetailOS/ui/components/scroll-area";
import { Separator } from "@RetailOS/ui/components/separator";
import {
  BadgeDollarSignIcon,
  BuildingIcon,
  CalendarIcon,
  MailIcon,
  MapPinIcon,
  MessageSquareIcon,
  PhoneIcon,
  ShoppingBagIcon,
  StarIcon,
  XIcon,
} from "lucide-react";

// Store imports
import { useContactStore } from "@/features/contacts/store";
// Type imports
import type { Contact } from "@/features/contacts/types";
import ContactActionsDropdown from "./contact-actions-dropdown";
import ContactAvatar from "./contact-avatar";

interface ContactDetailsProps {
  contact: Contact;
}

const GYD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "GYD",
  maximumFractionDigits: 0,
});

const ContactDetails = ({ contact }: ContactDetailsProps) => {
  const clearSelectedContact = useContactStore(
    (state) => state.clearSelectedContact
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 pb-4">
      <div className="relative flex h-60 items-center justify-center gap-2 p-4">
        <img
          alt="Contact Details Background"
          className="absolute top-0 left-0 h-full w-full object-cover dark:invert"
          src="/images/contacts/contact-details-bg.webp"
        />
        <Button
          className="absolute top-4 left-4 z-1 rounded-full"
          onClick={clearSelectedContact}
          size="icon-xs"
          variant="outline"
        >
          <XIcon />
        </Button>
        <div className="flex items-center gap-2">
          <ContactAvatar
            className="size-25 after:border-primary/20 [&>[data-slot=avatar-fallback]]:text-xl"
            contact={contact}
          />
          <div className="z-1 flex flex-col gap-0.5">
            <h2 className="max-w-50 truncate font-bold text-lg">
              {contact.firstName} {contact.lastName}
            </h2>
            {contact.company && (
              <span className="max-w-50 truncate text-muted-foreground text-sm">
                {contact.company}
              </span>
            )}
            <span className="max-w-50 truncate text-muted-foreground text-sm">
              {contact.email}
            </span>
            <div className="flex items-center gap-2">
              {!contact.isBlocked && (
                <Button size="icon-sm" variant="outline">
                  <PhoneIcon />
                </Button>
              )}
              <Button size="icon-sm" variant="outline">
                <MailIcon />
              </Button>
              {!contact.isBlocked && (
                <Button size="icon-sm" variant="outline">
                  <MessageSquareIcon />
                </Button>
              )}
              <ContactActionsDropdown
                contact={contact}
                triggerVariant="outline"
              />
            </div>
          </div>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold">Contact Info</h3>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-muted-foreground text-sm">
                <PhoneIcon className="size-4 shrink-0" />
                <span>{contact.phone}</span>
              </div>
              <div className="flex items-center gap-2 truncate rounded-md bg-muted p-3 text-muted-foreground text-sm">
                <MailIcon className="size-4 shrink-0" />
                <span>{contact.email}</span>
              </div>
              <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-muted-foreground text-sm">
                <MapPinIcon className="size-4 shrink-0" />
                <span>{contact.city}</span>
              </div>
              <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-muted-foreground text-sm">
                <CalendarIcon className="size-4 shrink-0" />
                <span>
                  Added on{" "}
                  {contact.addedDate.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {(contact.company ||
            contact.creditLimitGyd !== undefined ||
            contact.loyaltyTier ||
            contact.lastPurchase) && (
            <>
              <Separator />
              <div className="flex flex-col gap-3">
                <h3 className="font-semibold">Account</h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  {contact.company && (
                    <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-muted-foreground text-sm">
                      <BuildingIcon className="size-4 shrink-0" />
                      <span className="truncate">{contact.company}</span>
                    </div>
                  )}
                  {contact.creditLimitGyd !== undefined && (
                    <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-muted-foreground text-sm">
                      <BadgeDollarSignIcon className="size-4 shrink-0" />
                      <span>
                        Credit limit {GYD.format(contact.creditLimitGyd)}
                      </span>
                    </div>
                  )}
                  {contact.loyaltyTier && (
                    <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-muted-foreground text-sm">
                      <StarIcon className="size-4 shrink-0" />
                      <span>{contact.loyaltyTier} tier</span>
                    </div>
                  )}
                  {contact.lastPurchase && (
                    <div className="flex items-center gap-2 truncate rounded-md bg-muted p-3 text-muted-foreground text-sm">
                      <ShoppingBagIcon className="size-4 shrink-0" />
                      <span className="truncate">{contact.lastPurchase}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold">Note</h3>
            <div className="flex items-center gap-2 text-wrap rounded-md bg-muted p-3 text-muted-foreground text-sm">
              <span>{contact.notes}</span>
            </div>
          </div>
          <Separator />
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold">Labels</h3>
            <div className="flex items-center gap-2">
              {contact.labels.map((label) => (
                <Badge className="capitalize" key={label} variant="outline">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default ContactDetails;
