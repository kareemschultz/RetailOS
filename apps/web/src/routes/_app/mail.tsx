import { createFileRoute } from "@tanstack/react-router";

import MailApp from "@/features/mail";

export const Route = createFileRoute("/_app/mail")({
  component: MailScreen,
});

function MailScreen() {
  return (
    <div className="w-full p-4">
      <MailApp />
    </div>
  );
}
