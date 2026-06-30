// Third-party Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
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
import { EllipsisVerticalIcon, StarIcon } from "lucide-react";

// Data Imports
import { db } from "@/features/profile/data";

const { teamCardActions, teamCards } = db;

function TeamsCard() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {teamCards.map((team) => (
        <Card
          className="transition-all hover:-translate-y-0.5 hover:shadow-md"
          key={team.id}
        >
          <CardContent className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex items-center justify-center rounded-full border bg-background p-1">
                <img
                  alt={team.title}
                  className="size-7 rounded-full dark:hidden"
                  src={team.avatar}
                />
                <img
                  alt={team.title}
                  className="hidden size-7 rounded-full dark:block"
                  src={team.avatarDark}
                />
              </div>
              <h3 className="font-medium text-base">{team.title}</h3>
            </div>

            <div className="flex items-center">
              <Button
                className="text-muted-foreground"
                size="icon"
                variant="ghost"
              >
                <StarIcon className="size-4" />
                <span className="sr-only">Favorite {team.title}</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      className="rounded-full text-muted-foreground"
                      size="icon"
                      variant="ghost"
                    />
                  }
                >
                  <EllipsisVerticalIcon className="size-4" />
                  <span className="sr-only">Open {team.title} actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuGroup>
                    {teamCardActions.map((action) => (
                      <DropdownMenuItem
                        key={action}
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
          </CardContent>
          <CardContent>
            <p className="text-base text-muted-foreground">
              {team.description}
            </p>
          </CardContent>

          <CardContent className="mt-auto flex items-center justify-between gap-4">
            <AvatarGroup className="-space-x-3 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background">
              {team.members.map((member) => (
                <Avatar key={`${team.id}-${member.name}`}>
                  {member.avatar ? (
                    <AvatarImage alt={member.name} src={member.avatar} />
                  ) : null}
                  <AvatarFallback>{member.initials}</AvatarFallback>
                </Avatar>
              ))}
              {team.extraMembersCount ? (
                <AvatarGroupCount>+{team.extraMembersCount}</AvatarGroupCount>
              ) : null}
            </AvatarGroup>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {team.tags.map((tag) => (
                <Badge
                  className="h-6 px-3 py-1"
                  key={`${team.id}-${tag.label}`}
                  variant="outline"
                >
                  {tag.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default TeamsCard;
