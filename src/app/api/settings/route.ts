import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { organizations, auditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

const updateSettingsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  digestEnabled: z.boolean().optional(),
  digestRecipientEmails: z.array(z.email()).max(10).optional(),
});

export async function GET() {
  try {
    const { orgId: clerkOrgId } = await auth();
    if (!clerkOrgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clerkOrgId, clerkOrgId))
      .limit(1);

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({
      name: org.name,
      plan: org.plan,
      digestEnabled: org.digestEnabled,
      digestRecipientEmails: org.digestRecipientEmails ?? [],
    });
  } catch (error) {
    console.error("[SETTINGS GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId, orgId: clerkOrgId } = await auth();
    if (!userId || !clerkOrgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clerkOrgId, clerkOrgId))
      .limit(1);

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.digestEnabled !== undefined) updates.digestEnabled = parsed.data.digestEnabled;
    if (parsed.data.digestRecipientEmails !== undefined) updates.digestRecipientEmails = parsed.data.digestRecipientEmails;

    await db.update(organizations).set(updates).where(eq(organizations.id, org.id));

    await db.insert(auditLog).values({
      orgId: org.id,
      entityType: "organization",
      entityId: org.id,
      action: "settings_updated",
      actorId: userId,
      actorType: "user",
      metadata: parsed.data,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SETTINGS PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
