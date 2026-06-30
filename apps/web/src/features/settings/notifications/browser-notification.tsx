// Third-party Imports

// Component Imports
import { Checkbox } from "@RetailOS/ui/components/checkbox";
import { Label } from "@RetailOS/ui/components/label";
import { Switch } from "@RetailOS/ui/components/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@RetailOS/ui/components/tooltip";
import { CircleQuestionMarkIcon } from "lucide-react";

const BrowserNotification = () => {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      {/* Vertical Tabs List */}
      <div className="flex flex-col space-y-1">
        <h3 className="font-semibold text-base">Browser Notifications</h3>
        <p className="text-muted-foreground text-sm">
          Manage your browser notification settings and preferences.
        </p>
      </div>

      {/* Content */}
      <div className="space-y-4 lg:col-span-2">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <Checkbox id="assigned-to-you" />
            <Label
              className="font-medium text-sm leading-normal"
              htmlFor="assigned-to-you"
            >
              Assigned to You
            </Label>
          </div>
          <div className="flex items-center gap-4">
            <Checkbox id="unassigned" />
            <Label
              className="font-medium text-sm leading-normal"
              htmlFor="unassigned"
            >
              Unassigned
            </Label>
          </div>
          <div className="flex items-center gap-4">
            <Checkbox id="assigned-to-teams" />
            <Label
              className="font-medium text-sm leading-normal"
              htmlFor="assigned-to-teams"
            >
              Assigned to any of your teams
            </Label>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <p className="flex items-center gap-1 font-medium text-sm">
            Play sound when your tab blinks
            <Tooltip>
              <TooltipTrigger
                render={<CircleQuestionMarkIcon className="size-4" />}
              />
              <TooltipContent>
                <p>Play sound on alert</p>
              </TooltipContent>
            </Tooltip>
          </p>
          <Switch className="cursor-pointer" />
        </div>
      </div>
    </div>
  );
};

export default BrowserNotification;
