// Component imports
import { Badge } from "@RetailOS/ui/components/badge";
import { cn } from "@RetailOS/ui/lib/utils";

// Store imports
import { useContactStore } from "@/features/contacts/store";
// Type imports
import type { Contact } from "@/features/contacts/types";
import { CONTACT_LABEL_STYLES } from "@/features/contacts/types";
import ContactActionsDropdown from "./contact-actions-dropdown";
import ContactAvatar from "./contact-avatar";

interface GridViewProps {
  contacts: Contact[];
}

const GridView = ({ contacts }: GridViewProps) => {
  const selectedContactPhone = useContactStore(
    (state) => state.selectedContactPhone
  );
  const selectContact = useContactStore((state) => state.selectContact);

  if (contacts.length === 0) {
    return (
      <p className="text-center text-muted-foreground text-sm">
        No contacts found.
      </p>
    );
  }

  return (
    <div className="hidden sm:block">
      <div className="grid grid-cols-2 gap-4">
        {contacts.map((contact) => (
          <div
            className={cn(
              "group relative flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 text-left transition-colors hover:border-primary/50",
              selectedContactPhone === contact.phone &&
                "border-primary bg-accent/50 hover:border-primary"
            )}
            key={contact.phone}
            onClick={() => selectContact(contact.phone)}
          >
            <ContactActionsDropdown
              contact={contact}
              triggerClassName="absolute top-2 right-2 hover:bg-primary/10! rounded-full"
            />
            <ContactAvatar contact={contact} />
            <div className="flex max-w-50 flex-col truncate">
              <span className="self-center truncate font-medium">
                {contact.firstName} {contact.lastName}
              </span>
              <span className="truncate text-gray-500 text-sm">
                {contact.email}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {/* sm–md: 2 badges | md–lg: 1 badge | lg+: 2 badges */}
              {contact.labels.slice(0, 2).map((label) => (
                <Badge
                  className="flex capitalize md:hidden lg:flex"
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
              {/* overflow: sm–md counts from 2, md–lg counts from 1, lg+ counts from 2 */}
              {contact.labels.length > 2 && (
                <Badge className="flex md:hidden lg:flex" variant="outline">
                  +{contact.labels.length - 2}
                </Badge>
              )}
              {contact.labels.length > 1 && (
                <Badge className="hidden md:flex lg:hidden" variant="outline">
                  +{contact.labels.length - 1}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GridView;
