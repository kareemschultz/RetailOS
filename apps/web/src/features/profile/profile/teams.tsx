// Third-party Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent, CardHeader } from "@RetailOS/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import { EllipsisVerticalIcon } from "lucide-react";
// Data Imports
import { db } from "@/features/profile/data";

interface TeamsProps {
  className?: string;
}

const { teamActions, teams } = db;

function Teams({ className }: TeamsProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex items-center justify-between">
        <span className="font-medium text-lg">Teams</span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                className="size-6 rounded-full text-muted-foreground"
                size="icon"
                variant="ghost"
              />
            }
          >
            <EllipsisVerticalIcon />
            <span className="sr-only">Menu</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuGroup>
              {teamActions.map((item, index) => (
                <DropdownMenuItem key={index}>{item}</DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        {teams.map((team) => (
          <div
            className="flex items-center justify-between gap-2"
            key={team.id}
          >
            <div className="flex items-center justify-between gap-4">
              <Avatar size="lg">
                {team.avatar ? (
                  <AvatarImage alt={team.teams} src={team.avatar} />
                ) : null}
                <AvatarFallback>{team.initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-base">{team.teams}</span>
                <span className="text-muted-foreground text-sm">
                  {team.totalMembers}
                </span>
              </div>
            </div>
            <Badge className="h-6 px-2 py-1" variant="outline">
              {team.teamBadge.label}
            </Badge>
          </div>
        ))}
      </CardContent>
      <CardContent>
        <Button className="w-full" variant="outline">
          View All Teams
        </Button>
      </CardContent>
    </Card>
  );
}

export default Teams;
