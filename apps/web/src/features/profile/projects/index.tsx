// Third-party Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import { Progress } from "@RetailOS/ui/components/progress";
import { Separator } from "@RetailOS/ui/components/separator";
import { EllipsisVerticalIcon, MessageCircleMoreIcon } from "lucide-react";

// Data Imports
import { db } from "@/features/profile/data";

const { projectCardActions, projectCards } = db;

function ProjectsCard() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {projectCards.map((project) => (
        <Card
          className="h-full min-h-84 justify-between transition-all hover:-translate-y-0.5 hover:shadow-md"
          key={project.id}
        >
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex items-center justify-center rounded-full border bg-background p-1">
                  <img
                    alt={project.title}
                    className="size-7 rounded-full dark:hidden"
                    src={project.logo}
                  />
                  <img
                    alt={project.title}
                    className="hidden size-7 rounded-full dark:block"
                    src={project.logoDark}
                  />
                </div>

                <div>
                  <h3 className="font-medium text-base">{project.title}</h3>
                  <p className="text-muted-foreground text-sm">
                    Client: {project.client}
                  </p>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      className="rounded-full text-muted-foreground"
                      size="icon-sm"
                      variant="ghost"
                    />
                  }
                >
                  <EllipsisVerticalIcon className="size-4" />
                  <span className="sr-only">Open {project.title} actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-34">
                  <DropdownMenuGroup>
                    {projectCardActions.map((action) => (
                      <DropdownMenuItem
                        key={`${project.id}-${action}`}
                        variant={
                          action === "Delete" ? "destructive" : "default"
                        }
                      >
                        {action}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="rounded-md bg-muted px-3 py-2">
                <p className="font-medium text-sm">
                  {project.budgetSpent}
                  <span className="font-medium text-muted-foreground">
                    /{project.budgetTotal}
                  </span>
                </p>
                <p className="text-muted-foreground text-sm">Total Budget</p>
              </div>

              <div className="space-y-0.5 pt-0.5">
                <p>
                  <span className="font-medium text-sm">Start Date: </span>
                  {project.startDate}
                </p>
                <p>
                  <span className="font-medium text-sm">Deadline: </span>
                  {project.deadline}
                </p>
              </div>
            </div>

            <p className="text-base text-muted-foreground">
              {project.description}
            </p>
          </CardContent>
          <Separator />

          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-sm">
                All Hours:{" "}
                <span className="font-medium text-muted-foreground">
                  {project.allHours}
                </span>
              </p>
              <Badge variant="outline">{project.daysLeftLabel}</Badge>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-sm">
                Tasks: {project.tasks}
              </p>
              <p className="text-muted-foreground text-sm">
                {project.completion}% Completed
              </p>
            </div>

            <Progress
              className="*:data-[slot=progress-track]:h-2 *:data-[slot=progress-track]:bg-primary/20"
              value={project.completion}
            />
          </CardContent>

          <CardContent className="flex items-center justify-between text-muted-foreground">
            <div className="flex items-center gap-3">
              <AvatarGroup className="-space-x-3 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background">
                {project.members.map((member) => (
                  <Avatar key={`${project.id}-${member.name}`} size="sm">
                    {member.avatar ? (
                      <AvatarImage alt={member.name} src={member.avatar} />
                    ) : null}
                    <AvatarFallback>{member.initials}</AvatarFallback>
                  </Avatar>
                ))}
              </AvatarGroup>
              <span className="text-sm">{project.membersLabel}</span>
            </div>

            <div className="flex items-center gap-1 text-sm">
              <MessageCircleMoreIcon className="size-4.5" />
              <span>{project.commentsCount}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default ProjectsCard;
