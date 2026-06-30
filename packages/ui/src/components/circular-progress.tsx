import { cn } from "@RetailOS/ui/lib/utils";
import type * as React from "react";

interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  circleStrokeWidth?: number;
  gaugePrimaryColor?: string;
  gaugeSecondaryColor?: string;
  labelClassName?: string;
  progressBgClassName?: string;
  progressClassName?: string;
  progressStrokeWidth?: number;
  renderLabel?: (progress: number) => React.ReactNode;
  shape?: "square" | "round";
  showLabel?: boolean;
  size?: number;
  strokeWidth?: number;
  trackDashArray?: string | number;
  value: number;
  variant?: "default" | "animated";
}

const CircularProgress = ({
  value,
  renderLabel,
  className,
  progressClassName,
  progressBgClassName,
  labelClassName,
  showLabel,
  shape = "round",
  size = 100,
  strokeWidth,
  circleStrokeWidth = 10,
  progressStrokeWidth = 10,
  variant = "default",
  gaugePrimaryColor = "currentColor",
  gaugeSecondaryColor = "currentColor",
  trackDashArray,
  ...props
}: CircularProgressProps) => {
  const effectiveCircleWidth = strokeWidth ?? circleStrokeWidth;
  const effectiveProgressWidth = strokeWidth ?? progressStrokeWidth;
  const maxStroke = Math.max(effectiveCircleWidth, effectiveProgressWidth);

  const radius = variant === "animated" ? 45 : (size - maxStroke) / 2;
  const currentPercent = Math.min(Math.max(value, 0), 100);

  if (variant === "animated") {
    const gapPercent = 5;
    const dashFactor = (2 * Math.PI * 45) / 100;
    const circumference = 2 * Math.PI * 45;

    const primaryDash = `${currentPercent * dashFactor} ${circumference}`;
    const primaryRotate = -90 + gapPercent * 0 * 3.6;

    const secondaryDash = trackDashArray
      ? trackDashArray
      : `${Math.max(0, 90 - currentPercent) * dashFactor} ${circumference}`;

    const secondaryRotate = 360 - 90 - gapPercent * 3.6;

    return (
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center",
          className
        )}
        style={{ width: size, height: size }}
        {...props}
      >
        <svg className="size-full overflow-visible" viewBox="0 0 100 100">
          {/* Dynamic Background Track */}
          <circle
            className={cn(
              "text-primary/10 transition-all duration-1000 ease-in-out",
              progressBgClassName
            )}
            cx="50"
            cy="50"
            fill="none"
            r={45}
            stroke={gaugeSecondaryColor}
            strokeDasharray={secondaryDash}
            strokeLinecap={trackDashArray ? "butt" : shape}
            strokeWidth={effectiveCircleWidth}
            style={{
              transform: `rotate(${secondaryRotate}deg) scaleY(-1)`,
              transformOrigin: "50px 50px",
            }}
          />
          {/* Dynamic Progress Bar */}
          <circle
            className={cn(
              "transition-all duration-1000 ease-in-out",
              progressClassName
            )}
            cx="50"
            cy="50"
            fill="none"
            r={45}
            stroke={gaugePrimaryColor}
            strokeDasharray={primaryDash}
            strokeLinecap={shape}
            strokeWidth={effectiveProgressWidth}
            style={{
              transform: `rotate(${primaryRotate}deg)`,
              transformOrigin: "50px 50px",
            }}
          />
        </svg>
        {showLabel && (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center font-medium text-lg",
              labelClassName
            )}
          >
            {renderLabel ? renderLabel(value) : `${value}%`}
          </div>
        )}
      </div>
    );
  }

  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (currentPercent / 100) * circumference;

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center",
        className
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg
        className="size-full -rotate-90 overflow-visible"
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          className={cn("text-primary/20", progressBgClassName)}
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={
            gaugeSecondaryColor === "currentColor"
              ? "currentColor"
              : gaugeSecondaryColor
          }
          strokeDasharray={trackDashArray}
          strokeLinecap={shape}
          strokeWidth={effectiveCircleWidth}
        />
        <circle
          className={cn(
            "transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            progressClassName
          )}
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={
            gaugePrimaryColor === "currentColor"
              ? "currentColor"
              : gaugePrimaryColor
          }
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap={shape}
          strokeWidth={effectiveProgressWidth}
        />
      </svg>
      {showLabel && (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center font-medium text-base",
            labelClassName
          )}
        >
          {renderLabel ? renderLabel(value) : `${value}%`}
        </div>
      )}
    </div>
  );
};

export { CircularProgress };
