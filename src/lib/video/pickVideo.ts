import * as ImagePicker from "expo-image-picker";

import {
  resolveVideoMimeType,
  validateVideoDuration,
  validateVideoFile,
  type AllowedVideoMimeType,
} from "@/src/contracts/video";
import { requestMediaLibraryPermission } from "@/src/lib/permissions/foundation";

export type PickedVideoAsset = {
  uri: string;
  fileName: string;
  mimeType: AllowedVideoMimeType;
  byteSize: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
};

export type PickVideoResult =
  | { ok: true; asset: PickedVideoAsset }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; message: string };

function fileNameFromUri(uri: string, mimeType: string): string {
  const last = uri.split("/").pop() || uri.split("\\").pop() || "video";
  const cleaned = last.split("?")[0] || "video";
  if (cleaned.includes(".")) return cleaned;
  const ext =
    mimeType === "video/webm"
      ? "webm"
      : mimeType === "video/quicktime"
        ? "mov"
        : "mp4";
  return `${cleaned}.${ext}`;
}

/**
 * Native media-library picker for Create (iOS and Android).
 * Requests library permission first, then opens the system video picker.
 */
export async function pickVideoFromLibrary(): Promise<PickVideoResult> {
  const permission = await requestMediaLibraryPermission();
  if (!permission.granted) {
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

  const fileName = fileNameFromUri(
    asset.fileName || uri,
    asset.mimeType || ""
  );
  const byteSize =
    typeof asset.fileSize === "number" && Number.isFinite(asset.fileSize)
      ? asset.fileSize
      : 0;

  if (byteSize <= 0) {
    return {
      ok: false,
      cancelled: false,
      message:
        "Could not determine the video file size. Try another clip or re-export the file.",
    };
  }

  const fileCheck = validateVideoFile({
    mimeType: asset.mimeType || "",
    byteSize,
    fileName,
  });

  if (!fileCheck.ok) {
    return { ok: false, cancelled: false, message: fileCheck.message };
  }

  // ImagePicker duration is seconds on native.
  const durationMs =
    typeof asset.duration === "number" && Number.isFinite(asset.duration)
      ? Math.round(asset.duration * 1000)
      : null;

  const durationCheck = validateVideoDuration(durationMs);
  if (!durationCheck.ok) {
    return { ok: false, cancelled: false, message: durationCheck.message };
  }

  return {
    ok: true,
    asset: {
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
