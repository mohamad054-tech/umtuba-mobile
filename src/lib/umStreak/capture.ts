import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import { requestMediaLibraryPermission } from "@/src/lib/permissions/foundation";

import { umStreakText } from "./copy";
import {
  inferMessageMediaMime,
  validateMessageMediaFile,
} from "./media";
import { requestCameraPermission } from "./permissions";

export type CapturedVisualAsset = {
  uri: string;
  mimeType: string;
  mediaType: "image" | "video";
  byteSize: number;
  fileName: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

export type CaptureVisualResult =
  | { ok: true; asset: CapturedVisualAsset }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; message: string };

export type VisualCaptureMode = "photo" | "video";
export type VisualCameraFacing = "user" | "environment";

async function resolveByteSize(input: {
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
    // Fall through.
  }
  try {
    const response = await fetch(input.uri);
    const blob = await response.blob();
    if (typeof blob.size === "number" && blob.size > 0) {
      return Math.round(blob.size);
    }
  } catch {
    // Unable to probe.
  }
  return null;
}

function fileNameFromUri(uri: string, mimeType: string): string {
  const last = uri.split("/").pop() || uri.split("\\").pop() || "visual";
  const cleaned = decodeURIComponent(last.split("?")[0] || "visual");
  if (cleaned.includes(".")) return cleaned;
  const ext =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : mimeType === "video/webm"
          ? "webm"
          : mimeType === "video/quicktime"
            ? "mov"
            : mimeType.startsWith("video/")
              ? "mp4"
              : "jpg";
  return `visual.${ext}`;
}

async function finalizeAsset(
  asset: ImagePicker.ImagePickerAsset,
  fallbackType: "image" | "video"
): Promise<CaptureVisualResult> {
  const uri = asset.uri?.trim();
  if (!uri) {
    return {
      ok: false,
      cancelled: false,
      message: umStreakText("uploadFailed"),
    };
  }

  const mediaType: "image" | "video" =
    asset.type === "video" || fallbackType === "video" ? "video" : "image";
  const mimeType = inferMessageMediaMime({
    mimeType: asset.mimeType,
    fileName: asset.fileName,
    uri,
    mediaType,
  });
  const byteSize = await resolveByteSize({
    uri,
    reportedSize: asset.fileSize,
  });
  if (byteSize == null) {
    return {
      ok: false,
      cancelled: false,
      message: umStreakText("uploadFailed"),
    };
  }

  const check = validateMessageMediaFile({ mimeType, byteSize });
  if (!check.ok) {
    return { ok: false, cancelled: false, message: check.message };
  }

  const durationMs =
    typeof asset.duration === "number" && Number.isFinite(asset.duration)
      ? Math.round(asset.duration * 1000)
      : null;

  return {
    ok: true,
    asset: {
      uri,
      mimeType,
      mediaType: check.mediaType,
      byteSize,
      fileName: fileNameFromUri(asset.fileName || uri, mimeType),
      width:
        typeof asset.width === "number" && asset.width > 0
          ? Math.round(asset.width)
          : null,
      height:
        typeof asset.height === "number" && asset.height > 0
          ? Math.round(asset.height)
          : null,
      durationMs,
    },
  };
}

/** Real device camera via the existing expo-image-picker stack. */
export async function captureVisualFromCamera(input: {
  mode: VisualCaptureMode;
  facing?: VisualCameraFacing;
}): Promise<CaptureVisualResult> {
  const permission = await requestCameraPermission();
  if (!permission.granted) {
    return {
      ok: false,
      cancelled: false,
      message: umStreakText("cameraUnavailable"),
    };
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: input.mode === "video" ? ["videos"] : ["images"],
    allowsEditing: false,
    quality: 0.92,
    videoMaxDuration: 15,
    cameraType:
      input.facing === "user"
        ? ImagePicker.CameraType.front
        : ImagePicker.CameraType.back,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { ok: false, cancelled: true };
  }
  return finalizeAsset(result.assets[0], input.mode === "video" ? "video" : "image");
}

export async function pickVisualFromLibrary(): Promise<CaptureVisualResult> {
  const permission = await requestMediaLibraryPermission();
  if (!permission.granted && Platform.OS !== "android") {
    return {
      ok: false,
      cancelled: false,
      message: umStreakText("cameraUnavailable"),
    };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    allowsEditing: false,
    quality: 0.92,
    videoMaxDuration: 15,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { ok: false, cancelled: true };
  }

  const first = result.assets[0];
  return finalizeAsset(
    first,
    first.type === "video" ? "video" : "image"
  );
}
