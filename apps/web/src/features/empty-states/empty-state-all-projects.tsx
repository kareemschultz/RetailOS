import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@RetailOS/ui/components/accordion";
import { Card, CardContent } from "@RetailOS/ui/components/card";

import { skeletonClass } from "@/features/empty-states/empty-state-report";

const allProjectCards = Array.from({ length: 6 }, (_, index) => index + 1);

function EmptyStateAllProjects() {
  return (
    <Accordion
      className='w-full space-y-2 overflow-visible border-0 [&>*>[data-slot="accordion-content"]]:px-0'
      defaultValue={["item-1"]}
    >
      <AccordionItem
        className="rounded-lg border bg-transparent"
        value="item-1"
      >
        <AccordionTrigger className="px-5">Recent (3)</AccordionTrigger>
        <AccordionContent className="mt-1 grid grid-cols-1 gap-6 px-5 lg:grid-cols-3">
          <Card>
            <CardContent className="h-full space-y-3">
              <div className={`${skeletonClass} h-22`} />
              <div>
                <h3 className="font-medium text-base">Project Name</h3>
                <p className="text-muted-foreground text-sm">Description</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="h-full space-y-3">
              <div className={`${skeletonClass} h-22`} />
              <div>
                <h3 className="font-medium text-base">Project Name</h3>
                <p className="text-muted-foreground text-sm">Description</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="h-full space-y-3">
              <div className={`${skeletonClass} h-22`} />
              <div>
                <h3 className="font-medium text-base">Project Name</h3>
                <p className="text-muted-foreground text-sm">Description</p>
              </div>
            </CardContent>
          </Card>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem
        className="rounded-lg border bg-transparent"
        value="item-2"
      >
        <AccordionTrigger className="px-5">All (6)</AccordionTrigger>
        <AccordionContent className="mt-1 grid grid-cols-1 gap-6 px-5 lg:grid-cols-3">
          {allProjectCards.map((item) => (
            <Card key={item}>
              <CardContent className="h-full space-y-3">
                <div className={`${skeletonClass} h-22`} />
                <div>
                  <h3 className="font-medium text-base">Project Name</h3>
                  <p className="text-muted-foreground text-sm">Description</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export default EmptyStateAllProjects;
