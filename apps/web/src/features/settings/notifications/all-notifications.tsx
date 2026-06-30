// React Imports

// Component Imports
import { Checkbox } from "@RetailOS/ui/components/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
// Third-party Imports
import { MailIcon, MonitorIcon, TabletSmartphoneIcon } from "lucide-react";
import React, { useState } from "react";

interface NotificationChannels {
  app: boolean;
  desktop: boolean;
  email: boolean;
}

interface NotificationItem {
  channels: NotificationChannels;
  description?: string;
  id: string;
  title: string;
}

interface NotificationSection {
  id: string;
  items: NotificationItem[];
  title: string;
}

const notificationSections: NotificationSection[] = [
  {
    id: "users-team",
    title: "Users & Team",
    items: [
      {
        id: "new-user-registrations",
        title: "New User Registrations",
        description: "Be informed when a new user signs up.",
        channels: { email: true, desktop: false, app: true },
      },
      {
        id: "role-permission-changes",
        title: "Role & Permission Changes",
        description:
          "Receive notifications when user roles or access levels are modified.",
        channels: { email: true, desktop: true, app: true },
      },
    ],
  },
  {
    id: "api-integrations",
    title: "API & Integrations",
    items: [
      {
        id: "api-usage-limit",
        title: "API Usage Limit",
        description: "Get notified when API usage approaches your quota.",
        channels: { email: false, desktop: true, app: false },
      },
      {
        id: "integration-failures",
        title: "Integration Failures",
        description: "Receive alerts when third-party integrations fail.",
        channels: { email: true, desktop: false, app: false },
      },
    ],
  },
  {
    id: "projects",
    title: "Projects",
    items: [
      {
        id: "project-status-updates",
        title: "Project Status Updates",
        description: "Be notified when project stages or statuses are updated.",
        channels: { email: false, desktop: true, app: true },
      },
      {
        id: "deadline-reminders",
        title: "Deadline Reminders",
        description: "Receive reminders before project or milestone deadlines.",
        channels: { email: true, desktop: true, app: true },
      },
      {
        id: "project-comments",
        title: "Project Comments",
        description:
          "Get notified when someone comments on a project you're part of.",
        channels: { email: true, desktop: true, app: true },
      },
    ],
  },
];

const Notifications = () => {
  const [sections, setSections] =
    useState<NotificationSection[]>(notificationSections);

  const setColumn = (column: keyof NotificationChannels, value: boolean) => {
    setSections((prev) =>
      prev.map((section) => ({
        ...section,
        items: section.items.map((item) => ({
          ...item,
          channels: { ...item.channels, [column]: value },
        })),
      }))
    );
  };

  const setItemChannel = (
    sectionId: string,
    itemId: string,
    column: keyof NotificationChannels,
    value: boolean
  ) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) {
          return section;
        }

        return {
          ...section,
          items: section.items.map((item) =>
            item.id === itemId
              ? { ...item, channels: { ...item.channels, [column]: value } }
              : item
          ),
        };
      })
    );
  };

  const emailAll = sections.every((s) =>
    s.items.every((i) => i.channels.email)
  );
  const desktopAll = sections.every((s) =>
    s.items.every((i) => i.channels.desktop)
  );
  const appAll = sections.every((s) => s.items.every((i) => i.channels.app));

  return (
    <section className="py-3">
      <div className="mb-6 space-y-1">
        <h3 className="font-semibold text-base">Notifications</h3>
        <p className="text-muted-foreground text-sm">
          Manage your notification settings and preferences.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-none hover:bg-transparent">
            <TableHead className="sticky left-0 z-1 w-1/4 bg-background py-6! text-left font-semibold text-base">
              Notify Me About
            </TableHead>
            <TableHead className="text-center">
              <div className="flex flex-col items-center">
                <MailIcon />
                <span className="font-medium text-xs">Email</span>
                <div className="mt-2 mb-4 flex flex-col items-center text-xs">
                  <button
                    aria-pressed={emailAll}
                    className="text-xs"
                    onClick={() => setColumn("email", !emailAll)}
                    type="button"
                  >
                    Toggle All
                  </button>
                </div>
              </div>
            </TableHead>
            <TableHead className="text-center">
              <div className="flex flex-col items-center">
                <div className="flex flex-col items-center">
                  <MonitorIcon />
                  <span className="font-medium text-xs">Desktop</span>
                  <div className="mt-2 mb-4 flex flex-col items-center text-xs">
                    <button
                      aria-pressed={desktopAll}
                      className="text-xs"
                      onClick={() => setColumn("desktop", !desktopAll)}
                      type="button"
                    >
                      Toggle All
                    </button>
                  </div>
                </div>
              </div>
            </TableHead>
            <TableHead className="text-center">
              <div className="flex flex-col items-center">
                <div className="flex flex-col items-center">
                  <TabletSmartphoneIcon />
                  <span className="font-medium text-xs">App</span>
                  <div className="mt-2 mb-4 flex flex-col items-center text-xs">
                    <button
                      aria-pressed={appAll}
                      className="text-xs"
                      onClick={() => setColumn("app", !appAll)}
                      type="button"
                    >
                      Toggle All
                    </button>
                  </div>
                </div>
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sections.map((section) => (
            <React.Fragment key={section.id}>
              <TableRow className="border-none hover:bg-transparent">
                <TableCell className="sticky left-0 rounded-l-md bg-muted py-4 pr-0 pl-4 text-left font-semibold text-sm">
                  {section.title}
                </TableCell>
                <TableCell className="bg-muted p-0" />
                <TableCell className="bg-muted p-0" />
                <TableCell className="rounded-r-md bg-muted p-0" />
              </TableRow>

              {section.items.map((item) => (
                <TableRow
                  className="border-none hover:bg-transparent"
                  key={item.id}
                >
                  <TableCell className="sticky left-0 z-1 bg-background">
                    <div className="font-medium text-sm">{item.title}</div>
                    {item.description && (
                      <div className="text-wrap text-muted-foreground text-xs">
                        {item.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="align-middle">
                    <div className="flex justify-center">
                      <Checkbox
                        aria-label={`${item.id}-email`}
                        checked={item.channels.email}
                        onCheckedChange={(checked) =>
                          setItemChannel(
                            section.id,
                            item.id,
                            "email",
                            !!checked
                          )
                        }
                      />
                    </div>
                  </TableCell>
                  <TableCell className="align-middle">
                    <div className="flex justify-center">
                      <Checkbox
                        aria-label={`${item.id}-desktop`}
                        checked={item.channels.desktop}
                        onCheckedChange={(checked) =>
                          setItemChannel(
                            section.id,
                            item.id,
                            "desktop",
                            !!checked
                          )
                        }
                      />
                    </div>
                  </TableCell>
                  <TableCell className="align-middle">
                    <div className="flex justify-center">
                      <Checkbox
                        aria-label={`${item.id}-app`}
                        checked={item.channels.app}
                        onCheckedChange={(checked) =>
                          setItemChannel(section.id, item.id, "app", !!checked)
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </section>
  );
};

export default Notifications;
