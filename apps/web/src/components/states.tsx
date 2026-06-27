import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@RetailOS/ui/components/alert";
import { Button } from "@RetailOS/ui/components/button";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import { cn } from "@RetailOS/ui/lib/utils";
import { AlertCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// Shared, reusable async-state patterns so every panel (location, search, quote,
// receipt) renders loading/error/empty identically. Built on owned shadcn
// primitives (Skeleton, Alert) — not bespoke markup.

export function LoadingRows({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: rows }, (_, i) => i).map((i) => (
        <Skeleton className="h-10 w-full" key={i} />
      ))}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>
        <span>{message}</span>
        {onRetry ? (
          <Button
            className="mt-2 w-fit"
            onClick={onRetry}
            size="sm"
            variant="outline"
          >
            Try again
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

// Empty state. shadcn core ships no Empty primitive in this project, so this is
// the owned, reused pattern (icon + title + helper text + optional action) the
// design language asks for on every cleared/empty surface.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <p className="font-medium text-sm">{title}</p>
      {description ? (
        <p className="max-w-xs text-muted-foreground text-sm">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
