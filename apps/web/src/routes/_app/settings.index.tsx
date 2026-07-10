import { Card, CardContent } from "@RetailOS/ui/components/card";
import { PageBody, PageHeader } from "@RetailOS/ui/components/page-header";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  ChevronRight,
  Hash,
  Palette,
  Percent,
  ScrollText,
  Settings2,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

export const Route = createFileRoute("/_app/settings/")({
  component: SettingsScreen,
});

const SETTINGS_AREAS: Array<{
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
}> = [
  {
    description:
      "Companies and the stores, warehouses, and bonded locations under them.",
    href: "/settings/companies",
    icon: Building2,
    title: "Companies & structure",
  },
  {
    description:
      "Sales tax (VAT) rates applied at the register and online checkout.",
    href: "/settings/tax",
    icon: Percent,
    title: "Tax rates",
  },
  {
    description:
      "Receipt and invoice number ranges — tamper-evident, per company.",
    href: "/settings/numbering",
    icon: Hash,
    title: "Document numbering",
  },
  {
    description:
      "White-label the app — name, logo, brand color, and login page. Applies instantly across every screen.",
    href: "/settings/branding",
    icon: Palette,
    title: "White-label & branding",
  },
  {
    description: "Who can sign in and what each role is allowed to do.",
    href: "/staff",
    icon: Users,
    title: "Staff & access",
  },
  {
    description: "The immutable record of every change made in the system.",
    href: "/audit-log",
    icon: ScrollText,
    title: "Audit trail",
  },
];

function SettingsScreen() {
  return (
    <PageBody className="mx-auto w-full max-w-5xl p-6">
      <PageHeader
        description="Business setup and administration. Changes here apply to the whole business."
        title={
          <span className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Settings2 className="size-5" />
            </span>
            Settings
          </span>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {SETTINGS_AREAS.map((area) => (
          <Link key={area.href} to={area.href}>
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/40">
              <CardContent className="flex items-start gap-4 p-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <area.icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 font-medium">
                    {area.title}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {area.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </PageBody>
  );
}
