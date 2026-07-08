import { cn } from "@RetailOS/ui/lib/utils";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock,
  FileText,
  type LucideIcon,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";

// RetailOS semantic status chip. The design language is explicit: status is
// ALWAYS a chip (never raw text like "ACTIVE"), ALWAYS icon + text (never
// color-only — colorblind users and glare-washed POS screens need redundancy).
// Tones map to the fixed semantic palette: success green, warning amber, error
// red, neutral gray, info/draft blue-gray, plus the accent-driven "active".
export type StatusTone =
  | "success"
  | "warning"
  | "error"
  | "neutral"
  | "info"
  | "accent";

const TONE_STYLES: Record<StatusTone, string> = {
  // Semantic colors are intentionally literal (not brand tokens): success/
  // warning/error must stay green/amber/red even when a tenant re-skins the
  // blue accent, so a failed sync never turns "brand blue".
  success:
    "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25",
  warning:
    "bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-amber-500/25",
  error: "bg-red-500/12 text-red-700 dark:text-red-300 ring-red-500/25",
  neutral: "bg-muted text-muted-foreground ring-border",
  info: "bg-sky-500/12 text-sky-700 dark:text-sky-300 ring-sky-500/25",
  accent: "bg-primary/12 text-primary ring-primary/25",
};

const DEFAULT_ICON: Record<StatusTone, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  neutral: CircleDashed,
  info: CircleDot,
  accent: CircleDot,
};

interface StatusChipProps {
  children: ReactNode;
  className?: string;
  icon?: LucideIcon;
  tone?: StatusTone;
}

export function StatusChip({
  children,
  tone = "neutral",
  icon,
  className,
}: StatusChipProps) {
  const Icon = icon ?? DEFAULT_ICON[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium text-xs ring-1 ring-inset",
        TONE_STYLES[tone],
        className
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

// Convenience map for the common domain statuses used across modules, so pages
// don't each re-derive tone+icon+label. Callers can still use <StatusChip> raw.
const STATUS_PRESETS: Record<
  string,
  { icon: LucideIcon; label: string; tone: StatusTone }
> = {
  active: { tone: "success", icon: CheckCircle2, label: "Active" },
  inactive: { tone: "neutral", icon: CircleDashed, label: "Inactive" },
  pending: { tone: "warning", icon: Clock, label: "Pending" },
  processing: { tone: "info", icon: CircleDot, label: "Processing" },
  failed: { tone: "error", icon: XCircle, label: "Failed" },
  cancelled: { tone: "neutral", icon: Ban, label: "Cancelled" },
  draft: { tone: "info", icon: FileText, label: "Draft" },
  paid: { tone: "success", icon: CheckCircle2, label: "Paid" },
  unpaid: { tone: "warning", icon: Clock, label: "Unpaid" },
  overdue: { tone: "error", icon: AlertTriangle, label: "Overdue" },
  completed: { tone: "success", icon: CheckCircle2, label: "Completed" },
  low: { tone: "warning", icon: AlertTriangle, label: "Low stock" },
  out: { tone: "error", icon: XCircle, label: "Out of stock" },
  in: { tone: "success", icon: CheckCircle2, label: "In stock" },
};

// Look up a domain status string → themed chip. Falls back to a neutral chip
// with the raw (title-cased) value so an unknown backend status still renders
// as a chip, never as bare text.
export function DomainStatusChip({
  status,
  className,
}: {
  className?: string;
  status: string;
}) {
  const key = status.toLowerCase();
  const preset = STATUS_PRESETS[key];
  if (preset) {
    return (
      <StatusChip className={className} icon={preset.icon} tone={preset.tone}>
        {preset.label}
      </StatusChip>
    );
  }
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <StatusChip className={className} tone="neutral">
      {label}
    </StatusChip>
  );
}
