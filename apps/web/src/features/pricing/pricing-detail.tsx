import { Avatar, AvatarFallback } from "@RetailOS/ui/components/avatar";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import { NumberTicker } from "@RetailOS/ui/components/number-ticker";
import { ScrollArea, ScrollBar } from "@RetailOS/ui/components/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@RetailOS/ui/components/tabs";
import { cn } from "@RetailOS/ui/lib/utils";
import {
  ChartLineIcon,
  CheckIcon,
  Flower2Icon,
  FlowerIcon,
  MinusIcon,
  RocketIcon,
  SproutIcon,
  UsersRoundIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import type {
  FeatureValue,
  PricingFeature,
  PricingFeatureIconKey,
  PricingPlan,
  PricingPlanIconKey,
} from "@/features/pricing/data";

type Plans = PricingPlan[];

const planIconMap: Record<PricingPlanIconKey, ReactNode> = {
  sprout: <SproutIcon />,
  flower: <FlowerIcon />,
  flower2: <Flower2Icon />,
};

const featureIconMap: Record<PricingFeatureIconKey, ReactNode> = {
  "chart-line": <ChartLineIcon />,
  rocket: <RocketIcon />,
  "users-round": <UsersRoundIcon />,
};

function renderFeatureValue(value: FeatureValue) {
  if (typeof value === "boolean") {
    return value ? (
      <div className="flex size-5.5 items-center justify-center rounded-full bg-primary/10">
        <CheckIcon className="size-3.5 text-primary" />
      </div>
    ) : (
      <div className="flex size-5.5 items-center justify-center rounded-full bg-muted">
        <MinusIcon className="size-3.5 text-muted-foreground" />
      </div>
    );
  }

  return <div className="text-center font-medium text-sm">{value}</div>;
}

const PricingDetail = ({
  plans,
  features,
}: {
  plans: Plans;
  features: PricingFeature[];
}) => {
  const [billingPeriod, setBillingPeriod] = useState("monthly");

  return (
    <section id="pricing-details">
      {/* Section Header */}
      <div className="mb-12 space-y-4 text-center sm:mb-16 lg:mb-24">
        <p className="font-medium text-primary text-sm uppercase">Pricing</p>

        <h1 className="font-semibold text-2xl md:text-3xl lg:text-4xl">
          Pricing Details
        </h1>

        <p className="mb-9 text-lg text-muted-foreground">
          A Comprehensive Breakdown Of Our Pricing Plans to Help You Make The
          Best Choice!
        </p>

        {/* Billing Toggle */}
        <div className="flex justify-center">
          <Tabs
            className="rounded-lg bg-muted p-0.75"
            onValueChange={(value) => setBillingPeriod(value)}
            value={billingPeriod === "yearly" ? "yearly" : "monthly"}
          >
            <TabsList className="h-auto bg-transparent p-0">
              <TabsTrigger
                aria-hidden
                className="px-3 py-1 data-[state=active]:bg-background data-[state=active]:text-muted data-[state=active]:shadow-sm dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-background dark:data-[state=active]:text-muted"
                value="monthly"
              >
                <span className="text-base text-foreground">Monthly</span>
              </TabsTrigger>
              <TabsTrigger
                aria-hidden
                className="px-3 py-1 data-[state=active]:bg-background data-[state=active]:text-muted data-[state=active]:shadow-sm dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-background dark:data-[state=active]:text-muted"
                value="yearly"
              >
                <span className="text-base text-foreground">Yearly</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Pricing Table */}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="min-w-255">
          {/* Header Row */}
          <div className="mb-13 grid grid-cols-4 gap-6">
            {/* Discount Card */}
            <div className="flex h-full w-full flex-col justify-center gap-6 rounded-lg border border-dashed p-6">
              <p className="font-semibold text-2xl uppercase">Flat</p>
              <div>
                <span className="font-bold text-6xl text-destructive">
                  20%{" "}
                </span>
                <span className="font-medium text-xl">OFF</span>
              </div>
              <p className="text-muted-foreground">
                For first 250 users,
                <br />
                hurry up and get in now
              </p>
            </div>

            {/* Plan Cards */}
            {plans.map((plan) => (
              <Card
                className={cn("relative bg-muted shadow-none ring-0", {
                  "border bg-background shadow-lg": plan.isPopular,
                })}
                key={plan.title}
              >
                <CardContent className="flex flex-col gap-6">
                  <div
                    className={cn({
                      "flex items-start justify-between": plan.isPopular,
                    })}
                  >
                    <Avatar className="size-12 rounded-md after:border-0">
                      <AvatarFallback
                        className={cn("rounded-md shadow-md", {
                          [plan.isPopular
                            ? "bg-muted text-foreground"
                            : "bg-card text-foreground"]: true,
                        })}
                      >
                        {planIconMap[plan.icon]}
                      </AvatarFallback>
                    </Avatar>
                    {plan.isPopular && (
                      <Badge className="z-10 h-auto bg-destructive text-white focus-visible:ring-destructive/20 [a&]:hover:bg-destructive/90">
                        Trending
                      </Badge>
                    )}
                  </div>

                  <p className="font-semibold text-xl">{plan.title}</p>

                  <div className="flex items-baseline">
                    <span className="font-bold text-5xl">
                      $
                      <NumberTicker
                        startValue={0}
                        value={
                          billingPeriod === "yearly"
                            ? plan.price.yearly
                            : plan.price.monthly
                        }
                      />
                    </span>
                    <span className="ml-1 text-base text-muted-foreground">
                      {plan.period}
                    </span>
                  </div>

                  <Button className="w-full *:w-full">{plan.buttonText}</Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Features Table */}
          <div className="space-y-9">
            {features.map((section) => (
              <div className="space-y-6" key={section.category}>
                {/* Category Header */}
                <div className="flex items-center gap-2">
                  <Avatar className="size-8.5 rounded-md border bg-primary/10 shadow-none after:border-0">
                    <AvatarFallback className="rounded-md text-foreground [&>svg]:size-4.5">
                      {featureIconMap[section.icon]}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-medium text-xl">{section.category}</p>
                </div>

                {/* Feature Rows */}
                <div className="rounded-lg border">
                  {section.features.map((feature, featureIndex) => (
                    <div
                      className={cn("grid w-full grid-cols-4 border-b", {
                        "border-b-0":
                          featureIndex === section.features.length - 1,
                      })}
                      key={feature.name}
                    >
                      <p className="px-2 py-3 text-muted-foreground text-sm">
                        {feature.name}
                      </p>
                      {feature.values.map((value, valueIndex) => (
                        <div
                          className="flex items-center justify-center px-2 py-3"
                          key={`${feature.name}-${plans[valueIndex]?.title ?? valueIndex}`}
                        >
                          {renderFeatureValue(value)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA Buttons */}
          <div className="mt-2.5 grid grid-cols-4 gap-4">
            <div />
            {plans.map((plan) => (
              <div className="px-3 py-4" key={plan.title}>
                <Button className="w-full *:w-full">{plan.buttonText}</Button>
              </div>
            ))}
          </div>
        </div>

        <ScrollBar className="pb-0" orientation="horizontal" />
      </ScrollArea>
    </section>
  );
};

export default PricingDetail;
