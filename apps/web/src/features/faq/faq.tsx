import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@RetailOS/ui/components/accordion";
import { Avatar, AvatarFallback } from "@RetailOS/ui/components/avatar";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import { Input } from "@RetailOS/ui/components/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@RetailOS/ui/components/tabs";
import {
  BookOpenIcon,
  BriefcaseBusinessIcon,
  ChevronRightIcon,
  CreditCardIcon,
  HeadphonesIcon,
  LockKeyholeIcon,
  MessagesSquareIcon,
  PhoneIcon,
} from "lucide-react";
import type { ReactElement } from "react";

import type {
  FaqData,
  FaqIconKey,
  FaqSupportCardIconKey,
} from "@/features/faq/data";

const faqIconMap: Record<FaqIconKey, ReactElement> = {
  general: <BriefcaseBusinessIcon />,
  security: <LockKeyholeIcon />,
  billing: <CreditCardIcon />,
  support: <HeadphonesIcon />,
};

const supportCardIconMap: Record<FaqSupportCardIconKey, ReactElement> = {
  support: <MessagesSquareIcon />,
  call: <PhoneIcon />,
  docs: <BookOpenIcon />,
};

const FAQ = ({ data }: { data: FaqData }) => {
  const defaultCategory = data.categories[0]?.id;

  return (
    <section>
      <div className="space-y-6 md:space-y-8 lg:space-y-10">
        {/* Header */}
        <div className="space-y-4 rounded-md bg-muted px-6 py-12 text-center">
          <Badge className="h-auto font-normal text-sm" variant="outline">
            FAQs
          </Badge>
          <h2 className="font-semibold text-2xl md:text-3xl lg:text-4xl">
            Frequently Inquired Queries
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Find answers about analytics, permissions, billing, and operational
            support for your team.
          </p>
          <div className="mx-auto flex max-w-sm gap-3 max-sm:flex-col max-sm:items-center">
            <Input
              className="input-lg flex-1 bg-background"
              placeholder="Search for an admin question"
              type="text"
            />
            <Button className="text-base max-sm:w-full sm:h-10">Search</Button>
          </div>
        </div>
        {/* FAQ List */}
        <Tabs defaultValue={defaultCategory} orientation="vertical">
          <div className="grid w-full grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
            {/* Vertical Tabs List */}
            <div className="flex flex-col items-center justify-between">
              <TabsList className="h-max w-full flex-col gap-2 bg-transparent p-0">
                {data.categories.map((category) => (
                  <TabsTrigger
                    className="w-full gap-2 rounded-lg border-border bg-background px-6 py-2.5 text-foreground data-active:border-primary/20 data-active:bg-muted data-active:text-primary data-active:shadow-none! dark:data-active:border-primary/20 dark:data-active:bg-primary/10 dark:data-active:text-primary"
                    key={category.id}
                    value={category.id}
                  >
                    {faqIconMap[category.icon]}
                    <span className="flex-1 text-start text-base">
                      {category.title}
                    </span>
                    <ChevronRightIcon className="size-4 rtl:rotate-180" />
                  </TabsTrigger>
                ))}
              </TabsList>
              <img
                alt="FAQ Illustration"
                className="hidden transition-transform duration-300 hover:scale-110 lg:block"
                height={320}
                src="https://cdn.shadcnstudio.com/ss-assets/landing-page/ambassador/image-9.png?width=320&format=auto"
                width={320}
              />
            </div>
            {/* Tab Content */}
            <div className="lg:col-span-2">
              {data.categories.map((category) => (
                <TabsContent
                  className="mt-0 space-y-4"
                  key={category.id}
                  value={category.id}
                >
                  <div className="flex min-h-10 items-center justify-start gap-4">
                    <Avatar
                      className="rounded-md border bg-primary/10 shadow-none after:border-0"
                      size="lg"
                    >
                      <AvatarFallback className="rounded-md text-foreground [&>svg]:size-5">
                        {faqIconMap[category.icon]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="font-medium">{category.title}</h2>
                      <p className="text-muted-foreground text-sm">
                        {category.description}
                      </p>
                    </div>
                  </div>
                  <Accordion
                    className='w-full overflow-hidden rounded-lg border [&>*>[data-slot="accordion-content"]]:px-0'
                    defaultValue={["item-1"]}
                  >
                    {category.questions.map((item, index) => (
                      <AccordionItem
                        key={item.question}
                        value={`item-${index + 1}`}
                      >
                        <AccordionTrigger className="px-2.5 text-base">
                          {item.question}
                        </AccordionTrigger>
                        <AccordionContent className="px-2.5 text-base text-muted-foreground">
                          {item.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </TabsContent>
              ))}
            </div>
          </div>
        </Tabs>
      </div>

      {/* Contact Section */}
      <div className="mt-16 lg:mt-24">
        <div className="space-y-4 text-center">
          <Badge className="h-auto font-normal text-sm" variant="outline">
            Still have questions?
          </Badge>
          <h2 className="font-semibold text-2xl md:text-3xl lg:text-4xl">
            Need More Admin Help?
          </h2>
          <p className="text-lg text-muted-foreground">
            Choose the best support channel for your team and get assistance
            from the right specialists.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.supportCards.map((card) => (
            <Card
              className="mx-auto h-max w-full gap-4 border-primary max-lg:last:col-span-full"
              key={card.title}
            >
              <Avatar className="mx-auto size-10 rounded-md border bg-primary/10 shadow-none after:border-0">
                <AvatarFallback className="rounded-md text-foreground">
                  {supportCardIconMap[card.icon]}
                </AvatarFallback>
              </Avatar>
              <CardContent className="flex flex-col gap-4 text-center">
                <h3 className="font-medium text-base">{card.title}</h3>
                <p className="text-muted-foreground">{card.description}</p>
                <Button className="w-full" size="lg" variant="outline">
                  {card.buttonText}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
