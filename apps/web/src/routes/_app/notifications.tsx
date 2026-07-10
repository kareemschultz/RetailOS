import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import {
  PageBody,
  PageHeader,
  PageMetrics,
} from "@RetailOS/ui/components/page-header";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import { StatCard } from "@RetailOS/ui/components/stat-card";
import { StatusChip, type StatusTone } from "@RetailOS/ui/components/status-chip";
import { cn } from "@RetailOS/ui/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Inbox,
  Info,
  Package,
  ShoppingCart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/states";
import { FeatureStatusBadge } from "@/data/feature-status-badge";
import { useFeatureQuery } from "@/data/mock-query";

export const Route = createFileRoute("/_app/notifications")({
  component: NotificationsScreen,
});

type NotificationKind = "alert" | "order" | "stock" | "info";

type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  at: string;
  read: boolean;
};

const KIND_META: Record<
  NotificationKind,
  { icon: LucideIcon; tone: StatusTone; label: string }
> = {
  alert: { icon: AlertTriangle, tone: "error", label: "Alert" },
  order: { icon: ShoppingCart, tone: "info", label: "Order" },
  stock: { icon: Package, tone: "warning", label: "Stock" },
  info: { icon: Info, tone: "neutral", label: "Info" },
};

const MOCK_FEED: NotificationItem[] = [
  {
    id: "n1",
    kind: "stock",
    title: "Low stock: Cola 500ml",
    body: "Main Warehouse is below its reorder point (12 left, reorder at 40).",
    at: "2026-07-10T08:05:00Z",
    read: false,
  },
  {
    id: "n2",
    kind: "order",
    title: "New wholesale order",
    body: "Sunrise Grocery Ltd placed order #SO-2291 for G$1,120,000.",
    at: "2026-07-10T07:40:00Z",
    read: false,
  },
  {
    id: "n3",
    kind: "alert",
    title: "Sync conflict resolved",
    body: "POS terminal #2 reconnected and 3 queued sales synced successfully.",
    at: "2026-07-09T18:22:00Z",
    read: false,
  },
  {
    id: "n4",
    kind: "info",
    title: "End-of-day report ready",
    body: "Yesterday's Z-report is available for review and export.",
    at: "2026-07-09T21:00:00Z",
    read: true,
  },
  {
    id: "n5",
    kind: "stock",
    title: "Expiring soon: Fresh Milk 1L",
    body: "18 units expire within 3 days at Store #2 - Regent St.",
    at: "2026-07-09T09:15:00Z",
    read: true,
  },
];

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hours = Math.round(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.round(hours / 24)}d ago`;
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        "flex items-start gap-3 border-b px-5 py-4 last:border-b-0",
        !item.read && "bg-primary/[0.03]"
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-sm">{item.title}</p>
          {item.read ? null : (
            <span
              aria-label="Unread"
              className="size-2 shrink-0 rounded-full bg-primary"
            />
          )}
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {item.body}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusChip icon={meta.icon} tone={meta.tone}>
          {meta.label}
        </StatusChip>
        <span className="text-muted-foreground text-xs tabular-nums">
          {relativeTime(item.at)}
        </span>
      </div>
    </div>
  );
}

function NotificationsScreen() {
  const { data, isLoading } = useFeatureQuery<NotificationItem[]>({
    feature: "notifications.center",
    queryKey: ["notifications", "center"],
    mock: MOCK_FEED,
  });

  const rows = data ?? [];
  const unread = rows.filter((r) => !r.read).length;
  const alerts = rows.filter((r) => r.kind === "alert").length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        actions={
          <Button variant="outline">
            <CheckCheck className="size-4" />
            Mark all read
          </Button>
        }
        description="Alerts, orders, and stock signals from across your business."
        title={
          <span className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bell className="size-5" />
            </span>
            Notifications
            <FeatureStatusBadge featureKey="notifications.center" />
          </span>
        }
      />

      <PageMetrics className="sm:grid-cols-3 xl:grid-cols-3">
        <StatCard hint="Awaiting review" icon={Inbox} label="Unread" value={String(unread)} />
        <StatCard hint="Need attention" icon={AlertTriangle} label="Alerts" value={String(alerts)} />
        <StatCard hint="All notifications" icon={Bell} label="Total" value={String(rows.length)} />
      </PageMetrics>

      <PageBody>
        <Card className="overflow-hidden p-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col gap-px">
                {["a", "b", "c", "d"].map((k) => (
                  <Skeleton className="h-[76px] rounded-none" key={k} />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <EmptyState
                description="You're all caught up. New alerts will appear here."
                icon={Inbox}
                title="No notifications"
              />
            ) : (
              rows.map((item) => <NotificationRow item={item} key={item.id} />)
            )}
          </CardContent>
        </Card>
      </PageBody>
    </div>
  );
}
