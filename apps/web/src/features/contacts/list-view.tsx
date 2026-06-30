// Component imports
import { Badge } from "@RetailOS/ui/components/badge";
import { Separator } from "@RetailOS/ui/components/separator";
import { cn } from "@RetailOS/ui/lib/utils";

// Store imports
import { useContactStore } from "@/features/contacts/store";
// Type imports
import type { Contact } from "@/features/contacts/types";
import { CONTACT_LABEL_STYLES } from "@/features/contacts/types";
import ContactActionsDropdown from "./contact-actions-dropdown";
import ContactAvatar from "./contact-avatar";

type GroupedContacts = [string, Contact[]][];

interface ListViewProps {
  className?: string;
  groupedContacts: GroupedContacts;
}

const ListView = ({ groupedContacts, className }: ListViewProps) => {
  const selectedContactPhone = useContactStore(
    (state) => state.selectedContactPhone
  );
  const selectContact = useContactStore((state) => state.selectContact);

  if (groupedContacts.length === 0) {
    return (
      <p className="text-center text-muted-foreground text-sm">
        No contacts found.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {groupedContacts.map(([letter, letterContacts]) => (
        <div className="flex flex-col gap-1.5" key={letter}>
          <div className="flex flex-col gap-1">
            <span className="font-medium text-muted-foreground text-sm">
              {letter}
            </span>
            <Separator />
          </div>
          <div className="flex flex-col gap-3">
            {letterContacts.map((contact) => (
              <div
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent",
                  selectedContactPhone === contact.phone && "bg-accent"
                )}
                key={contact.phone}
                onClick={() => selectContact(contact.phone)}
              >
                <div className="flex items-center gap-2">
                  <ContactAvatar contact={contact} />
                  <div className="flex max-w-50 flex-col truncate">
                    <span className="font-medium">
                      {contact.firstName} {contact.lastName}
                    </span>
                    <span className="truncate text-gray-500 text-sm">
                      {contact.email}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {/* sm–md: hidden | md–lg: 1 badge | lg+: 2 badges */}
                  {contact.labels.slice(0, 1).map((label) => (
                    <Badge
                      className="hidden capitalize md:flex lg:hidden"
                      key={label}
                      variant="outline"
                    >
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          CONTACT_LABEL_STYLES[label]
                        )}
                      />
                      {label}
                    </Badge>
                  ))}
                  {contact.labels.slice(0, 2).map((label) => (
                    <Badge
                      className="hidden capitalize lg:flex"
                      key={label}
                      variant="outline"
                    >
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          CONTACT_LABEL_STYLES[label]
                        )}
                      />
                      {label}
                    </Badge>
                  ))}
                  {/* overflow badge: md–lg counts from 1, lg+ counts from 2 */}
                  {contact.labels.length > 1 && (
                    <Badge
                      className="hidden md:flex lg:hidden"
                      variant="outline"
                    >
                      +{contact.labels.length - 1}
                    </Badge>
                  )}
                  {contact.labels.length > 2 && (
                    <Badge className="hidden lg:flex" variant="outline">
                      +{contact.labels.length - 2}
                    </Badge>
                  )}
                  <ContactActionsDropdown
                    contact={contact}
                    triggerClassName="hover:bg-primary/10! rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ListView;
