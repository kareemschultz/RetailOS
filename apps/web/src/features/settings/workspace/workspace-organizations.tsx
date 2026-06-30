// Next Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@RetailOS/ui/components/dialog";
import { Separator } from "@RetailOS/ui/components/separator";
// Third-party Imports
import { Trash2Icon } from "lucide-react";

const WorkspaceOrganizations = () => {
  const organizations = [
    {
      id: "notion",
      name: "Notion",
      img: "/images/brands/notion-white.webp",
      description: "member and collaborator on product and docs projects",
    },
    {
      id: "github",
      name: "Github",
      img: "/images/brands/github-white.webp",
      description: "repository collaborator and CI maintainer",
    },
    {
      id: "discord",
      name: "Discord",
      img: "/images/brands/discord.webp",
      description: "community moderator and support channel member",
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        {/* Workspace Organizations */}
        <div className="flex flex-col space-y-1">
          <h3 className="font-semibold text-base">Organizations</h3>
          <p className="text-muted-foreground text-sm">
            Manage your workspace organizations and settings.
          </p>
        </div>
        {/* Content */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent>
              {organizations.map((org) => (
                <div key={org.id}>
                  <div className="flex items-center justify-between gap-4 max-sm:flex-wrap">
                    <div className="flex items-center gap-4">
                      <img alt={org.name} className="h-8" src={org.img} />
                      <p className="text-muted-foreground text-sm">
                        <a
                          className="font-medium text-sky-600 hover:underline dark:text-sky-400"
                          href="#"
                        >
                          {org.name}
                        </a>{" "}
                        {org.description}
                      </p>
                    </div>
                    <Dialog>
                      <DialogTrigger
                        render={
                          <Button
                            className="border-destructive! text-destructive! hover:bg-destructive/10! focus-visible:ring-destructive/20 max-sm:w-full dark:focus-visible:ring-destructive/40"
                            variant="outline"
                          />
                        }
                      >
                        <Trash2Icon />
                        Leave
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader className="space-y-2">
                          <DialogTitle>Are you sure?</DialogTitle>
                          <div className="text-muted-foreground text-sm">
                            Are you sure you want to leave this organization?
                          </div>
                        </DialogHeader>
                        <div className="flex flex-col-reverse gap-4 sm:flex-row sm:justify-end">
                          <DialogClose render={<Button variant="outline" />}>
                            Cancel
                          </DialogClose>
                          <DialogClose
                            render={<Button variant="destructive" />}
                          >
                            Leave
                          </DialogClose>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {org !== organizations.at(-1) && (
                    <Separator className="my-4" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceOrganizations;
