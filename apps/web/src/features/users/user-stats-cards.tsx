// React Imports

// Component Imports
import { Card, CardContent } from "@RetailOS/ui/components/card";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
// Third-party Imports
import {
  UserCheckIcon,
  UserCogIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import type { ReactNode } from "react";

const STAT_CHANGE_BADGES = {
  totalUsers: 29,
  paidUsers: 18,
  activeUsers: -14,
  pendingUsers: 42,
} as const;

interface UserStats {
  activeUsers: number;
  paidUsers: number;
  pendingUsers: number;
  totalUsers: number;
}

export interface UserStatsCardsProps {
  stats: UserStats;
}

interface StatCardConfig {
  change: number;
  icon: ReactNode;
  iconClassName: string;
  subtitle: string;
  title: string;
  value: number;
}

const formatStatValue = (value: number): string =>
  value.toLocaleString("en-US");

const formatChange = (change: number): string =>
  `${change >= 0 ? "+" : ""}${change}%`;

export function UserStatsCards({ stats }: UserStatsCardsProps) {
  const cards: StatCardConfig[] = [
    {
      title: "Session",
      value: stats.totalUsers,
      change: STAT_CHANGE_BADGES.totalUsers,
      subtitle: "Total Users",
      icon: <UsersIcon className="size-4" />,
      iconClassName: "bg-primary/10 text-primary",
    },
    {
      title: "Paid Users",
      value: stats.paidUsers,
      change: STAT_CHANGE_BADGES.paidUsers,
      subtitle: "Last week analytics",
      icon: <UserPlusIcon className="size-4" />,
      iconClassName: "bg-destructive/10 text-destructive",
    },
    {
      title: "Active Users",
      value: stats.activeUsers,
      change: STAT_CHANGE_BADGES.activeUsers,
      subtitle: "Last week analytics",
      icon: <UserCheckIcon className="size-4" />,
      iconClassName: "bg-green-500/10 text-green-600 dark:text-green-400",
    },
    {
      title: "Pending Users",
      value: stats.pendingUsers,
      change: STAT_CHANGE_BADGES.pendingUsers,
      subtitle: "Last week analytics",
      icon: <UserCogIcon className="size-4" />,
      iconClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-6 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="flex flex-row items-start justify-between">
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm">
                {card.title}
              </p>
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-2xl">
                  {formatStatValue(card.value)}
                </h4>
                <p
                  className={cn(
                    "font-medium text-sm",
                    card.change >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-destructive"
                  )}
                >
                  ({formatChange(card.change)})
                </p>
              </div>
              <p className="text-muted-foreground text-xs">{card.subtitle}</p>
            </div>
            <div
              className={cn(
                "flex size-9.5 items-center justify-center rounded-md",
                card.iconClassName
              )}
            >
              {card.icon}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
