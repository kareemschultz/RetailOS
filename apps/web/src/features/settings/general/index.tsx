// Component Imports
import { Separator } from "@RetailOS/ui/components/separator";

// Component Imports
import ConnectAccount from "@/features/settings/general/connect-account";
import DangerZone from "@/features/settings/general/danger-zone";
import EmailPass from "@/features/settings/general/email-password";
import PersonalInfo from "@/features/settings/general/personal-info";
import SocialUrl from "@/features/settings/general/social-url";

const UserGeneral = () => (
  <section className="py-3">
    <PersonalInfo />
    <Separator className="my-10" />
    <EmailPass />
    <Separator className="my-10" />
    <ConnectAccount />
    <Separator className="my-10" />
    <SocialUrl />
    <Separator className="my-10" />
    <DangerZone />
  </section>
);

export default UserGeneral;
