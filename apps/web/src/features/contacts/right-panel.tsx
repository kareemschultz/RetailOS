// Third-party imports

import { Button } from "@RetailOS/ui/components/button";
import { PlusIcon } from "lucide-react";
// React imports
import { useMemo } from "react";

// Store imports
import { useContactStore } from "@/features/contacts/store";
// SVG imports
import AddNewContactSVG from "./add-new";
import ContactDetails from "./contact-details";
import CreateContactForm from "./create-contact-form";
import EditContactForm from "./edit-contact-form";

const RightPanel = () => {
  const contacts = useContactStore((state) => state.contacts);
  const selectedContactPhone = useContactStore(
    (state) => state.selectedContactPhone
  );
  const isCreatingContact = useContactStore((state) => state.isCreatingContact);
  const isEditingContact = useContactStore((state) => state.isEditingContact);
  const openCreateContact = useContactStore((state) => state.openCreateContact);

  const selectedContact = useMemo(
    () =>
      contacts.find((contact) => contact.phone === selectedContactPhone) ??
      null,
    [contacts, selectedContactPhone]
  );

  if (isCreatingContact) {
    return <CreateContactForm />;
  }

  if (isEditingContact && selectedContact) {
    return <EditContactForm contact={selectedContact} />;
  }

  if (!selectedContact) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-10 p-4">
        <div className="flex flex-col items-center gap-4">
          <h2 className="font-bold text-2xl">Welcome to the Contacts App</h2>
          <p className="text-center text-muted-foreground">
            It&apos;s time to grow your customer book. Kickstart your CRM by
            adding your next customer or supplier.
          </p>
          <Button onClick={openCreateContact}>
            <PlusIcon />
            New Contact
          </Button>
        </div>
        <AddNewContactSVG className="ml-12 size-70" />
      </div>
    );
  }

  return <ContactDetails contact={selectedContact} />;
};

export default RightPanel;
