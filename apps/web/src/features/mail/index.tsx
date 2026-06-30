// React Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@RetailOS/ui/components/input-group";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@RetailOS/ui/components/resizable";
import { Separator } from "@RetailOS/ui/components/separator";
import { Sheet, SheetContent } from "@RetailOS/ui/components/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@RetailOS/ui/components/tabs";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
// Third-party Imports
import {
  ArrowDownUpIcon,
  ChevronLeftIcon,
  MailIcon,
  MenuIcon,
  SearchIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

// Config Imports
import {
  MAIL_COMPOSE_SESSION,
  MAIL_LABEL_NAV_ITEMS,
  MAIL_STATUS_NAV_ITEMS,
} from "@/features/mail/mail-config";
// Type Imports
import type { Email } from "@/features/mail/types";
// Hook Imports
import { useMailApp } from "@/features/mail/use-mail-app";
import MailCompose from "./mail-compose";
import MailDisplay from "./mail-display";
import MailList from "./mail-list";
import MailNav from "./mail-nav";

const MailApp = () => {
  // States
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  // Hooks
  const {
    activeStatus,
    activeLabel,
    activeNavType,
    filterTab,
    searchQuery,
    isComposeOpen,
    statusCounts,
    labelCounts,
    visibleEmails,
    selectedEmail,
    unreadCount,
    setFilterTab,
    setSortOrder,
    setSearchQuery,
    setIsComposeOpen,
    handleStatusChange,
    handleLabelChange,
    handleEmailSelect,
    handleToggleStar,
    handleMarkRead,
    handleArchive,
    handleMoveToTrash,
    handleMoveToSpam,
    handleMarkNotSpam,
    handleRestoreToInbox,
    handlePermanentDelete,
    handleSendDraft,
    handleToggleLabel,
    handleSendReply,
    handleComposeSend,
    handleComposeSaveDraft,
  } = useMailApp();

  const statusNavItems = useMemo(
    () =>
      MAIL_STATUS_NAV_ITEMS.map((statusItem) => ({
        ...statusItem,
        count: statusCounts[statusItem.id],
      })),
    [statusCounts]
  );

  const labelNavItems = useMemo(
    () =>
      MAIL_LABEL_NAV_ITEMS.map((labelItem) => ({
        ...labelItem,
        count: labelCounts[labelItem.id],
      })),
    [labelCounts]
  );

  const activeViewLabel = useMemo(() => {
    if (activeNavType === "label" && activeLabel) {
      return (
        MAIL_LABEL_NAV_ITEMS.find((labelItem) => labelItem.id === activeLabel)
          ?.label ?? "Inbox"
      );
    }

    return (
      statusNavItems.find((statusItem) => statusItem.id === activeStatus)
        ?.label ?? "Inbox"
    );
  }, [activeLabel, activeNavType, activeStatus, statusNavItems]);

  // Vars
  const mailDisplayProps = {
    email: selectedEmail,
    onToggleStar: handleToggleStar,
    onMarkRead: handleMarkRead,
    onArchive: handleArchive,
    onMoveToTrash: handleMoveToTrash,
    onMoveToSpam: handleMoveToSpam,
    onMarkNotSpam: handleMarkNotSpam,
    onRestoreToInbox: handleRestoreToInbox,
    onPermanentDelete: handlePermanentDelete,
    onSendDraft: handleSendDraft,
    onToggleLabel: handleToggleLabel,
    onSendReply: handleSendReply,
  };

  const handleEmailSelectWithMobile = (email: Email) => {
    handleEmailSelect(email);
    setMobileView("detail");
  };

  return (
    <>
      <div className="flex h-[calc(100dvh-12rem)] flex-col lg:h-[calc(100dvh-11rem)] lg:min-h-130">
        {/* Desktop layout */}
        <div className="hidden h-full lg:flex">
          <ResizablePanelGroup
            className="h-full items-stretch overflow-hidden rounded-lg border border-border bg-background"
            orientation="horizontal"
          >
            <ResizablePanel
              className="flex flex-col bg-card"
              defaultSize="15%"
              minSize="14%"
            >
              <div className="p-3">
                <Button
                  className="w-full"
                  onClick={() => setIsComposeOpen(true)}
                >
                  <MailIcon className="mr-2 size-4" />
                  Compose
                </Button>
              </div>
              <Separator />
              <MailNav
                activeLabel={activeLabel}
                activeNavType={activeNavType}
                activeStatus={activeStatus}
                labelNavItems={labelNavItems}
                onLabelChange={handleLabelChange}
                onStatusChange={handleStatusChange}
                statusNavItems={statusNavItems}
              />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel
              className="overflow-hidden! flex min-h-0 flex-col bg-background"
              defaultSize="30%"
              minSize="24%"
            >
              <Tabs
                className="flex min-h-0 flex-1 flex-col gap-3"
                onValueChange={(value) =>
                  setFilterTab(value as typeof filterTab)
                }
                value={filterTab}
              >
                <div className="flex items-center gap-3 p-3 pb-0">
                  <h1 className="font-bold text-xl">{activeViewLabel}</h1>
                  <TabsList className="ml-auto bg-muted/60">
                    <TabsTrigger className="font-normal" value="all">
                      All
                    </TabsTrigger>
                    <TabsTrigger className="font-normal" value="unread">
                      Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
                    </TabsTrigger>
                  </TabsList>
                </div>
                <Separator />
                <div className="flex items-center gap-2 px-3">
                  <InputGroup className="relative flex-1">
                    <InputGroupAddon>
                      <SearchIcon className="size-4" />
                      <span className="sr-only">Search</span>
                    </InputGroupAddon>
                    <InputGroupInput
                      className="[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none"
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search messages"
                      type="search"
                      value={searchQuery}
                    />
                  </InputGroup>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          className="shrink-0"
                          size="icon"
                          variant="outline"
                        />
                      }
                    >
                      <ArrowDownUpIcon className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSortOrder("default")}>
                        Default order
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortOrder("newest")}>
                        Newest first
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortOrder("oldest")}>
                        Oldest first
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <TabsContent
                  className="m-0 flex min-h-0 flex-1 flex-col"
                  value="all"
                >
                  <MailList
                    emails={visibleEmails}
                    onEmailSelect={handleEmailSelectWithMobile}
                    selectedEmailId={selectedEmail?.id ?? null}
                  />
                </TabsContent>
                <TabsContent
                  className="m-0 flex min-h-0 flex-1 flex-col"
                  value="unread"
                >
                  <MailList
                    emails={visibleEmails}
                    onEmailSelect={handleEmailSelectWithMobile}
                    selectedEmailId={selectedEmail?.id ?? null}
                  />
                </TabsContent>
              </Tabs>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel
              className="flex min-h-0 flex-col bg-background"
              defaultSize="55%"
              minSize="32%"
            >
              <MailDisplay {...mailDisplayProps} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Mobile layout */}
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border lg:hidden">
          {mobileView === "list" && (
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-2 border-border border-b px-3 py-2">
                <button
                  className="rounded-md p-1.5 hover:bg-muted"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  type="button"
                >
                  <MenuIcon className="size-5" />
                </button>
                <h1 className="flex-1 font-semibold text-lg">
                  {activeViewLabel}
                </h1>
                <div className="flex gap-1 rounded-md bg-muted/60 p-1">
                  <button
                    className={cn(
                      "rounded-md px-3 py-1 font-medium text-sm transition-colors",
                      filterTab === "all"
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                    onClick={() => setFilterTab("all")}
                    type="button"
                  >
                    All
                  </button>
                  <button
                    className={cn(
                      "rounded-md px-3 py-1 font-medium text-sm transition-colors",
                      filterTab === "unread"
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                    onClick={() => setFilterTab("unread")}
                    type="button"
                  >
                    Unread {unreadCount > 0 ? `(${unreadCount})` : ""}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 p-3">
                <InputGroup className="relative flex-1">
                  <InputGroupAddon>
                    <SearchIcon className="size-4" />
                    <span className="sr-only">Search</span>
                  </InputGroupAddon>
                  <InputGroupInput
                    className="[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none"
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search messages"
                    type="search"
                    value={searchQuery}
                  />
                </InputGroup>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        className="shrink-0"
                        size="icon"
                        variant="outline"
                      />
                    }
                  >
                    <ArrowDownUpIcon className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSortOrder("default")}>
                      Default order
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOrder("newest")}>
                      Newest first
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOrder("oldest")}>
                      Oldest first
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <MailList
                emails={visibleEmails}
                onEmailSelect={handleEmailSelectWithMobile}
                selectedEmailId={selectedEmail?.id ?? null}
              />
            </div>
          )}

          {mobileView === "detail" && (
            <div className="relative flex h-full flex-col">
              <Button
                className="absolute top-1.5 left-2 p-0 md:hidden"
                onClick={() => setMobileView("list")}
                size="sm"
                type="button"
                variant="ghost"
              >
                <ChevronLeftIcon className="size-4" />
                {activeViewLabel}
              </Button>
              <MailDisplay {...mailDisplayProps} />
            </div>
          )}
        </div>
      </div>

      <Sheet onOpenChange={setIsMobileSidebarOpen} open={isMobileSidebarOpen}>
        <SheetContent showCloseButton={false} side="left">
          <div className="border-border border-b p-3">
            <Button
              className="w-full"
              onClick={() => {
                setIsComposeOpen(true);
                setIsMobileSidebarOpen(false);
              }}
            >
              <MailIcon />
              Compose
            </Button>
          </div>
          <MailNav
            activeLabel={activeLabel}
            activeNavType={activeNavType}
            activeStatus={activeStatus}
            labelNavItems={labelNavItems}
            onLabelChange={(label) => {
              handleLabelChange(label);
              setIsMobileSidebarOpen(false);
              setMobileView("list");
            }}
            onStatusChange={(status) => {
              handleStatusChange(status);
              setIsMobileSidebarOpen(false);
              setMobileView("list");
            }}
            statusNavItems={statusNavItems}
          />
        </SheetContent>
      </Sheet>

      <MailCompose
        key={
          isComposeOpen
            ? MAIL_COMPOSE_SESSION.OPEN
            : MAIL_COMPOSE_SESSION.CLOSED
        }
        onOpenChange={setIsComposeOpen}
        onSaveDraft={handleComposeSaveDraft}
        onSend={handleComposeSend}
        open={isComposeOpen}
      />
    </>
  );
};

export default MailApp;
