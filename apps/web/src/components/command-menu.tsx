import { Button } from "@RetailOS/ui/components/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@RetailOS/ui/components/command";
import { Kbd } from "@RetailOS/ui/components/kbd";
import { useQuery } from "@tanstack/react-query";
import { type LinkProps, useNavigate } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { filterNavGroups, navGroups } from "@/configs/nav-config";
import { orpc } from "@/utils/orpc";

// Command palette — dropped in from the AdminCN template CommandMenu (Assembly
// Law: the ⌘K / "/" trigger, dialog, cmdk filtering, polish), edited for our
// stack: next/navigation useRouter → TanStack useNavigate, and AdminCN's demo
// search data → RetailOS nav routes (derived from nav-config, single source).

interface CommandEntry {
  group: string;
  label: string;
  to: LinkProps["to"];
}

function buildEntriesByGroup(groups: typeof navGroups) {
  const entries: CommandEntry[] = groups.flatMap((group) =>
    group.items.flatMap((item) =>
      item.childItems
        ? item.childItems.map((leaf) => ({
            group: group.groupLabel,
            label: `${item.label}: ${leaf.label}`,
            to: leaf.to,
          }))
        : [{ group: group.groupLabel, label: item.label, to: item.to }]
    )
  );
  return groups.map((group) => ({
    group: group.groupLabel,
    entries: entries.filter((e) => e.group === group.groupLabel),
  }));
}

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  // Role-filtered nav (UX only; backend assertPermission is the real gate).
  const access = useQuery(orpc.membership.myAccess.queryOptions({ input: {} }));
  const entriesByGroup = useMemo(
    () =>
      buildEntriesByGroup(
        filterNavGroups(navGroups, access.data?.permissions ?? [])
      ),
    [access.data?.permissions]
  );

  const run = useCallback(
    (to: LinkProps["to"]) => {
      setOpen(false);
      navigate({ to });
    },
    [navigate]
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target;
      const typingInField =
        (target instanceof HTMLElement && target.isContentEditable) ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;
      if (typingInField) {
        return;
      }
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <Button
        className="hidden px-2.5 font-normal hover:bg-transparent sm:block dark:hover:bg-transparent"
        onClick={() => setOpen(true)}
        variant="ghost"
      >
        <span className="hidden items-center gap-1.5 text-muted-foreground text-sm sm:flex">
          <SearchIcon className="size-4" />
          <span>Search…</span>
          <Kbd>⌘K</Kbd>
        </span>
      </Button>
      <Button
        className="sm:hidden"
        onClick={() => setOpen(true)}
        size="icon"
        variant="ghost"
      >
        <SearchIcon />
        <span className="sr-only">Search</span>
      </Button>
      <CommandDialog onOpenChange={setOpen} open={open}>
        <Command>
          <CommandInput placeholder="Type a command or search…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {entriesByGroup.map((g) => (
              <CommandGroup heading={g.group} key={g.group}>
                {g.entries.map((entry) => (
                  <CommandItem
                    key={entry.label}
                    onSelect={() => run(entry.to)}
                    value={`${entry.group} ${entry.label}`}
                  >
                    <span>{entry.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
