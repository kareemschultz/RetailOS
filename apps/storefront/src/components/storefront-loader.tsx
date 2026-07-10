import { Loader2 } from "lucide-react";

// Minimal, calm pending state — a single spinner honoring the motion budget
// (no bouncing/particles). Used as the router's default pending component.
export function StorefrontLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground motion-reduce:animate-none" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
