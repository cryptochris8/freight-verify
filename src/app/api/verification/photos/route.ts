import { NextResponse } from "next/server";
import { uploadPhoto } from "@/app/actions/verification";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const loadId = formData.get("loadId") as string;
    const photoType = formData.get("photoType") as string;
    const file = formData.get("file") as File | null;

    if (!loadId || !photoType) {
      return NextResponse.json({ success: false, error: "loadId and photoType are required" }, { status: 400 });
    }

    // TODO: Upload to Supabase Storage
    // const supabase = createClient();
    // const { data, error } = await supabase.storage.from("verification-photos").upload(filePath, file);
    // const fileUrl = supabase.storage.from("verification-photos").getPublicUrl(data.path).data.publicUrl;

    const fileName = file?.name ?? "photo-" + Date.now() + ".jpg";
    const fileUrl = "/uploads/verification/" + loadId + "/" + fileName;

    console.log("[PHOTO UPLOAD PLACEHOLDER] Load:", loadId, "Type:", photoType, "File:", fileName);
    console.log("[TODO] Integrate with Supabase Storage for actual file upload");

    const result = await uploadPhoto(loadId, { fileName, fileUrl, photoType });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Photo upload error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
