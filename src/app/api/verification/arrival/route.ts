import { NextResponse } from "next/server";
import { recordArrival } from "@/app/actions/verification";
import { arrivalSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parsed = arrivalSchema.safeParse({
      loadId: body.loadId,
      lat: body.lat !== undefined ? parseFloat(body.lat) : undefined,
      lng: body.lng !== undefined ? parseFloat(body.lng) : undefined,
      accuracy: body.accuracy !== undefined ? parseFloat(body.accuracy) : 0,
    });

    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const msg = Object.values(errors).flat().join("; ") || "Invalid input";
      return NextResponse.json({ success: false, message: msg }, { status: 400 });
    }

    const { loadId, lat, lng, accuracy } = parsed.data;

    const result = await recordArrival(loadId, {
      lat,
      lng,
      accuracy,
      timestamp: Date.now(),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Arrival recording error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
