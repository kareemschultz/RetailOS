// Third-party imports

import { Button } from "@RetailOS/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@RetailOS/ui/components/input-group";
import { Label } from "@RetailOS/ui/components/label";
import { ScrollArea } from "@RetailOS/ui/components/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@RetailOS/ui/components/sheet";
import { cn } from "@RetailOS/ui/lib/utils";
import {
  ArrowDownAZIcon,
  ArrowDownZAIcon,
  FunnelIcon,
  LayoutGridIcon,
  ListIcon,
  MenuIcon,
  SearchIcon,
} from "lucide-react";
// React imports
import { useMemo, useState } from "react";

// Store imports
import { useContactStore } from "@/features/contacts/store";
// Utils imports
import {
  type ContactFilter,
  getVisibleContacts,
  groupContactsByLetter,
  sortContacts,
} from "@/features/contacts/utils";
import GridView from "./grid-view";
import LeftPanel from "./left-panel";
import ListView from "./list-view";

const MidPanel = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [isNavSheetOpen, setIsNavSheetOpen] = useState(false);
  const contacts = useContactStore((state) => state.contacts);
  const activeNav = useContactStore((state) => state.activeNav);
  const activeLabel = useContactStore((state) => state.activeLabel);
  const statusFilter = useContactStore((state) => state.statusFilter);
  const view = useContactStore((state) => state.view);
  const setStatusFilter = useContactStore((state) => state.setStatusFilter);
  const setView = useContactStore((state) => state.setView);

  const visibleContacts = useMemo(
    () =>
      getVisibleContacts(
        contacts,
        activeNav,
        activeLabel,
        statusFilter,
        searchQuery
      ),
    [contacts, activeNav, activeLabel, statusFilter, searchQuery]
  );

  const sortedContacts = useMemo(
    () => sortContacts(visibleContacts, sortOrder),
    [visibleContacts, sortOrder]
  );

  const groupedContacts = useMemo(
    () => groupContactsByLetter(visibleContacts, sortOrder),
    [visibleContacts, sortOrder]
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 py-4">
      <div className="flex items-center gap-2 px-4">
        <Sheet onOpenChange={setIsNavSheetOpen} open={isNavSheetOpen}>
          <SheetTrigger
            render={
              <Button
                aria-label="Open navigation"
                className="shrink-0 rounded-full md:hidden"
                size="icon"
                variant="outline"
              />
            }
          >
            <MenuIcon className="size-4" />
          </SheetTrigger>
          <SheetContent className="max-w-80! gap-0 p-0" side="left">
            <LeftPanel onNavigate={() => setIsNavSheetOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex-1 shrink-0 space-y-2">
          <Label className="sr-only" htmlFor="searchContact">
            Search contacts
          </Label>
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              id="searchContact"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search Contact"
              value={searchQuery}
            />
          </InputGroup>
        </div>

        <Button
          className="shrink-0 rounded-full"
          onClick={() =>
            setSortOrder((current) => (current === "asc" ? "desc" : "asc"))
          }
          size="icon"
          title={sortOrder === "asc" ? "Sorted A-Z" : "Sorted Z-A"}
          variant="outline"
        >
          {sortOrder === "asc" ? (
            <ArrowDownAZIcon className="size-4" />
          ) : (
            <ArrowDownZAIcon className="size-4" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                className="shrink-0 rounded-full"
                size="icon"
                title={`Filter: ${statusFilter === "all" ? "All statuses" : statusFilter}`}
                variant="outline"
              />
            }
          >
            <FunnelIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              onValueChange={(value) => setStatusFilter(value as ContactFilter)}
              value={statusFilter ?? "all"}
            >
              <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="active">
                Active
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="inactive">
                Inactive
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="prospect">
                Prospect
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          className="hidden shrink-0 rounded-full sm:inline-flex"
          onClick={() => setView(view === "grid" ? "list" : "grid")}
          size="icon"
          variant="outline"
        >
          {view === "grid" ? <LayoutGridIcon /> : <ListIcon />}
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-4">
        {view === "grid" && <GridView contacts={sortedContacts} />}
        {(view === "list" || view === "grid") && (
          <ListView
            className={cn(view === "grid" && "sm:hidden")}
            groupedContacts={groupedContacts}
          />
        )}
      </ScrollArea>
    </div>
  );
};

export default MidPanel;
