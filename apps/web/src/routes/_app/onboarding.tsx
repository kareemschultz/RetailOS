import { createFileRoute } from "@tanstack/react-router";

import OnboardingFeed from "@/features/onboarding/onboarding-feed";

export const Route = createFileRoute("/_app/onboarding")({
  component: OnboardingScreen,
});

function OnboardingScreen() {
  return <OnboardingFeed />;
}
