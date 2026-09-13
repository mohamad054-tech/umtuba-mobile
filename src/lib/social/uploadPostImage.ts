import type { SupabaseClient } from "@supabase/supabase-js";

import { getErrorMessage } from "@/src/contracts/validation";
import { isUuid } from "@/src/lib/social/deleteOwnedPostShared";

export const POST_IMAGES_BUCKET = "post-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadOwnedPostImage(
  supabase: SupabaseClient,
  userId: string,
  input: { uri: string; mimeType?: string | null; fileName?: string | null }
): Promise<string> {
  if (!isUuid(userId)) {
    throw new Error("Please sign in to upload an image.");
  }

  const response = await fetch(input.uri);
  if (!response.ok) {
    throw new Error("Unable to read the selected image.");
  }
  const body = await response.blob();
  if (!body || body.size <= 0) {
    throw new Error("The selected image is empty.");
  }
  if (body.size > MAX_IMAGE_BYTES) {
    throw new Error("The image must be smaller than 5 MB.");
  }

  const mimeType =
    (typeof input.mimeType === "string" && input.mimeType.startsWith("image/")
      ? input.mimeType
      : body.type && body.type.startsWith("image/")
        ? body.type
        : "image/jpeg");
  if (!mimeType.startsWith("image/")) {
    throw new Error("Please select a valid image.");
  }

  const extension =
    input.fileName?.split(".").pop()?.toLowerCase() ||
    (mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg");
  const uniqueFileName =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? `${crypto.randomUUID()}.${extension}`
      : `img-${Date.now()}.${extension}`;
  const filePath = `${userId}/${uniqueFileName}`;

  const { error } = await supabase.storage
    .from(POST_IMAGES_BUCKET)
    .upload(filePath, body, {
      cacheControl: "3600",
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(getErrorMessage(error, "Unable to upload image."));
  }

  const { data } = supabase.storage.from(POST_IMAGES_BUCKET).getPublicUrl(filePath);
  if (!data.publicUrl) {
    throw new Error("The image URL could not be created.");
  }
  return data.publicUrl;
}
