import { Card, CardContent } from "@RetailOS/ui/components/card";

import EmptyStateAllProjects from "@/features/empty-states/empty-state-all-projects";
import EmptyStateProject from "@/features/empty-states/empty-state-project";
import EmptyStateReport from "@/features/empty-states/empty-state-report";

const projectCardKeys = ["alpha", "bravo", "charlie"];

function EmptyStates() {
  return (
    <div className="space-y-6">
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {projectCardKeys.map((key) => (
          <Card key={key}>
            <CardContent className="h-full space-y-3">
              <div className="h-22 rounded-md border bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_1px,var(--card)_2px,var(--card)_15px)]" />
              <div>
                <h3 className="font-medium text-base">Project Name</h3>
                <p className="text-muted-foreground text-sm">Description</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <EmptyStateReport />
      <EmptyStateAllProjects />
      <EmptyStateProject />
    </div>
  );
}

export default EmptyStates;
