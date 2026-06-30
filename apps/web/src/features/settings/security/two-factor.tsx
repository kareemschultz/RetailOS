// Third-party Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import { CircleAlertIcon } from "lucide-react";

import VerifyDialog from "@/features/settings/security/dialog-verify";

const TwoFactor = () => {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      {/* Vertical Tabs List */}
      <div className="flex flex-col space-y-1">
        <h3 className="font-semibold text-base">Two Factor Authentication</h3>
        <p className="text-muted-foreground text-sm">
          Manage Two Factor Authentication (2FA) settings.
        </p>
      </div>

      {/* Content */}
      <div className="space-y-6 lg:col-span-2">
        {/* Enable Two Factor Authentication */}
        <Card>
          <CardContent className="flex items-center gap-2">
            <CircleAlertIcon className="size-4" />
            <h4 className="font-medium text-sm">
              You have not enabled Two Factor Authentication
            </h4>
          </CardContent>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              When you enable Two Factor Authentication, you will be required to
              provide a second form of verification during the login process,
              adding an extra layer of security to your account.
            </p>
            <VerifyDialog
              trigger={
                <Button className="max-sm:w-full">
                  Enable Two Factor Authentication
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TwoFactor;
