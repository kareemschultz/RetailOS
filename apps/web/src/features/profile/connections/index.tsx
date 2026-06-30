// Third-party Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
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
import { Separator } from "@RetailOS/ui/components/separator";
import {
  EllipsisVerticalIcon,
  MailIcon,
  UserPlus2Icon,
  UserRoundCheckIcon,
} from "lucide-react";

// Data Imports
import { db } from "@/features/profile/data";

const { connectionCardActions, connectionCards } = db;

function ConnectionsCard() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {connectionCards.map((connection) => (
        <Card
          className="relative flex flex-col items-center justify-center transition-all hover:-translate-y-0.5 hover:shadow-md"
          key={connection.id}
        >
          <div className="absolute top-4 right-4 z-10">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    className="size-8 rounded-full text-muted-foreground"
                    size="icon"
                    variant="ghost"
                  />
                }
              >
                <EllipsisVerticalIcon className="size-4" />
                <span className="sr-only">Open {connection.name} actions</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuGroup>
                  {connectionCardActions.map((action) => (
                    <DropdownMenuItem
                      key={action}
                      variant={action === "Delete" ? "destructive" : "default"}
                    >
                      {action}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <CardContent>
            <Avatar className="size-25">
              {connection.avatar ? (
                <AvatarImage alt={connection.name} src={connection.avatar} />
              ) : null}
              <AvatarFallback>{connection.initials}</AvatarFallback>
            </Avatar>
          </CardContent>

          <CardContent className="text-center">
            <h3 className="font-medium text-xl">{connection.name}</h3>
            <p className="text-base text-muted-foreground">{connection.role}</p>
          </CardContent>

          <CardContent className="flex flex-wrap items-center justify-center gap-2">
            {connection.tags.map((tag) => (
              <Badge
                className="h-6 px-3 py-1"
                key={`${connection.id}-${tag.label}`}
                variant="outline"
              >
                {tag.label}
              </Badge>
            ))}
          </CardContent>

          <CardContent className="flex w-full items-center justify-evenly gap-4">
            <div className="text-center">
              <p className="font-medium text-lg">{connection.stats.projects}</p>
              <p className="text-base text-muted-foreground">Projects</p>
            </div>
            <Separator orientation="vertical" />
            <div className="text-center">
              <p className="font-medium text-lg">{connection.stats.tasks}</p>
              <p className="text-base text-muted-foreground">Tasks</p>
            </div>
            <Separator orientation="vertical" />
            <div className="text-center">
              <p className="font-medium text-lg">
                {connection.stats.connections}
              </p>
              <p className="text-base text-muted-foreground">Connections</p>
            </div>
          </CardContent>

          <CardContent className="flex items-center gap-4">
            <Button variant={connection.isConnected ? "default" : "outline"}>
              {connection.isConnected ? (
                <UserRoundCheckIcon />
              ) : (
                <UserPlus2Icon />
              )}
              {connection.isConnected ? "Connected" : "Connect"}
            </Button>
            <Button size="icon" variant="outline">
              <MailIcon />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default ConnectionsCard;
