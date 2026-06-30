// React imports

import { Button } from "@RetailOS/ui/components/button";
import { ScrollArea } from "@RetailOS/ui/components/scroll-area";
import { Separator } from "@RetailOS/ui/components/separator";
import { cn } from "@RetailOS/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
// Third-party imports
import {
  BanIcon,
  CircleUserIcon,
  ContactIcon,
  PlusIcon,
  ShieldAlertIcon,
  StarIcon,
} from "lucide-react";
import { useMemo } from "react";

// Store imports
import { useContactStore } from "@/features/contacts/store";
// Type imports
import type { ContactNavItem, Label } from "@/features/contacts/types";
import {
  CONTACT_LABEL_STYLES,
  CONTACT_LABELS,
} from "@/features/contacts/types";

const navItems: { id: ContactNavItem; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "All Contacts", icon: CircleUserIcon },
  { id: "favourites", label: "Favourites", icon: StarIcon },
  { id: "spam", label: "Spam", icon: ShieldAlertIcon },
  { id: "blocked", label: "Blocked", icon: BanIcon },
];

function isVisibleContact(contact: { isBlocked: boolean; isSpam: boolean }) {
  return !(contact.isBlocked || contact.isSpam);
}

interface LeftPanelProps {
  onNavigate?: () => void;
}

const LeftPanel = ({ onNavigate }: LeftPanelProps) => {
  const contacts = useContactStore((state) => state.contacts);
  const activeNav = useContactStore((state) => state.activeNav);
  const activeLabel = useContactStore((state) => state.activeLabel);
  const setActiveNav = useContactStore((state) => state.setActiveNav);
  const setActiveLabel = useContactStore((state) => state.setActiveLabel);
  const openCreateContact = useContactStore((state) => state.openCreateContact);

  const counts = useMemo(
    () => ({
      all: contacts.filter((contact) => !(contact.isBlocked || contact.isSpam))
        .length,
      favourites: contacts.filter(
        (contact) =>
          contact.isFavourite && !(contact.isBlocked || contact.isSpam)
      ).length,
      spam: contacts.filter((contact) => contact.isSpam).length,
      blocked: contacts.filter((contact) => contact.isBlocked).length,
    }),
    [contacts]
  );

  const labelCounts = useMemo(() => {
    const result = Object.fromEntries(
      CONTACT_LABELS.map((label) => [label, 0])
    ) as Record<Label, number>;

    for (const contact of contacts) {
      if (!isVisibleContact(contact)) {
        continue;
      }

      for (const label of contact.labels) {
        result[label] += 1;
      }
    }

    return result;
  }, [contacts]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 py-4">
      <div className="flex shrink-0 flex-col gap-4 px-4">
        <div className="flex items-center gap-2">
          <ContactIcon className="size-6" />
          <h1 className="font-semibold text-xl">Contacts</h1>
        </div>
        <Button
          onClick={() => {
            openCreateContact();
            onNavigate?.();
          }}
        >
          <PlusIcon />
          New Contact
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-4">
        <div className="flex flex-col gap-4">
          <nav className="grid gap-1">
            {navItems.map((navItem) => {
              const NavIcon = navItem.icon;
              const isActive = activeNav === navItem.id && !activeLabel;
              const count = counts[navItem.id];

              return (
                <Button
                  className={cn(
                    "justify-start gap-2.5 px-3",
                    isActive
                      ? "bg-accent font-semibold text-accent-foreground hover:bg-accent hover:text-accent-foreground"
                      : "text-foreground/80 hover:bg-muted/60"
                  )}
                  key={navItem.id}
                  onClick={() => {
                    setActiveNav(navItem.id);
                    onNavigate?.();
                  }}
                  variant="ghost"
                >
                  <NavIcon className="size-4 shrink-0 opacity-70" />
                  {navItem.label}
                  <span className="ml-auto text-muted-foreground text-xs tabular-nums">
                    {count}
                  </span>
                </Button>
              );
            })}
          </nav>

          <Separator />

          <div className="flex flex-col gap-2">
            <p className="font-medium text-[11px] text-muted-foreground uppercase">
              Labels
            </p>
            <nav className="grid gap-1">
              {CONTACT_LABELS.map((label) => {
                const isActive = activeLabel === label;
                const count = labelCounts[label];

                return (
                  <Button
                    className={cn(
                      "justify-start gap-2.5 px-3 capitalize",
                      isActive
                        ? "bg-accent font-semibold text-accent-foreground hover:bg-accent hover:text-accent-foreground"
                        : "text-foreground/80 hover:bg-muted/60"
                    )}
                    key={label}
                    onClick={() => {
                      setActiveLabel(label);
                      onNavigate?.();
                    }}
                    variant="ghost"
                  >
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        CONTACT_LABEL_STYLES[label]
                      )}
                    />
                    {label}
                    {count > 0 && (
                      <span className="ml-auto text-muted-foreground text-xs tabular-nums">
                        {count}
                      </span>
                    )}
                  </Button>
                );
              })}
            </nav>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default LeftPanel;
