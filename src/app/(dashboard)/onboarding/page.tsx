import { getOnboardingStatus } from "@/app/actions/onboarding";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const status = await getOnboardingStatus();

  if (status.isComplete) {
    redirect("/");
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <OnboardingWizard completedSteps={status.completedSteps} currentStep={status.currentStep} />
    </div>
  );
}
