import type { SupabaseClient } from "@supabase/supabase-js";

import { umStreakText } from "./copy";
import {
  buildMessageMediaPath,
  extensionForMessageMime,
  inferMessageMediaMime,
  isOwnedMessageMediaPath,
  MESSAGE_MEDIA_BUCKET,
  newVisualFileId,
  validateMessageMediaFile,
} from "./media";

export type PrivateVisualUploadResult =
  | {
      ok: true;
      path: string;
      mediaType: "image" | "video";
      mimeType: string;
      byteSize: number;
    }
  | { ok: false; message: string };

async function readUriAsBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(umStreakText("uploadFailed"));
  }
  const blob = await response.blob();
  if (!blob || blob.size <= 0) {
    throw new Error(umStreakText("uploadFailed"));
  }
  return blob;
}

/**
 * Private visual upload into message-media/{userId}/{conversationId}/…
 * Never uses the public UM Life / post-videos bucket.
 */
export async function uploadPrivateVisualMedia(input: {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  byteSize?: number | null;
  mediaType?: "image" | "video" | null;
}): Promise<PrivateVisualUploadResult> {
  if (!input.userId) {
    return { ok: false, message: umStreakText("signIn") };
  }

  const mimeType = inferMessageMediaMime({
    mimeType: input.mimeType,
    fileName: input.fileName,
    uri: input.uri,
    mediaType: input.mediaType,
  });

  let byteSize = input.byteSize ?? 0;
  let body: Blob;
  try {
    body = await readUriAsBlob(input.uri);
    if (!byteSize || byteSize <= 0) {
      byteSize = body.size;
    }
  } catch {
    return { ok: false, message: umStreakText("uploadFailed") };
  }

  const check = validateMessageMediaFile({ mimeType, byteSize });
  if (!check.ok) {
    return check;
  }

  const extension = extensionForMessageMime(mimeType);
  if (!extension) {
    return { ok: false, message: umStreakText("uploadFailed") };
  }

  const path = buildMessageMediaPath({
    userId: input.userId,
    conversationId: input.conversationId,
    fileId: newVisualFileId(),
    extension,
  });

  if (!isOwnedMessageMediaPath(input.userId, input.conversationId, path)) {
    return { ok: false, message: umStreakText("uploadFailed") };
  }

  const { error } = await input.supabase.storage
    .from(MESSAGE_MEDIA_BUCKET)
    .upload(path, body, {
      contentType: mimeType,
      upsert: false,
      cacheControl: "3600",
    });

  if (error) {
    const text = (error.message || "").toLowerCase();
    return {
      ok: false,
      message:
        text.includes("row-level security") ||
        text.includes("not found") ||
        text.includes("bucket")
          ? umStreakText("uploadFailed")
          : umStreakText("uploadFailed"),
    };
  }

  return {
    ok: true,
    path,
    mediaType: check.mediaType,
    mimeType,
    byteSize,
  };
}
