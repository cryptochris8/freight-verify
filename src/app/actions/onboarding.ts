"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { onboardingProgress, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const ONBOARDING_STEPS = [
  "welcome",
  "add-carrier",
  "create-load",
  "verification-overview",
  "complete",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export async function getOnboardingStatus() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { isComplete: true, completedSteps: [], currentStep: 0 };
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkOrgId, orgId))
    .limit(1);

  if (!org) {
    return { isComplete: false, completedSteps: [], currentStep: 0 };
  }

  const [progress] = await db
    .select()
    .from(onboardingProgress)
    .where(eq(onboardingProgress.orgId, org.id))
    .limit(1);

  if (!progress) {
    return { isComplete: false, completedSteps: [] as string[], currentStep: 0 };
  }

  const completedSteps = (progress.completedSteps ?? []) as string[];
  const currentStep = completedSteps.length;

  return {
    isComplete: progress.isComplete ?? false,
    completedSteps,
    currentStep,
  };
}

export async function completeStep(step: OnboardingStep) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { success: false as const, error: "Unauthorized" };
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkOrgId, orgId))
    .limit(1);

  if (!org) {
    return { success: false as const, error: "Organization not found" };
  }

  const [existing] = await db
    .select()
    .from(onboardingProgress)
    .where(eq(onboardingProgress.orgId, org.id))
    .limit(1);

  const currentSteps = (existing?.completedSteps ?? []) as string[];

  if (!currentSteps.includes(step)) {
    currentSteps.push(step);
  }

  if (existing) {
    await db
      .update(onboardingProgress)
      .set({
        completedSteps: currentSteps,
        updatedAt: new Date(),
      })
      .where(eq(onboardingProgress.orgId, org.id));
  } else {
    await db.insert(onboardingProgress).values({
      orgId: org.id,
      userId,
      completedSteps: currentSteps,
    });
  }

  revalidatePath("/onboarding");
  return { success: true as const, completedSteps: currentSteps };
}

export async function markOnboardingComplete() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { success: false as const, error: "Unauthorized" };
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkOrgId, orgId))
    .limit(1);

  if (!org) {
    return { success: false as const, error: "Organization not found" };
  }

  const [existing] = await db
    .select()
    .from(onboardingProgress)
    .where(eq(onboardingProgress.orgId, org.id))
    .limit(1);

  if (existing) {
    await db
      .update(onboardingProgress)
      .set({ isComplete: true, updatedAt: new Date() })
      .where(eq(onboardingProgress.orgId, org.id));
  } else {
    await db.insert(onboardingProgress).values({
      orgId: org.id,
      userId,
      completedSteps: ONBOARDING_STEPS as unknown as string[],
      isComplete: true,
    });
  }

  revalidatePath("/onboarding");
  revalidatePath("/");
  return { success: true as const };
}
