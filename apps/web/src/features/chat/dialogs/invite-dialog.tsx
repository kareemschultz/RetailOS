// React Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
import { Button } from "@RetailOS/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@RetailOS/ui/components/dialog";
import { Input } from "@RetailOS/ui/components/input";
// Third-party Imports
import { CheckIcon, CopyIcon, Link2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
// Type Imports
import type { ChatUser } from "@/features/chat/types";

// Config Imports
import { getInitialsFromName } from "@/features/chat/utils";

export interface InviteDialogProps {
  contacts: ChatUser[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

const SHARE_LINK = "https://app.example.com/chat/invite";
const COPY_RESET_DELAY_MS = 2000;

const InviteDialog = (props: InviteDialogProps) => {
  // Props
  const { open, onOpenChange, contacts } = props;

  // States
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  // Hooks
  const filteredContacts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return contacts;
    }

    return contacts.filter((contact) => {
      const name = contact.name.toLowerCase();
      const email = contact.email?.toLowerCase() ?? "";

      return name.includes(normalizedQuery) || email.includes(normalizedQuery);
    });
  }, [contacts, searchQuery]);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const id = setTimeout(() => setCopied(false), COPY_RESET_DELAY_MS);

    return () => clearTimeout(id);
  }, [copied]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearchQuery("");
      setCopied(false);
    }

    onOpenChange(nextOpen);
  };

  const handleInvite = () => {
    handleOpenChange(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(SHARE_LINK);
    setCopied(true);
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="gap-4 sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Invite</DialogTitle>
        </DialogHeader>

        <div className="mx-0 flex items-center gap-2 rounded-lg border border-border px-3 py-1">
          <span className="shrink-0 text-muted-foreground text-sm">To:</span>
          <Input
            className="flex-1 border-0 px-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search people or emails..."
            value={searchQuery}
          />
          <Button
            disabled={!searchQuery.trim()}
            onClick={handleInvite}
            size="sm"
            type="button"
          >
            Invite
          </Button>
        </div>

        <div>
          <p className="mb-2 px-1 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
            Suggested contacts
          </p>

          <div className="max-h-52 overflow-y-auto">
            {filteredContacts.length === 0 ? (
              <p className="py-4 text-center text-muted-foreground text-sm">
                No contacts found
              </p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {filteredContacts.map((contact) => (
                  <button
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/50"
                    key={contact.id}
                    onClick={() => {
                      setSearchQuery(contact.email ?? contact.name);
                    }}
                    type="button"
                  >
                    <Avatar className="size-9 shrink-0">
                      <AvatarImage alt={contact.name} src={contact.avatar} />
                      <AvatarFallback>
                        {getInitialsFromName(contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm">
                        {contact.name}
                      </p>
                      {contact.email && (
                        <p className="text-muted-foreground text-xs">
                          {contact.email}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-border border-t pt-4">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <Link2Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-muted-foreground text-xs">
              {SHARE_LINK}
            </span>
            <Button
              aria-label={copied ? "Copied" : "Copy invite link"}
              onClick={handleCopy}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              {copied ? (
                <CheckIcon className="size-3.5" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteDialog;
