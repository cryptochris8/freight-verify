import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import { organizations, onboardingProgress, subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
    console.error("CLERK_WEBHOOK_SECRET is not set");
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
    console.error("Clerk webhook signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "organization.created": {
        const org = event.data;
        await db.insert(organizations).values({
          clerkOrgId: org.id,
          name: org.name,
          plan: "starter",
          verifiedLoadsLimit: 50,
        });
        console.log(`[CLERK] Organization created: ${org.name} (${org.id})`);
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
        console.log(`[CLERK] Organization updated: ${org.name} (${org.id})`);
        break;
      }

      case "organization.deleted": {
        const org = event.data;
        const [existing] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.clerkOrgId, org.id))
          .limit(1);

        if (existing) {
          await db
            .delete(subscriptions)
            .where(eq(subscriptions.orgId, existing.id));
          await db
            .delete(onboardingProgress)
            .where(eq(onboardingProgress.orgId, existing.id));
          await db
            .delete(organizations)
            .where(eq(organizations.clerkOrgId, org.id));
        }
        console.log(`[CLERK] Organization deleted: ${org.id}`);
        break;
      }

      default:
        console.log(`[CLERK] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`[CLERK] Error processing webhook ${event.type}:`, error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
