import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import { Link, type LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

export type ModuleStatus = "Available" | "In build" | "Planned";

export interface ModuleAction {
  description?: string;
  label: string;
  to: LinkProps["to"];
}

export interface ModuleStep {
  description: string;
  label: string;
  status: ModuleStatus;
}

export interface ModuleStatusPageProps {
  actions?: ModuleAction[];
  eyebrow: string;
  icon: LucideIcon;
  primaryAction?: ModuleAction;
  steps: ModuleStep[];
  summary: string;
  title: string;
}

const STATUS_VARIANTS: Record<
  ModuleStatus,
  "default" | "secondary" | "outline"
> = {
  Available: "default",
  "In build": "secondary",
  Planned: "outline",
};

export function ModuleStatusPage({
  actions = [],
  eyebrow,
  icon: Icon,
  primaryAction,
  steps,
  summary,
  title,
}: ModuleStatusPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <section className="rounded-3xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex max-w-3xl gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="size-6" />
            </div>
            <div className="space-y-3">
              <Badge variant="secondary">{eyebrow}</Badge>
              <div className="space-y-2">
                <h1 className="font-semibold text-3xl tracking-tight">
                  {title}
                </h1>
                <p className="text-muted-foreground text-sm leading-6">
                  {summary}
                </p>
              </div>
            </div>
          </div>

          {primaryAction ? (
            <Button
              nativeButton={false}
              render={<Link to={primaryAction.to} />}
            >
              {primaryAction.label}
            </Button>
          ) : null}
        </div>
      </section>

      {actions.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => (
            <Card className="shadow-sm" key={`${action.label}-${action.to}`}>
              <CardHeader>
                <CardTitle className="text-base">{action.label}</CardTitle>
                {action.description ? (
                  <CardDescription>{action.description}</CardDescription>
                ) : null}
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full justify-center"
                  nativeButton={false}
                  render={<Link to={action.to} />}
                  variant="outline"
                >
                  Open
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {steps.map((step) => (
          <Card className="shadow-sm" key={step.label}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-base">{step.label}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </div>
              <Badge variant={STATUS_VARIANTS[step.status]}>
                {step.status}
              </Badge>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}
