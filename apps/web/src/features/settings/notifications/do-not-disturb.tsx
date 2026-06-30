// React Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
import { Separator } from "@RetailOS/ui/components/separator";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@RetailOS/ui/components/toggle-group";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
// Third-party Imports
import { BellIcon, BellOffIcon } from "lucide-react";
import { useState } from "react";

const DoNotDisturb = () => {
  const [isDark, setIsDark] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      {/* Vertical Tabs List */}
      <div className="flex flex-col space-y-1">
        <h3 className="font-semibold text-base">Do Not Disturb</h3>
        <p className="text-muted-foreground text-sm">
          Adjust your Do Not Disturb settings and preferences.
        </p>
      </div>

      {/* Content */}
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-3">
              <Label className="px-1">Notifications</Label>
              <Button
                aria-label="Toggle dark mode"
                className={cn(
                  isDark
                    ? "border-sky-600 text-sky-600! hover:bg-sky-600/10 focus-visible:border-sky-600 focus-visible:ring-sky-600/20 dark:border-sky-400 dark:text-sky-400! dark:focus-visible:border-sky-400 dark:focus-visible:ring-sky-400/40 dark:hover:bg-sky-400/10"
                    : ""
                )}
                onClick={() => setIsDark(!isDark)}
                variant="outline"
              >
                {isDark ? <BellOffIcon /> : <BellIcon />}
                {isDark ? "Disable Notifications" : "Enable Notifications"}
              </Button>
            </div>
            <div className="flex gap-4">
              <div className="flex flex-col gap-3">
                <Label className="px-1" htmlFor="time-from">
                  From
                </Label>
                <Input
                  className="appearance-none max-sm:text-sm [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  defaultValue="01:30:00"
                  id="time-from"
                  step="1"
                  type="time"
                />
              </div>
              <div className="flex flex-col gap-3">
                <Label className="px-1" htmlFor="time-to">
                  To
                </Label>
                <Input
                  className="appearance-none max-sm:text-sm [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  defaultValue="02:30:00"
                  id="time-to"
                  step="1"
                  type="time"
                />
              </div>
            </div>
          </CardContent>
          <CardContent>
            <Separator />
          </CardContent>
          <CardContent className="flex w-full flex-col gap-3">
            <Label className="px-1">Do not disturb me on my days off</Label>
            <div className="col-span-2 md:col-span-3">
              <ToggleGroup
                className="gap-2 *:aria-[pressed=true]:bg-primary! *:aria-[pressed=true]:text-primary-foreground *:data-[slot=toggle-group-item]:rounded-full! *:data-[slot=toggle-group-item]:bg-muted"
                defaultValue={["saturday"]}
                multiple
              >
                <ToggleGroupItem value="sunday">S</ToggleGroupItem>
                <ToggleGroupItem value="monday">M</ToggleGroupItem>
                <ToggleGroupItem value="tuesday">T</ToggleGroupItem>
                <ToggleGroupItem value="wednesday">W</ToggleGroupItem>
                <ToggleGroupItem value="thursday">T</ToggleGroupItem>
                <ToggleGroupItem value="friday">F</ToggleGroupItem>
                <ToggleGroupItem value="saturday">S</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DoNotDisturb;
