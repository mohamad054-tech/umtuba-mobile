import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import {
  isAllowedVideoMimeType,
  newUploadFileId,
  resolveVideoMimeType,
  validateVideoDuration,
  validateVideoFile,
  type AllowedVideoMimeType,
} from "@/src/contracts/video";
import { requestMediaLibraryPermission } from "@/src/lib/permissions/foundation";

export type PickedVideoAsset = {
  id: string;
  uri: string;
  fileName: string;
  mimeType: AllowedVideoMimeType;
  byteSize: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
};

export type RejectedVideoPick = {
  fileName: string | null;
  uri: string | null;
  byteSize: number | null;
  durationMs: number | null;
};

export type PickVideoResult =
  | { ok: true; asset: PickedVideoAsset }
  | { ok: false; cancelled: true }
  | {
      ok: false;
      cancelled: false;
      message: string;
      rejected?: RejectedVideoPick;
    };

function fileNameFromUri(uri: string, mimeType: string): string {
  const last = uri.split("/").pop() || uri.split("\\").pop() || "video";
  const cleaned = decodeURIComponent(last.split("?")[0] || "video");
  if (cleaned.includes(".") && !/^\d+$/.test(cleaned.split(".")[0] || "")) {
    return cleaned;
  }
  // Android content:// URIs often end in a numeric document id with no extension.
  if (!cleaned.includes(".") || /^\d+$/.test(cleaned)) {
    const ext =
      mimeType === "video/webm"
        ? "webm"
        : mimeType === "video/quicktime"
          ? "mov"
          : "mp4";
    return `video.${ext}`;
  }
  return cleaned;
}

/**
 * Prefer picker MIME + filename; for Android content:// videos with empty MIME
 * and no extension, default to video/mp4 (gallery was opened for videos only).
 * Explicit non-video / unsupported video/* types are left for validateVideoFile.
 */
export function inferPickedVideoMimeType(input: {
  mimeType?: string | null;
  fileName?: string | null;
  uri: string;
}): string {
  const fromMeta = resolveVideoMimeType(input.mimeType, input.fileName);
  if (isAllowedVideoMimeType(fromMeta)) {
    return fromMeta;
  }

  const trimmed = (input.mimeType || "").trim().toLowerCase();
  if (trimmed.startsWith("video/") && trimmed.length > "video/".length) {
    return trimmed;
  }
  if (
    trimmed &&
    trimmed !== "application/octet-stream" &&
    !trimmed.startsWith("video/")
  ) {
    return trimmed;
  }

  const name = (input.fileName || "").trim();
  const uri = input.uri.trim().toLowerCase();
  const extensionlessName = !name || !name.includes(".") || /^\d+$/.test(name);
  const contentUri = uri.startsWith("content://");

  if (
    !trimmed ||
    trimmed === "application/octet-stream" ||
    contentUri ||
    extensionlessName
  ) {
    const synthetic = name.includes(".") ? name : `${name || "video"}.mp4`;
    const inferred = resolveVideoMimeType(null, synthetic);
    return isAllowedVideoMimeType(inferred) ? inferred : "video/mp4";
  }

  return fromMeta;
}

/**
 * Use picker-reported size when present; otherwise probe via FileSystem
 * (supports content:// on Android) and fetch(blob) as a last resort.
 * Does not reject solely because ImagePicker omitted fileSize.
 */
export async function resolvePickedVideoByteSize(input: {
  uri: string;
  reportedSize?: number | null;
}): Promise<number | null> {
  const reported = input.reportedSize;
  if (typeof reported === "number" && Number.isFinite(reported) && reported > 0) {
    return Math.round(reported);
  }

  try {
    const info = await FileSystem.getInfoAsync(input.uri);
    if (
      info.exists &&
      typeof info.size === "number" &&
      Number.isFinite(info.size) &&
      info.size > 0
    ) {
      return Math.round(info.size);
    }
  } catch {
    // Fall through to fetch probe.
  }

  try {
    const response = await fetch(input.uri);
    const blob = await response.blob();
    if (typeof blob.size === "number" && Number.isFinite(blob.size) && blob.size > 0) {
      return Math.round(blob.size);
    }
  } catch {
    // Unable to probe size.
  }

  return null;
}

/**
 * expo-image-picker documents `duration` in milliseconds. Older Android
 * mocks / some native paths still emit seconds (12.5). Values below 1000
 * are treated as seconds; 8200 (IMG_0008.MOV ~8.2s) is already ms and must
 * not be multiplied again — that displayed as 8200s on Create.
 */
export function pickerDurationToMs(duration: number): number | null {
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }
  if (duration < 1000) {
    return Math.round(duration * 1000);
  }
  return Math.round(duration);
}

export function formatPickedDurationSecondsLabel(durationMs: number): string {
  return `${Math.round(durationMs / 1000)}s`;
}

/**
 * Native media-library picker for Create (iOS and Android).
 * Requests library permission first, then opens the system video picker.
 * Android 13+ system photo picker may work without a broad media grant.
 */
export async function pickVideoFromLibrary(): Promise<PickVideoResult> {
  const permission = await requestMediaLibraryPermission();
  if (!permission.granted && Platform.OS !== "android") {
    return {
      ok: false,
      cancelled: false,
      message:
        "Media library access is required to choose a video. You can enable it in Settings.",
    };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["videos"],
    allowsEditing: false,
    quality: 1,
    videoMaxDuration: undefined,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { ok: false, cancelled: true };
  }

  const asset = result.assets[0];
  const uri = asset.uri?.trim();
  if (!uri) {
    return {
      ok: false,
      cancelled: false,
      message: "Could not read the selected video. Try another clip.",
    };
  }

  const mimeType = inferPickedVideoMimeType({
    mimeType: asset.mimeType,
    fileName: asset.fileName,
    uri,
  });
  const fileName = fileNameFromUri(asset.fileName || uri, mimeType);

  const byteSize = await resolvePickedVideoByteSize({
    uri,
    reportedSize: asset.fileSize,
  });

  const durationMs =
    typeof asset.duration === "number" ? pickerDurationToMs(asset.duration) : null;

  if (byteSize == null) {
    return {
      ok: false,
      cancelled: false,
      message:
        "Could not determine the video file size after selection. Try another clip or re-export the file.",
      rejected: { fileName, uri, byteSize: null, durationMs },
    };
  }

  const fileCheck = validateVideoFile({
    mimeType,
    byteSize,
    fileName,
  });

  if (!fileCheck.ok) {
    return {
      ok: false,
      cancelled: false,
      message: fileCheck.message,
      rejected: { fileName, uri, byteSize, durationMs },
    };
  }

  const durationCheck = validateVideoDuration(durationMs);
  if (!durationCheck.ok) {
    return {
      ok: false,
      cancelled: false,
      message: durationCheck.message,
      rejected: { fileName, uri, byteSize, durationMs },
    };
  }

  return {
    ok: true,
    asset: {
      id: newUploadFileId(),
      uri,
      fileName,
      mimeType: fileCheck.mimeType,
      byteSize,
      durationMs,
      width:
        typeof asset.width === "number" && asset.width > 0
          ? Math.round(asset.width)
          : null,
      height:
        typeof asset.height === "number" && asset.height > 0
          ? Math.round(asset.height)
          : null,
    },
  };
}

export function resolvePickedMime(
  mimeType: string | null | undefined,
  fileName: string
): string {
  return resolveVideoMimeType(mimeType, fileName);
}
