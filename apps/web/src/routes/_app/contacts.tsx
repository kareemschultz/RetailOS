import { createFileRoute } from "@tanstack/react-router";

import ContactsApp from "@/features/contacts/contacts-app";

export const Route = createFileRoute("/_app/contacts")({
  component: ContactsScreen,
});

function ContactsScreen() {
  return (
    <div className="mx-auto w-full max-w-7xl p-6">
      <ContactsApp />
    </div>
  );
}
