import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { loadMessages, loads } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { messageCreateSchema } from "@/lib/validation/schemas";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, orgId } = await auth();
    if (!userId || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Validate load belongs to this org
    const [load] = await db.select({ id: loads.id }).from(loads)
      .where(and(eq(loads.id, id), eq(loads.orgId, orgId))).limit(1);
    if (!load) return NextResponse.json({ error: "Load not found" }, { status: 404 });

    const messages = await db
      .select()
      .from(loadMessages)
      .where(and(eq(loadMessages.loadId, id), eq(loadMessages.orgId, orgId)))
      .orderBy(asc(loadMessages.createdAt));

    return NextResponse.json(messages);
  } catch (error) {
    console.error("[MESSAGES GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, orgId } = await auth();
    if (!userId || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await currentUser();
    const body = await request.json();

    const parsed = messageCreateSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const msg = Object.values(errors).flat().join("; ") || "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { content } = parsed.data;

    // Verify load exists
    const [load] = await db.select().from(loads).where(eq(loads.id, id)).limit(1);
    if (!load) return NextResponse.json({ error: "Load not found" }, { status: 404 });

    const authorName = user ? (user.firstName + " " + (user.lastName || "")).trim() : "Unknown";

    const [message] = await db.insert(loadMessages).values({
      loadId: id,
      orgId,
      authorId: userId,
      authorName,
      authorType: "user",
      content: content.trim(),
    }).returning();

    return NextResponse.json({
      id: message.id,
      authorName: message.authorName,
      authorType: message.authorType,
      content: message.content,
      createdAt: message.createdAt?.toISOString() ?? new Date().toISOString(),
    });
  } catch (error) {
    console.error("[MESSAGES POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
