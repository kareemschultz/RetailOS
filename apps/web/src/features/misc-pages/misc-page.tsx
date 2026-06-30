import { DotGrid } from "@RetailOS/ui/components/bg-dot-grid";
import { Button } from "@RetailOS/ui/components/button";
import { MorphingText } from "@RetailOS/ui/components/morphing-text";
import { Link } from "@tanstack/react-router";

interface MiscPageAction {
  label: string;
  to: string;
}

interface MiscPageProps {
  action: MiscPageAction;
  description: string;
  heading: string;
  morphingTexts: string[];
  title: string;
}

export function MiscPage({
  title,
  heading,
  description,
  morphingTexts,
  action,
}: MiscPageProps) {
  return (
    <div className="grid min-h-[calc(100vh-8rem)] grid-cols-1 overflow-hidden rounded-2xl border lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
        <h2 className="mb-6 font-semibold text-5xl">{title}</h2>
        <h3 className="mb-1.5 font-semibold text-3xl">{heading}</h3>
        <p className="mb-6 max-w-sm text-muted-foreground">{description}</p>
        <Button render={<Link to={action.to} />} size="lg">
          {action.label}
        </Button>
      </div>

      {/* Right Section: Illustration */}
      <div className="relative max-h-screen w-full p-2 max-lg:hidden">
        <div className="relative h-full w-full overflow-hidden rounded-2xl bg-black">
          <DotGrid
            activeColor="var(--primary)"
            baseColor="var(--muted-foreground)"
            displacement={14}
            dotSize={1.9}
            gap={22}
            maxScale={4}
            radius={160}
          />

          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <MorphingText
              className="font-bold text-7xl text-white xl:text-9xl"
              texts={morphingTexts}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
