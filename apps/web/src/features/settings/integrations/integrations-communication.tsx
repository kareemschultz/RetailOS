// React Imports

// Component Imports
import { Avatar, AvatarFallback } from "@RetailOS/ui/components/avatar";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@RetailOS/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@RetailOS/ui/components/dialog";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
// Third-party Imports
import {
  CheckIcon,
  ChevronRightIcon,
  CreditCardIcon,
  LinkIcon,
  MessageCircleIcon,
  ZapIcon,
} from "lucide-react";
import { useState } from "react";

import type { IntegrationApp } from "@/features/settings/types";

const IntegrationsCommunication = ({ apps }: { apps: IntegrationApp[] }) => {
  const [connected, setConnected] = useState<boolean[]>(apps.map(() => false));

  return (
    <div>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        {/* Vertical Tabs List */}
        <div className="flex flex-col space-y-1">
          <h3 className="font-semibold text-base">Communications</h3>
          <p className="text-muted-foreground text-sm">
            Manage your communication integrations and settings.
          </p>
        </div>
        {/* Content */}
        <div className="lg:col-span-2">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {apps.map((app, index) => (
              <Card
                className="group transition-colors hover:ring-primary"
                key={index}
              >
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <Avatar className="after:border-0" size="lg">
                    <AvatarFallback className={cn("rounded-lg", app.bgColor)}>
                      <img
                        alt={app.name}
                        className="size-6 object-contain"
                        src={app.image}
                      />
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    aria-label={`Toggle connect for ${app.name}`}
                    className={cn(
                      connected[index]
                        ? "border-sky-600 text-sky-600! hover:bg-sky-600/10 focus-visible:border-sky-600 focus-visible:ring-sky-600/20 dark:border-sky-400 dark:text-sky-400! dark:focus-visible:border-sky-400 dark:focus-visible:ring-sky-400/40 dark:hover:bg-sky-400/10"
                        : ""
                    )}
                    onClick={() =>
                      setConnected((prev) => {
                        const next = [...prev];

                        next[index] = !next[index];

                        return next;
                      })
                    }
                    variant="outline"
                  >
                    {connected[index] ? <CheckIcon /> : <LinkIcon />}
                    {connected[index] ? "Connected" : "Connect"}
                  </Button>
                </CardContent>
                <CardContent>
                  <CardTitle className="mb-3.5 font-medium">
                    {app.name}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {app.description}
                  </CardDescription>
                </CardContent>
                <Dialog>
                  <CardContent>
                    <DialogTrigger
                      render={
                        <Button
                          className="h-7 w-full gap-1.5 px-2 py-1 text-xs"
                          variant="outline"
                        />
                      }
                    >
                      View Integration
                      <ChevronRightIcon className="transition-transform group-hover:translate-x-1" />
                    </DialogTrigger>
                  </CardContent>
                  <DialogContent className="max-w-[95%] gap-0 overflow-hidden p-0 max-lg:h-[70%] md:max-w-xl lg:max-w-3xl">
                    {/* Header */}
                    <div className="flex items-start gap-4 border-b p-4 md:p-6">
                      <Avatar className="size-12 rounded-xl after:border-0">
                        <AvatarFallback
                          className={cn("rounded-xl", app.bgColor)}
                        >
                          <img
                            alt={app.name}
                            className="size-7 object-contain"
                            src={app.image}
                          />
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <DialogTitle className="font-bold text-lg">
                          {app.name}
                        </DialogTitle>
                        <DialogDescription className="mt-0.5">
                          Create {app.name} Issues from Intercom and automate
                          with Workflows
                        </DialogDescription>
                        <div className="mt-1.5 flex items-center gap-3">
                          <span className="text-muted-foreground text-xs">
                            Built by {app.name}
                          </span>
                          <Badge className="gap-1 text-xs" variant="secondary">
                            <CheckIcon className="size-3" /> Free
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="flex overflow-hidden max-sm:flex-col">
                      {/* Left Column */}
                      <div className="max-h-[60vh] flex-1 space-y-5 overflow-y-auto p-4 md:p-6 lg:max-h-[65vh]">
                        <p className="text-muted-foreground text-sm">
                          Seamlessly bridge the gap between your support and
                          engineering teams. This integration connects your
                          ticketing system with {app.name}, enabling real-time
                          syncing and powerful automation capabilities.
                        </p>
                        <ul className="space-y-2.5">
                          {[
                            "Automate syncing between platforms to keep issues up to date",
                            "Use pre-built workflow templates to get started quickly",
                            `Link ${app.name} issues directly to conversations for full context`,
                            "Access beta features for advanced automation pipelines (beta)",
                          ].map((item, i) => (
                            <li
                              className="flex items-start gap-2 text-sm"
                              key={i}
                            >
                              <CheckIcon className="mt-0.5 size-4 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>

                        {/* Feature Highlight */}
                        <div className="rounded-xl bg-muted p-6">
                          <h4 className="mb-4 text-center font-semibold text-sm">
                            Speed up your team with custom automations using{" "}
                            {app.name} Workflow templates
                          </h4>
                          <div className="grid gap-3 md:grid-cols-2">
                            {[
                              {
                                icon: <CreditCardIcon />,
                                title: `Create ${app.name} issue`,
                                desc: "Automatically create issues from conversations",
                              },
                              {
                                icon: <MessageCircleIcon />,
                                title: `Comment on ${app.name} issue`,
                                desc: "Add notes and updates directly to issues",
                              },
                              {
                                icon: <LinkIcon />,
                                title: "Link existing issue",
                                desc: "Connect conversations to existing issues instantly",
                              },
                              {
                                icon: <ZapIcon />,
                                title: "Trigger automations",
                                desc: "Kick off workflows based on status changes",
                              },
                            ].map((card, i) => (
                              <div
                                className="rounded-lg bg-background p-3.5"
                                key={i}
                              >
                                <div className="mb-2 text-lg">{card.icon}</div>
                                <p className="mb-1 font-semibold text-xs">
                                  {card.title}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  {card.desc}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right Sidebar */}
                      <div className="flex w-52 shrink-0 flex-col gap-5 border-l p-5 max-sm:w-full">
                        <Button>Install now</Button>
                        <div className="max-sm:hidden">
                          <p className="mb-2 font-semibold text-xs">
                            Works with
                          </p>
                          <ul className="space-y-1.5 text-muted-foreground text-xs">
                            {["Inbox", "Automations"].map((item) => (
                              <li
                                className="flex items-center gap-1.5"
                                key={item}
                              >
                                <CheckIcon className="size-3" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="max-sm:hidden">
                          <p className="mb-2 font-semibold text-xs">
                            Categories
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              "Conversation management",
                              "Issue tracking & ticketing",
                              "For Support Agents",
                            ].map((tag) => (
                              <Badge
                                className="rounded-full font-normal text-xs"
                                key={tag}
                                variant="secondary"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsCommunication;
