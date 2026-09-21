import type { SupabaseClient } from "@supabase/supabase-js";
import * as ImagePicker from "expo-image-picker";

import { requestMediaLibraryPermission } from "@/src/lib/permissions/foundation";

export const AVATARS_BUCKET = "avatars";
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type AvatarPick =
  | { ok: true; uri: string; mimeType: string; byteSize: number; fileName: string }
  | { ok: false; reason: "cancelled" | "denied" | "type" | "size" | "failed" };

export type AvatarUploadResult =
  | { ok: true; avatarUrl: string }
  | { ok: false; reason: "auth" | "type" | "size" | "failed"; message: string };

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function avatarStoragePath(userId: string, fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
  const unique =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `a-${Date.now()}`;
  return `${userId}/${unique}.${ext}`;
}

export function validateAvatarFile(input: {
  mimeType: string;
  byteSize: number;
}): { ok: true } | { ok: false; reason: "type" | "size" } {
  if (!ALLOWED_AVATAR_TYPES.has(input.mimeType)) {
    return { ok: false, reason: "type" };
  }
  if (!Number.isFinite(input.byteSize) || input.byteSize <= 0) {
    return { ok: false, reason: "size" };
  }
  if (input.byteSize > MAX_AVATAR_BYTES) {
    return { ok: false, reason: "size" };
  }
  return { ok: true };
}

function guessMime(uri: string, reported: string | null | undefined): string {
  const raw = (reported ?? "").trim().toLowerCase();
  if (ALLOWED_AVATAR_TYPES.has(raw)) return raw;
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export async function pickAvatarFromLibrary(): Promise<AvatarPick> {
  const openPicker = () =>
    ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsEditing: false,
      exif: false,
    });

  let result: Awaited<ReturnType<typeof openPicker>>;
  try {
    result = await openPicker();
  } catch {
    const permission = await requestMediaLibraryPermission();
    if (!permission.granted) {
      return { ok: false, reason: "denied" };
    }
    try {
      result = await openPicker();
    } catch {
      return { ok: false, reason: "failed" };
    }
  }

  if (result.canceled || !result.assets?.[0]?.uri) {
    return { ok: false, reason: "cancelled" };
  }

  const asset = result.assets[0];
  const mimeType = guessMime(asset.uri, asset.mimeType);
  const byteSize =
    typeof asset.fileSize === "number" && Number.isFinite(asset.fileSize)
      ? asset.fileSize
      : 0;
  const check = validateAvatarFile({
    mimeType,
    byteSize: byteSize > 0 ? byteSize : 1,
  });
  if (!check.ok && check.reason === "type") {
    return { ok: false, reason: "type" };
  }
  if (byteSize > MAX_AVATAR_BYTES) {
    return { ok: false, reason: "size" };
  }

  const ext = MIME_TO_EXT[mimeType] ?? "jpg";
  return {
    ok: true,
    uri: asset.uri,
    mimeType,
    byteSize,
    fileName: asset.fileName?.trim() || `avatar.${ext}`,
  };
}

export async function updateOwnAvatarUrl(
  supabase: SupabaseClient,
  userId: string,
  avatarUrl: string
): Promise<{ ok: true; avatarUrl: string } | { ok: false; message: string }> {
  if (!userId) {
    return { ok: false, message: "Please sign in to update your avatar." };
  }
  if (!avatarUrl.startsWith("http://") && !avatarUrl.startsWith("https://")) {
    return { ok: false, message: "Invalid avatar URL." };
  }
  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId)
    .select("avatar_url")
    .single();
  if (error || !data?.avatar_url) {
    return { ok: false, message: "Unable to save avatar." };
  }
  return { ok: true, avatarUrl: data.avatar_url };
}

export async function uploadPickedAvatar(
  supabase: SupabaseClient,
  userId: string,
  file: {
    uri: string;
    mimeType: string;
    byteSize: number;
    fileName: string;
  }
): Promise<AvatarUploadResult> {
  if (!userId) {
    return { ok: false, reason: "auth", message: "Please sign in to upload an avatar." };
  }
  const check = validateAvatarFile({
    mimeType: file.mimeType,
    byteSize: file.byteSize > 0 ? file.byteSize : 1,
  });
  if (!check.ok) {
    return {
      ok: false,
      reason: check.reason,
      message:
        check.reason === "type"
          ? "Please choose a JPEG, PNG, WebP, or GIF image."
          : "The avatar must be smaller than 2 MB.",
    };
  }

  let body: ArrayBuffer;
  try {
    const response = await fetch(file.uri);
    body = await response.arrayBuffer();
  } catch {
    return { ok: false, reason: "failed", message: "Unable to upload avatar." };
  }
  if (body.byteLength > MAX_AVATAR_BYTES) {
    return {
      ok: false,
      reason: "size",
      message: "The avatar must be smaller than 2 MB.",
    };
  }

  const filePath = avatarStoragePath(userId, file.fileName);
  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(filePath, body, {
      cacheControl: "3600",
      contentType: file.mimeType,
      upsert: false,
    });
  if (uploadError) {
    return { ok: false, reason: "failed", message: "Unable to upload avatar." };
  }

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(filePath);
  if (!data.publicUrl) {
    return { ok: false, reason: "failed", message: "Unable to upload avatar." };
  }

  const saved = await updateOwnAvatarUrl(supabase, userId, data.publicUrl);
  if (!saved.ok) {
    return { ok: false, reason: "failed", message: saved.message };
  }
  return { ok: true, avatarUrl: saved.avatarUrl };
}
