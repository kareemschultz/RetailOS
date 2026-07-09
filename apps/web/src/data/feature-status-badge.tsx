import { Badge } from "@RetailOS/ui/components/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@RetailOS/ui/components/tooltip";
import { FlaskConical, Wrench } from "lucide-react";
import { type FeatureKey, getFeatureStatus } from "./feature-status";

/**
 * Renders an honest data-provenance marker so the user is never misled about
 * whether a surface is live. "real" surfaces render nothing; "mock" and
 * "partial" surfaces get a quiet, tooltip-explained chip. This satisfies the
 * design-law rule that preview/mocked data must be clearly marked, and keeps
 * the backend team's TODO visible right where the gap is.
 */
export function FeatureStatusBadge({ featureKey }: { featureKey: FeatureKey }) {
  const status = getFeatureStatus(featureKey);
  if (status.source === "real") {
    return null;
  }

  const isPartial = status.source === "partial";
  const label = isPartial ? "Partial data" : "Preview data";
  const Icon = isPartial ? Wrench : FlaskConical;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            className="gap-1 border-amber-500/30 bg-amber-500/10 font-medium text-amber-700 dark:text-amber-400"
            variant="outline"
          />
        }
      >
        <Icon aria-hidden className="size-3" />
        {label}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium">
          {label} — {status.title}
        </p>
        {status.note ? (
          <p className="mt-1 text-muted-foreground text-xs">{status.note}</p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
