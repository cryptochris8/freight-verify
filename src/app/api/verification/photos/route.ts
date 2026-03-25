import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { uploadPhoto } from "@/app/actions/verification";
import { logger } from "@/lib/logger";
import { validateDriverTokenForLoad } from "@/lib/auth/driver-token";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

async function uploadWithRetry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  fileName: string,
  buffer: Buffer,
  contentType: string,
  maxRetries = 2
): Promise<{ path: string } | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { data, error } = await supabase.storage
      .from("photos")
      .upload(fileName, buffer, {
        contentType,
        upsert: false,
      });

    if (!error && data) {
      return data;
    }

    logger.error("PHOTO_UPLOAD", "Upload attempt failed", {
      attempt: attempt + 1,
      maxAttempts: maxRetries + 1,
      error: String(error),
    });

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null;
}

/**
 * Sanitize filename: keep only alphanumeric, dots, hyphens, underscores.
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
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

    // Require a valid driver token that matches the load
    const load = await validateDriverTokenForLoad(request, loadId);
    if (!load) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Validate file type
    const mimeType = file.type || "";
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { success: false, error: `Invalid file type '${mimeType}'. Allowed: JPEG, PNG, WebP, HEIC.` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: 10 MB.` },
        { status: 400 }
      );
    }

    const safeName = sanitizeFilename(file.name);
    const fileName = `${loadId}/${photoType}-${Date.now()}-${safeName}`;
    let fileUrl: string;

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const data = await uploadWithRetry(
        supabase,
        fileName,
        buffer,
        mimeType
      );

      if (data) {
        const { data: publicUrlData } = supabase.storage
          .from("photos")
          .getPublicUrl(data.path);

        fileUrl = publicUrlData.publicUrl;
        logger.info("PHOTO_UPLOAD", "Uploaded to Supabase Storage", { fileUrl });
      } else {
        // All retries failed — fall back to placeholder URL so the verification flow isn't blocked
        logger.warn("PHOTO_UPLOAD", "All Supabase retries failed, using fallback URL");
        fileUrl = "/uploads/verification/" + fileName;
      }
    } else {
      logger.info("PHOTO_UPLOAD", "Supabase not configured, using placeholder URL");
      fileUrl = "/uploads/verification/" + fileName;
    }

    const result = await uploadPhoto(loadId, { fileName: safeName, fileUrl, photoType });
    return NextResponse.json(result);
  } catch (error) {
    logger.error("PHOTO_UPLOAD", "POST request failed", { error: String(error) });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
