import type { SupabaseClient } from "@supabase/supabase-js";
import * as FileSystem from "expo-file-system/legacy";

import { decodeBase64ToArrayBuffer } from "./base64";
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

async function resolveReadableUri(uri: string): Promise<string> {
  const trimmed = uri.trim();
  if (!trimmed.startsWith("content://") || !FileSystem.cacheDirectory) {
    return trimmed;
  }
  const dest = `${FileSystem.cacheDirectory}um-streak-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  await FileSystem.copyAsync({ from: trimmed, to: dest });
  return dest;
}

/**
 * React Native supabase-js cannot upload Blob/File/FormData (storage-js
 * wraps those in FormData, which RN does not send correctly). Read bytes
 * via Expo FileSystem and return ArrayBuffer for the raw-body upload path.
 */
export async function readUriAsUploadBody(uri: string): Promise<ArrayBuffer> {
  const source = await resolveReadableUri(uri);
  try {
    const base64 = await FileSystem.readAsStringAsync(source, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64) {
      throw new Error("empty-base64");
    }
    const buffer = decodeBase64ToArrayBuffer(base64);
    if (buffer.byteLength <= 0) {
      throw new Error("empty-buffer");
    }
    return buffer;
  } catch (fileError) {
    const response = await fetch(source);
    if (!response.ok) {
      throw fileError instanceof Error ? fileError : new Error("read-failed");
    }
    if (typeof response.arrayBuffer === "function") {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 0) {
        return buffer;
      }
    }
    throw fileError instanceof Error ? fileError : new Error("read-failed");
  }
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
  let body: ArrayBuffer;
  try {
    body = await readUriAsUploadBody(input.uri);
    if (!byteSize || byteSize <= 0) {
      byteSize = body.byteLength;
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
    console.error("UM Streak message-media upload failed", {
      statusCode: "statusCode" in error ? error.statusCode : undefined,
      name: error.name,
      message: error.message,
    });
    return { ok: false, message: umStreakText("uploadFailed") };
  }

  return {
    ok: true,
    path,
    mediaType: check.mediaType,
    mimeType,
    byteSize,
  };
}
