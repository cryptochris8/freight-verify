import { NextResponse } from "next/server";
import { getVerificationStatus, generateVerification } from "@/app/actions/verification";
import { logger } from "@/lib/logger";
import { validateDriverTokenForLoad } from "@/lib/auth/driver-token";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Check if the request has valid auth — either Clerk (broker) or driver token.
 */
async function isAuthorized(request: Request, loadId: string): Promise<boolean> {
  // Try driver token first
  const load = await validateDriverTokenForLoad(request, loadId);
  if (load) return true;

  // Try Clerk auth (broker)
  try {
    const { orgId: clerkOrgId } = await auth();
    if (!clerkOrgId) return false;
    const [org] = await db.select({ id: organizations.id }).from(organizations)
      .where(eq(organizations.clerkOrgId, clerkOrgId)).limit(1);
    return !!org;
  } catch {
    return false;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!(await isAuthorized(request, id))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await getVerificationStatus(id);
    return NextResponse.json(status);
  } catch (error) {
    logger.error("VERIFICATION", "GET request failed", { error: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!(await isAuthorized(request, id))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await generateVerification(id);
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    logger.error("VERIFICATION", "Generate verification failed", { error: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
