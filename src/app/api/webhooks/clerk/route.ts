import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  console.log("Clerk webhook received", body.type);
  return NextResponse.json({ received: true });
}