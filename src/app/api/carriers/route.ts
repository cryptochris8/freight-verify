import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { carrierCreateSchema } from "@/lib/validation/schemas";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  return NextResponse.json({ carriers: [] });
}

export async function POST(request: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 30 per minute per org
    const rl = rateLimit(`carriers:${orgId}`, 30, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before adding more carriers." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const parsed = carrierCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Carrier creation endpoint", data: parsed.data },
      { status: 201 }
    );
  } catch (error) {
    console.error("[CARRIERS POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
