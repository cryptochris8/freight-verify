import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { uploadPhoto } from "@/app/actions/verification";
import { db } from "@/lib/db";
import { loads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const loadId = formData.get("loadId") as string;
    const photoType = formData.get("photoType") as string;
    const file = formData.get("file") as File | null;

    if (!loadId || !photoType) {
      return NextResponse.json({ success: false, error: "loadId and photoType are required" }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    // Validate load exists and belongs to a known org
    const [load] = await db.select({ id: loads.id, orgId: loads.orgId }).from(loads).where(eq(loads.id, loadId)).limit(1);
    if (!load) {
      return NextResponse.json({ success: false, error: "Load not found" }, { status: 404 });
    }

    const fileName = `${loadId}/${photoType}-${Date.now()}-${file.name}`;
    let fileUrl: string;

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { data, error } = await supabase.storage
        .from("photos")
        .upload(fileName, buffer, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });

      if (error) {
        console.error("[PHOTO UPLOAD] Supabase Storage error:", error);
        return NextResponse.json({ success: false, error: "Failed to upload photo" }, { status: 500 });
      }

      const { data: publicUrlData } = supabase.storage
        .from("photos")
        .getPublicUrl(data.path);

      fileUrl = publicUrlData.publicUrl;
      console.log("[PHOTO UPLOAD] Uploaded to Supabase Storage:", fileUrl);
    } else {
      console.log("[PHOTO UPLOAD FALLBACK] Supabase not configured, using placeholder URL");
      fileUrl = "/uploads/verification/" + fileName;
    }

    const result = await uploadPhoto(loadId, { fileName: file.name, fileUrl, photoType });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Photo upload error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
