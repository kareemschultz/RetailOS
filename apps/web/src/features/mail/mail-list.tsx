// Third-party Imports

// Component Imports
import { ScrollArea } from "@RetailOS/ui/components/scroll-area";
import { InboxIcon } from "lucide-react";

// Type Imports
import type { Email } from "@/features/mail/types";
import MailItem from "./mail-item";

interface MailListProps {
  emails: Email[];
  onEmailSelect: (email: Email) => void;
  selectedEmailId: string | null;
}

const MailList = ({
  emails,
  selectedEmailId,
  onEmailSelect,
}: MailListProps) => {
  if (emails.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center text-muted-foreground">
        <InboxIcon className="size-9 text-muted-foreground/40" />
        <p className="font-medium text-foreground text-sm">No messages</p>
        <p className="text-xs">This folder is empty.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col p-3 pt-0">
        {emails.map((email) => (
          <MailItem
            email={email}
            isSelected={selectedEmailId === email.id}
            key={email.id}
            onClick={() => onEmailSelect(email)}
          />
        ))}
      </div>
    </ScrollArea>
  );
};

export default MailList;
