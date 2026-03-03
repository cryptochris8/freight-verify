import { NextResponse } from "next/server";
import { getVerificationStatus } from "@/app/actions/verification";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ loadId: string }> }
) {
  try {
    const { loadId } = await params;
    const status = await getVerificationStatus(loadId);

    if (!status.exists) {
      return NextResponse.json({ error: "No verification found" }, { status: 404 });
    }

    return NextResponse.json({
      loadReference: status.load?.referenceNumber,
      carrierName: status.carrierName,
      driverName: status.verification.driverName,
      verificationStatus: status.verification.verificationStatus,
      verifiedAt: status.verification.verifiedAt,
      geoLat: status.verification.geoLat,
      geoLng: status.verification.geoLng,
      geoTimestamp: status.verification.geoTimestamp,
      photoUrls: status.verification.photoUrls,
      events: status.events,
    });
  } catch (error) {
    console.error("Receipt fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
