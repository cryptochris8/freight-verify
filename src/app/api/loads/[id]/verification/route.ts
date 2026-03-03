import { NextResponse } from "next/server";
import { getVerificationStatus, generateVerification } from "@/app/actions/verification";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const status = await getVerificationStatus(id);
    return NextResponse.json(status);
  } catch (error) {
    console.error("Get verification error:", error);
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
    console.error("Generate verification error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
