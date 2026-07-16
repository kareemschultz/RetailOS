import { Loader2 } from "lucide-react";

// Minimal, calm pending state — a single spinner honoring the motion budget
// (no bouncing/particles). Used as the router's default pending component and
// inline while product data loads.
export function StorefrontLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Loader2 className="size-6 animate-spin text-muted-foreground motion-reduce:animate-none" />
      <span className="text-muted-foreground text-sm">{label}</span>
    </div>
  );
}
