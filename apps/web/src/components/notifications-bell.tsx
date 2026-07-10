import { Bell, Check } from "lucide-react";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@RetailOS/ui/components/popover";
import { ScrollArea } from "@RetailOS/ui/components/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@RetailOS/ui/components/tooltip";
import { cn } from "@RetailOS/ui/lib/utils";

import { useFeatureQuery } from "@/data/mock-query";

type AppNotification = {
  id: string;
  title: string;
  body: string;
  kind: "info" | "success" | "warning" | "error";
  read: boolean;
  at: string;
};

// Preview notifications — the notifications backend (§22) is not built yet, so
// this renders from the typed mock layer behind the same hook shape a real feed
// would use. Marked in the UI via the feature-status system, never faked silently.
const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    title: "Low stock: Coca-Cola 350ml",
    body: "On-hand fell below reorder point (12 of 40) at Main Store.",
    kind: "warning",
    read: false,
    at: "10m ago",
  },
  {
    id: "n2",
    title: "PO-1042 received",
    body: "Goods receipt posted for Demerara Distributors.",
    kind: "success",
    read: false,
    at: "1h ago",
  },
  {
    id: "n3",
    title: "Shift closed",
    body: "Register 2 blind close recorded a G$0 variance.",
    kind: "info",
    read: true,
    at: "3h ago",
  },
];

const DOT_TONE: Record<AppNotification["kind"], string> = {
  info: "bg-sky-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-destructive",
};

export function NotificationsBell() {
  const { data } = useFeatureQuery<AppNotification[]>({
    feature: "notifications.center",
    queryKey: ["notifications", "feed"],
    mock: MOCK_NOTIFICATIONS,
  });
  const items = data ?? [];
  const unread = items.filter((n) => !n.read).length;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
                  className="relative"
                  size="icon"
                  variant="ghost"
                />
              }
            >
              <Bell className="size-5" />
              {unread > 0 ? (
                <span className="-right-0.5 -top-0.5 absolute flex size-4 items-center justify-center rounded-full bg-destructive font-medium text-[10px] text-destructive-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </PopoverTrigger>
          }
        />
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold text-sm">Notifications</p>
          {unread > 0 ? (
            <Badge variant="secondary">{unread} new</Badge>
          ) : null}
        </div>
        <ScrollArea className="h-80">
          {items.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-1 px-4 text-center">
              <Check className="size-6 text-muted-foreground" />
              <p className="font-medium text-sm">You're all caught up</p>
              <p className="text-muted-foreground text-xs">
                Alerts about stock, orders, and shifts will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li
                  className={cn(
                    "flex gap-3 px-4 py-3",
                    n.read ? "opacity-70" : "bg-accent/40"
                  )}
                  key={n.id}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      DOT_TONE[n.kind]
                    )}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sm">{n.title}</p>
                    <p className="text-muted-foreground text-xs">{n.body}</p>
                    <p className="mt-1 text-muted-foreground text-xs">{n.at}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
