import { Avatar, AvatarImage } from "@RetailOS/ui/components/avatar";
import { BackgroundRippleEffect } from "@RetailOS/ui/components/background-ripple";
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";
import {
  BriefcaseBusinessIcon,
  CalendarDaysIcon,
  MapPinIcon,
  UserRoundCheckIcon,
} from "lucide-react";

import UserProfileTabs from "@/features/profile/user-profile-tabs";

export const Route = createFileRoute("/_app/profile")({
  component: UserProfileScreen,
});

function UserProfileScreen() {
  return (
    <div>
      <div className="mb-4 md:mb-6 lg:mb-10">
        <Card className="py-0 pb-6">
          <div className="relative h-44 overflow-hidden bg-muted">
            <div className="absolute inset-0">
              <BackgroundRippleEffect
                activeSquares={18}
                cellSize={45}
                rows={8}
              />
            </div>
          </div>

          <CardContent>
            <div className="flex items-end gap-4 pb-1 max-md:flex-col max-md:items-center md:flex-nowrap md:gap-6">
              <Avatar className="z-3 -mt-12 size-28 rounded-md ring-4 ring-card after:rounded-[inherit] md:-mt-14">
                <AvatarImage
                  alt="John Doe"
                  className="rounded-[inherit]"
                  src="/images/avatars/avatar-1.webp"
                />
              </Avatar>

              <div className="min-w-0 flex-1 space-y-2 text-center md:text-left">
                <h2 className="font-medium text-2xl">John Doe</h2>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-muted-foreground max-md:justify-center">
                  <span className="inline-flex items-center gap-2">
                    <BriefcaseBusinessIcon className="size-4.5" />
                    UX Designer
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <MapPinIcon className="size-4.5" />
                    India
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <CalendarDaysIcon className="size-4.5" />
                    April 2021
                  </span>
                </div>
              </div>

              <Button className="md:ml-auto md:self-end">
                <UserRoundCheckIcon className="size-4" />
                Connected
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <UserProfileTabs />
    </div>
  );
}
