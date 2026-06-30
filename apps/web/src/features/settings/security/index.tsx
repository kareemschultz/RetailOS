// Component Import
import { Separator } from "@RetailOS/ui/components/separator";
import Sessions from "@/features/settings/security/all-sessions";
import ApiKey from "@/features/settings/security/api-key";
import TwoFactor from "@/features/settings/security/two-factor";
import type { Session } from "@/features/settings/types";

interface SecurityProps {
  sessionsData: Session[];
}

function Security({ sessionsData }: SecurityProps) {
  return (
    <section className="py-3">
      <TwoFactor />
      <Separator className="my-10" />
      <ApiKey />
      <Separator className="my-10" />
      <Sessions initialSessions={sessionsData} />
    </section>
  );
}

export default Security;
