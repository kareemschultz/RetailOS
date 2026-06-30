// Third-party Imports

// Components Imports
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
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
import {
  EllipsisVerticalIcon,
  UserIcon,
  UserRoundCheckIcon,
} from "lucide-react";
// Data Imports
import { db } from "@/features/profile/data";

interface ConnectionsProps {
  className?: string;
}

const { connectionActions, connections } = db;

function Connections({ className }: ConnectionsProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex items-center justify-between">
        <span className="font-medium text-lg">Connections</span>
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
              {connectionActions.map((item, index) => (
                <DropdownMenuItem key={index}>{item}</DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        {connections.map((connection) => (
          <div
            className="flex items-center justify-between gap-2"
            key={connection.id}
          >
            <div className="flex items-center justify-between gap-4">
              <Avatar size="lg">
                {connection.avatar ? (
                  <AvatarImage alt={connection.name} src={connection.avatar} />
                ) : null}
                <AvatarFallback>{connection.initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-base">{connection.name}</span>
                <span className="text-muted-foreground text-sm">
                  {connection.totalConnections}
                </span>
              </div>
            </div>
            <Button
              size="icon"
              variant={connection.isConnected ? "default" : "outline"}
            >
              {connection.isConnected ? <UserRoundCheckIcon /> : <UserIcon />}
            </Button>
          </div>
        ))}
      </CardContent>
      <CardContent>
        <Button className="w-full" variant="outline">
          View All Connections
        </Button>
      </CardContent>
    </Card>
  );
}

export default Connections;
