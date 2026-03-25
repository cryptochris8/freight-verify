import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import {
  organizations, onboardingProgress, subscriptions,
  carriers, loads, loadEvents, alerts, auditLog,
  carrierDocuments, carrierVerifications, pickupVerifications,
  loadDocuments, loadMessages,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

interface ClerkOrganizationData {
  id: string;
  name: string;
  slug: string | null;
  created_at: number;
  updated_at: number;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkOrganizationData;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error("CLERK", "CLERK_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const headersList = await headers();
  const svixId = headersList.get("svix-id");
  const svixTimestamp = headersList.get("svix-timestamp");
  const svixSignature = headersList.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await request.text();

  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("CLERK", "Webhook signature verification failed", { error: message });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "organization.created": {
        const org = event.data;
        // Upsert to handle Clerk webhook retries idempotently
        const [existingOrg] = await db.select({ id: organizations.id })
          .from(organizations).where(eq(organizations.clerkOrgId, org.id)).limit(1);
        if (!existingOrg) {
          await db.insert(organizations).values({
            clerkOrgId: org.id,
            name: org.name,
            plan: "starter",
            verifiedLoadsLimit: 50,
          });
          logger.info("CLERK", "Organization created", { name: org.name, clerkOrgId: org.id });
        } else {
          logger.info("CLERK", "Organization already exists, skipping", { clerkOrgId: org.id });
        }
        break;
      }

      case "organization.updated": {
        const org = event.data;
        await db
          .update(organizations)
          .set({
            name: org.name,
            updatedAt: new Date(),
          })
          .where(eq(organizations.clerkOrgId, org.id));
        logger.info("CLERK", "Organization updated", { name: org.name, clerkOrgId: org.id });
        break;
      }

      case "organization.deleted": {
        const org = event.data;
        const [existing] = await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.clerkOrgId, org.id))
          .limit(1);

        if (existing) {
          // Delete all org-owned data in dependency order to avoid FK violations.
          // Child tables first, then parent tables, then the org itself.
          await db.delete(loadMessages).where(eq(loadMessages.orgId, existing.id));
          await db.delete(loadDocuments).where(eq(loadDocuments.orgId, existing.id));
          await db.delete(pickupVerifications).where(eq(pickupVerifications.orgId, existing.id));
          await db.delete(loadEvents).where(eq(loadEvents.orgId, existing.id));
          await db.delete(alerts).where(eq(alerts.orgId, existing.id));
          await db.delete(auditLog).where(eq(auditLog.orgId, existing.id));
          await db.delete(carrierDocuments).where(eq(carrierDocuments.orgId, existing.id));
          await db.delete(carrierVerifications).where(eq(carrierVerifications.orgId, existing.id));
          await db.delete(loads).where(eq(loads.orgId, existing.id));
          await db.delete(carriers).where(eq(carriers.orgId, existing.id));
          await db.delete(subscriptions).where(eq(subscriptions.orgId, existing.id));
          await db.delete(onboardingProgress).where(eq(onboardingProgress.orgId, existing.id));
          await db.delete(organizations).where(eq(organizations.id, existing.id));
        }
        logger.info("CLERK", "Organization deleted", { clerkOrgId: org.id });
        break;
      }

      default:
        logger.info("CLERK", "Unhandled event type", { eventType: event.type });
    }
  } catch (error) {
    logger.error("CLERK", "Webhook processing failed", { eventType: event.type, error: String(error) });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
