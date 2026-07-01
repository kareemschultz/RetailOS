import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileClock } from "lucide-react";

export const Route = createFileRoute("/_app/reports/financial")({
  component: FinancialReportUnavailableScreen,
});

function FinancialReportUnavailableScreen() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center p-6">
      <Card className="w-full border-dashed shadow-sm">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileClock className="size-6" />
          </div>
          <div className="space-y-2">
            <h1 className="font-semibold text-2xl tracking-tight">
              Report not available yet
            </h1>
            <p className="text-muted-foreground text-sm leading-6">
              The accounting/GL dashboard is intentionally hidden until that
              phase is fully backed by production workflows. For this demo, use
              the verified Number leases report.
            </p>
          </div>
          <Button
            nativeButton={false}
            render={<Link to="/reports/number-leases" />}
          >
            Open Number leases
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
