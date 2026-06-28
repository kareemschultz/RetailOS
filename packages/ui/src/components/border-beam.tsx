import { cn } from "@RetailOS/ui/lib/utils";
import type { MotionStyle, Transition } from "motion/react";
import { motion } from "motion/react";
import type { CSSProperties } from "react";

// Owned + re-themed from the shadcn Studio login-page-02 block (Assembly Law):
// an animated gradient beam that travels the border of its rounded parent.
// Default colours use the RetailOS brand blue. Motion only (transform/offset),
// honoring the auth/onboarding motion budget.
interface BorderBeamProps {
  borderWidth?: number;
  className?: string;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
  duration?: number;
  initialOffset?: number;
  reverse?: boolean;
  size?: number;
  style?: CSSProperties;
  transition?: Transition;
}

export function BorderBeam({
  className,
  size = 60,
  delay = 0,
  duration = 8,
  colorFrom = "var(--brand)",
  colorTo = "oklch(0.809 0.105 251.813)",
  transition,
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 2,
}: BorderBeamProps) {
  return (
    <div
      className="border-(length:--border-beam-width) pointer-events-none absolute inset-0 rounded-[inherit] border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
      style={{ "--border-beam-width": `${borderWidth}px` } as CSSProperties}
    >
      <motion.div
        animate={{
          offsetDistance: reverse
            ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
            : [`${initialOffset}%`, `${100 + initialOffset}%`],
        }}
        className={cn(
          "absolute aspect-square rounded-full bg-gradient-to-l from-[var(--color-from)] via-[var(--color-to)] to-transparent",
          className
        )}
        initial={{ offsetDistance: `${initialOffset}%` }}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            "--color-from": colorFrom,
            "--color-to": colorTo,
            ...style,
          } as MotionStyle
        }
        transition={{
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
          duration,
          delay: -delay,
          ...transition,
        }}
      />
    </div>
  );
}

export type { BorderBeamProps };
