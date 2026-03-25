import { NextResponse } from "next/server";
import { getVerificationStatus, generateVerification } from "@/app/actions/verification";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const status = await getVerificationStatus(id);
    return NextResponse.json(status);
  } catch (error) {
    logger.error("VERIFICATION", "GET request failed", { error: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await generateVerification(id);
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    logger.error("VERIFICATION", "Generate verification failed", { error: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
