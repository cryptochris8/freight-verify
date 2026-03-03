"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Check, Truck, Package, Shield, ArrowRight, SkipForward, PartyPopper } from "lucide-react";
import { completeStep, markOnboardingComplete } from "@/app/actions/onboarding";
import Link from "next/link";

interface OnboardingWizardProps {
  completedSteps: string[];
  currentStep: number;
}

const steps = [
  { id: "welcome", title: "Welcome to FreightVerify", icon: PartyPopper, description: "Your freight verification platform is ready. Let us help you get started with a quick setup." },
  { id: "add-carrier", title: "Add Your First Carrier", icon: Truck, description: "Enter a DOT number to auto-verify a carrier through FMCSA. This ensures you are working with authorized carriers.", actionLabel: "Add Carrier", actionHref: "/carriers/new" },
  { id: "create-load", title: "Create Your First Load", icon: Package, description: "Create a load with origin, destination, and carrier assignment. This is the foundation of freight verification.", actionLabel: "Create Load", actionHref: "/loads/new" },
  { id: "verification-overview", title: "Pickup Verification", icon: Shield, description: "When a driver arrives for pickup, generate a one-time code. The driver enters the code along with GPS and photos to create tamper-proof chain of custody." },
  { id: "complete", title: "You are Ready!", icon: Check, description: "Your FreightVerify platform is set up. Start verifying carriers and loads to protect your freight." },
];

export function OnboardingWizard({ completedSteps, currentStep }: OnboardingWizardProps) {
  const [step, setStep] = useState(currentStep);
  const [isPending, startTransition] = useTransition();
  const totalSteps = steps.length;
  const progress = (step / (totalSteps - 1)) * 100;
  const current = steps[step];

  const handleNext = () => {
    startTransition(async () => {
      await completeStep(current.id as any);
      if (step === totalSteps - 1) {
        await markOnboardingComplete();
        window.location.href = "/";
      } else {
        setStep(step + 1);
      }
    });
  };

  const handleSkip = () => {
    startTransition(async () => {
      await completeStep(current.id as any);
      if (step < totalSteps - 1) { setStep(step + 1); }
    });
  };

  const handleFinish = () => {
    startTransition(async () => {
      await markOnboardingComplete();
      window.location.href = "/";
    });
  };

  const Icon = current.icon;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{"Step " + (step + 1) + " of " + totalSteps}</p>
          <Badge variant="outline">{Math.round(progress)}% complete</Badge>
        </div>
        <Progress value={progress} />
      </div>

      <Card>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto rounded-full bg-primary/10 p-4 mb-4">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">{current.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground">{current.description}</p>

          {current.actionLabel && current.actionHref && (
            <Link href={current.actionHref}>
              <Button variant="outline" className="gap-2">{current.actionLabel} <ArrowRight className="h-4 w-4" /></Button>
            </Link>
          )}

          <div className="flex items-center justify-center gap-3 pt-4">
            {step < totalSteps - 1 && step > 0 && (
              <Button variant="ghost" size="sm" onClick={handleSkip} disabled={isPending} className="gap-1">
                <SkipForward className="h-4 w-4" /> Skip
              </Button>
            )}
            {step < totalSteps - 1 ? (
              <Button onClick={handleNext} disabled={isPending} className="gap-2">
                {isPending ? "Saving..." : "Continue"} <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={isPending} size="lg" className="gap-2">
                {isPending ? "Finishing..." : "Go to Dashboard"} <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className={"h-2 w-8 rounded-full transition-colors " + (i <= step ? "bg-primary" : "bg-muted")} />
        ))}
      </div>
    </div>
  );
}
