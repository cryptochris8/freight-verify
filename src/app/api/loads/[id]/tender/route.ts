import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { tenderLoad } from "@/app/actions/loads";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 5 per minute per org
    const rl = rateLimit(`tender:${orgId}`, 5, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many tender requests. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } }
      );
    }

    const result = await tenderLoad(id, orgId, userId);

    if (!result.success) {
      return NextResponse.json({ error: "error" in result ? result.error : "Tender failed" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      tenderToken: "tenderToken" in result ? result.tenderToken : null,
    });
  } catch (error) {
    console.error("[TENDER]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
