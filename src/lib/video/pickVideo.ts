import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Linking, Platform } from "react-native";

import {
  isAllowedVideoMimeType,
  newUploadFileId,
  resolveVideoMimeType,
  validateVideoDuration,
  validateVideoFile,
  type AllowedVideoMimeType,
} from "@/src/contracts/video";
import { inspectMediaLibraryPermission } from "@/src/lib/permissions/foundation";

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

export type LibraryAccessState =
  | "all"
  | "limited"
  | "denied"
  | "undetermined"
  | "not_required";

export type PickVideoReason = "library_denied";

export type PickVideoResult =
  | { ok: true; asset: PickedVideoAsset; access: LibraryAccessState }
  | { ok: false; cancelled: true; access: LibraryAccessState }
  | {
      ok: false;
      cancelled: false;
      message: string;
      reason?: PickVideoReason;
      access: LibraryAccessState;
      rejected?: RejectedVideoPick;
    };

export const DENIED_LIBRARY_ACCESS_MESSAGE =
  "Photo library access is turned off. Enable it in Settings to choose a video.";

export const LIMITED_LIBRARY_ACCESS_MESSAGE =
  "Only the videos you selected are available. You can add more from your library.";

/**
 * System photo picker: iOS PHPicker (full library, no camera/mic) and
 * Android 13+ Photo Picker (VideoOnly, albums tab). `legacy: false` avoids
 * ACTION_GET_CONTENT Recents-only / single-album fallbacks.
 * `allowsEditing: false` keeps iOS on PHPicker instead of UIImagePickerController.
 */
export const VIDEO_LIBRARY_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["videos"],
  allowsEditing: false,
  allowsMultipleSelection: false,
  quality: 1,
  legacy: false,
  defaultTab: "albums",
  preferredAssetRepresentationMode: "current" as ImagePicker.ImagePickerOptions["preferredAssetRepresentationMode"],
  shouldDownloadFromNetwork: true,
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
    // Explicit 0 / NaN / negative is invalid metadata, not "picker omitted".
    // validateVideoDuration accepts null and rejects <= 0.
    return 0;
  }
  if (duration < 1000) {
    return Math.round(duration * 1000);
  }
  return Math.round(duration);
}

export function formatPickedDurationSecondsLabel(durationMs: number): string {
  return `${Math.round(durationMs / 1000)}s`;
}

export function classifyLibraryAccess(input: {
  granted: boolean;
  canAskAgain?: boolean;
  accessPrivileges?: "all" | "limited" | "none";
  os?: typeof Platform.OS;
}): LibraryAccessState {
  const os = input.os ?? Platform.OS;
  if (input.accessPrivileges === "limited") {
    return "limited";
  }
  if (os === "android") {
    return "not_required";
  }
  if (input.granted || input.accessPrivileges === "all") {
    return "all";
  }
  // notDetermined: granted=false, canAskAgain=true — PHPicker still shows the library
  if (input.canAskAgain !== false) {
    return "undetermined";
  }
  return "denied";
}

export function libraryAccessMessage(
  access: LibraryAccessState
): string | null {
  if (access === "limited") {
    return LIMITED_LIBRARY_ACCESS_MESSAGE;
  }
  if (access === "denied") {
    return DENIED_LIBRARY_ACCESS_MESSAGE;
  }
  return null;
}

/**
 * Modern system pickers do not need a prior media grant. Requesting one on
 * iOS can create LIMITED/SELECTED access and hide the rest of the library.
 */
export function mediaLibraryGrantRequiredForPicker(
  _os: typeof Platform.OS = Platform.OS
): boolean {
  return false;
}

export function shouldBlockVideoLibraryPicker(
  access: LibraryAccessState,
  os: typeof Platform.OS = Platform.OS
): boolean {
  return os !== "android" && access === "denied";
}

export async function inspectVideoLibraryAccess(
  os: typeof Platform.OS = Platform.OS
): Promise<LibraryAccessState> {
  const permission = await inspectMediaLibraryPermission();
  return classifyLibraryAccess({
    granted: permission.granted,
    canAskAgain: permission.canAskAgain,
    accessPrivileges: permission.accessPrivileges,
    os,
  });
}

/**
 * iOS LIMITED/SELECTED: PHPhotoLibrary presentLimitedLibraryPicker via
 * expo-media-library. Denied (or picker unavailable): Settings.
 * Does not request camera/mic and does not bypass privacy.
 */
export async function expandLimitedVideoLibraryAccess(): Promise<{
  opened: boolean;
  access: LibraryAccessState;
}> {
  const access = await inspectVideoLibraryAccess();
  if (access === "limited") {
    try {
      const MediaLibrary = await import("expo-media-library");
      if (typeof MediaLibrary.presentPermissionsPicker === "function") {
        await MediaLibrary.presentPermissionsPicker(["video"]);
      } else {
        await MediaLibrary.presentPermissionsPickerAsync(["video"]);
      }
      return { opened: true, access: await inspectVideoLibraryAccess() };
    } catch {
      await Linking.openSettings();
      return { opened: true, access: await inspectVideoLibraryAccess() };
    }
  }
  if (access === "denied") {
    await Linking.openSettings();
    return { opened: true, access: await inspectVideoLibraryAccess() };
  }
  return { opened: false, access };
}

/**
 * Native system video library picker for Create (iOS and Android).
 * Inspects access only — does not request camera, microphone, or a gallery
 * grant just to open the picker. Android 13+ Photo Picker needs no grant.
 */
export async function pickVideoFromLibrary(): Promise<PickVideoResult> {
  const access = await inspectVideoLibraryAccess();
  if (shouldBlockVideoLibraryPicker(access)) {
    return {
      ok: false,
      cancelled: false,
      reason: "library_denied",
      message: DENIED_LIBRARY_ACCESS_MESSAGE,
      access,
    };
  }

  const result = await ImagePicker.launchImageLibraryAsync(
    VIDEO_LIBRARY_PICKER_OPTIONS
  );

  if (result.canceled || !result.assets?.[0]) {
    return { ok: false, cancelled: true, access };
  }

  const asset = result.assets[0];
  const uri = asset.uri?.trim();
  if (!uri) {
    return {
      ok: false,
      cancelled: false,
      message: "Could not read the selected video. Try another clip.",
      access,
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
      access,
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
      access,
      rejected: { fileName, uri, byteSize, durationMs },
    };
  }

  const durationCheck = validateVideoDuration(durationMs);
  if (!durationCheck.ok) {
    return {
      ok: false,
      cancelled: false,
      message: durationCheck.message,
      access,
      rejected: { fileName, uri, byteSize, durationMs },
    };
  }

  return {
    ok: true,
    access,
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
