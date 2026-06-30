import { cn } from "@RetailOS/ui/lib/utils";

import { cva, type VariantProps } from "class-variance-authority";

import { CheckIcon, CircleIcon, XIcon } from "lucide-react";
import type * as React from "react";

const timelineVariants = cva("grid", {
  variants: {
    positions: {
      left: "[&>li]:grid-cols-[0_min-content_1fr]",
      right: "[&>li]:grid-cols-[1fr_min-content]",
      center: "[&>li]:grid-cols-[1fr_min-content_1fr]",
    },
  },
  defaultVariants: {
    positions: "left",
  },
});

interface TimelineProps
  extends React.HTMLAttributes<HTMLUListElement>,
    VariantProps<typeof timelineVariants> {}

const Timeline = ({
  children,
  className,
  positions,
  ref,
  ...props
}: TimelineProps & { ref?: React.RefObject<HTMLUListElement | null> }) => (
  <ul
    className={cn(timelineVariants({ positions }), className)}
    ref={ref}
    {...props}
  >
    {children}
  </ul>
);

Timeline.displayName = "Timeline";

const timelineItemVariants = cva("grid items-center gap-x-2", {
  variants: {
    status: {
      done: "text-primary",
      default: "text-muted-foreground",
    },
  },
  defaultVariants: {
    status: "default",
  },
});

interface TimelineItemProps
  extends React.HTMLAttributes<HTMLLIElement>,
    VariantProps<typeof timelineItemVariants> {}

const TimelineItem = ({
  className,
  status,
  ref,
  ...props
}: TimelineItemProps & { ref?: React.RefObject<HTMLLIElement | null> }) => (
  <li
    className={cn(timelineItemVariants({ status }), className)}
    ref={ref}
    {...props}
  />
);

TimelineItem.displayName = "TimelineItem";

const timelineDotVariants = cva(
  "col-start-2 col-end-3 row-start-1 row-end-1 flex items-center justify-center rounded-full border border-current",
  {
    variants: {
      status: {
        default: "size-4 [&>*]:hidden",
        current:
          "size-4 [&>*:not(.timeline-icon-circle)]:hidden [&>.timeline-icon-circle>svg]:fill-current [&>.timeline-icon-circle>svg]:text-current",
        done: "size-4 bg-primary [&>*:not(.timeline-icon-check)]:hidden [&>.timeline-icon-check>svg]:text-background",
        error:
          "size-4 border-destructive bg-destructive [&>*:not(.timeline-icon-x)]:hidden [&>.timeline-icon-x>svg]:text-background",
        custom:
          "border-none [&>*:not(:nth-child(4))]:hidden [&>*:nth-child(4)]:block",
      },
    },
    defaultVariants: {
      status: "default",
    },
  }
);

type TimelineDotProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof timelineDotVariants> &
  (
    | {
        status?: "custom";
        children: React.ReactNode;
      }
    | {
        status?: Exclude<
          VariantProps<typeof timelineDotVariants>["status"],
          "custom"
        >;
        children?: never;
      }
  );

const TimelineDot = ({
  className,
  status,
  children,
  ref,
  ...props
}: TimelineDotProps & { ref?: React.RefObject<HTMLDivElement | null> }) => (
  <div
    className={cn("timeline-dot", timelineDotVariants({ status }), className)}
    ref={ref}
    role="status"
    {...props}
  >
    <span className="timeline-icon-circle flex items-center justify-center">
      <CircleIcon className="size-2.5" />
    </span>
    <span className="timeline-icon-check flex items-center justify-center">
      <CheckIcon className="size-3" />
    </span>
    <span className="timeline-icon-x flex items-center justify-center">
      <XIcon className="size-3" />
    </span>
    {children}
  </div>
);

TimelineDot.displayName = "TimelineDot";

const timelineTagVariants = cva("row-start-1 row-end-1 flex items-center", {
  variants: {
    side: {
      left: "col-start-1 col-end-2 justify-end whitespace-nowrap",
      right: "col-start-3 col-end-4 justify-start",
    },
  },
  defaultVariants: {
    side: "left",
  },
});

interface TimelineTagProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof timelineTagVariants> {}

const TimelineTag = ({
  className,
  side,
  children,
  ref,
  ...props
}: TimelineTagProps & { ref?: React.RefObject<HTMLDivElement | null> }) => (
  <div
    className={cn(timelineTagVariants({ side }), className)}
    ref={ref}
    {...props}
  >
    {children}
  </div>
);

TimelineTag.displayName = "TimelineTag";

const timelineContentVariants = cva(
  "row-start-2 row-end-2 pb-8 text-card-foreground",
  {
    variants: {
      side: {
        right: "col-start-3 col-end-4 mr-auto text-left",
        left: "col-start-1 col-end-2 ml-auto text-right",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
);

interface TimelineContentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof timelineContentVariants> {}

const TimelineContent = ({
  className,
  side,
  ref,
  ...props
}: TimelineContentProps & { ref?: React.RefObject<HTMLDivElement | null> }) => (
  <div
    className={cn(timelineContentVariants({ side }), className)}
    ref={ref}
    {...props}
  />
);

TimelineContent.displayName = "TimelineContent";

const timelineHeadingVariants = cva(
  "row-start-1 row-end-1 line-clamp-1 max-w-full truncate",
  {
    variants: {
      side: {
        right: "col-start-3 col-end-4 mr-auto text-left",
        left: "col-start-1 col-end-2 ml-auto text-right",
      },
      variant: {
        primary: "font-medium text-base text-primary",
        secondary: "font-light text-muted-foreground text-sm",
      },
    },
    defaultVariants: {
      side: "right",
      variant: "primary",
    },
  }
);

interface TimelineHeadingProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof timelineHeadingVariants> {}

const TimelineHeading = ({
  className,
  side,
  variant,
  ref,
  ...props
}: TimelineHeadingProps & {
  ref?: React.RefObject<HTMLParagraphElement | null>;
}) => (
  <p
    aria-level={variant === "primary" ? 2 : 3}
    className={cn(timelineHeadingVariants({ side, variant }), className)}
    ref={ref}
    role="heading"
    {...props}
  />
);

TimelineHeading.displayName = "TimelineHeading";

interface TimelineLineProps extends React.HTMLAttributes<HTMLHRElement> {
  done?: boolean;
}

const TimelineLine = ({
  className,
  done = false,
  ref,
  ...props
}: TimelineLineProps & { ref?: React.RefObject<HTMLHRElement | null> }) => (
  <hr
    aria-orientation="vertical"
    className={cn(
      "col-start-2 col-end-3 row-start-2 row-end-2 mx-auto flex h-full min-h-16 w-0.5 justify-center rounded-full",
      done ? "bg-primary" : "bg-muted",
      className
    )}
    ref={ref}
    {...props}
  />
);

TimelineLine.displayName = "TimelineLine";

export {
  Timeline,
  TimelineContent,
  TimelineDot,
  TimelineHeading,
  TimelineItem,
  TimelineLine,
  TimelineTag,
};
