// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { Separator } from "@RetailOS/ui/components/separator";

import Notifications from "@/features/settings/notifications/all-notifications";
import BrowserNotification from "@/features/settings/notifications/browser-notification";
import DoNotDisturb from "@/features/settings/notifications/do-not-disturb";
import InboxPrefrence from "@/features/settings/notifications/inbox-preference";

const NotificationsPage = () => (
  <div>
    <Notifications />
    <Separator className="my-10" />
    <InboxPrefrence />
    <Separator className="my-10" />
    <BrowserNotification />
    <Separator className="my-10" />
    <DoNotDisturb />
    <div className="mt-6 flex justify-end">
      <Button className="max-sm:w-full" type="submit">
        Save Changes
      </Button>
    </div>
  </div>
);

export default NotificationsPage;
