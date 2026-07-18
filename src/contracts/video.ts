/** Shared Video Posts V1 constants and pure validation (client-safe). */

export const POST_VIDEOS_BUCKET = "post-videos";

/** 50 MB — matches storage.buckets.file_size_limit. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export const MAX_CAPTION_LENGTH = 1000;

/** Short-lived signed playback URLs (15 minutes). */
export const VIDEO_SIGNED_URL_TTL_SECONDS = 15 * 60;

/** Upload HTTP timeout (matches web XHR). */
export const VIDEO_UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;

export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export type AllowedVideoMimeType = (typeof ALLOWED_VIDEO_MIME_TYPES)[number];

const ALLOWED_VIDEO_MIME_SET = new Set<string>(ALLOWED_VIDEO_MIME_TYPES);

export const VIDEO_FILE_HINT = "MP4, WebM, or MOV — maximum 50 MB";

export function isAllowedVideoMimeType(
  mimeType: string
): mimeType is AllowedVideoMimeType {
  return ALLOWED_VIDEO_MIME_SET.has(mimeType);
}

/**
 * Prefer device MIME; when empty (common on Android), infer from extension.
 */
export function resolveVideoMimeType(
  mimeType: string | null | undefined,
  fileName?: string | null
): string {
  const trimmed = (mimeType || "").trim().toLowerCase();
  if (isAllowedVideoMimeType(trimmed)) {
    return trimmed;
  }

  const name = (fileName || "").trim().toLowerCase();
  if (name.endsWith(".webm")) {
    return "video/webm";
  }
  if (name.endsWith(".mov")) {
    return "video/quicktime";
  }
  if (name.endsWith(".mp4") || name.endsWith(".m4v")) {
    return "video/mp4";
  }

  return trimmed;
}

export function formatMaxVideoSizeLabel(): string {
  return "50 MB";
}

export type VideoFileValidationResult =
  | { ok: true; mimeType: AllowedVideoMimeType }
  | { ok: false; message: string };

export type CaptionValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export type DurationValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateVideoFile(input: {
  mimeType: string;
  byteSize: number;
  fileName?: string | null;
}): VideoFileValidationResult {
  const mimeType = resolveVideoMimeType(input.mimeType, input.fileName);

  if (!isAllowedVideoMimeType(mimeType)) {
    return {
      ok: false,
      message: "Please select an MP4, WebM, or MOV video.",
    };
  }

  if (input.byteSize <= 0) {
    return {
      ok: false,
      message: "The selected video file is empty.",
    };
  }

  if (input.byteSize > MAX_VIDEO_BYTES) {
    return {
      ok: false,
      message: `The video must be smaller than ${formatMaxVideoSizeLabel()}.`,
    };
  }

  return { ok: true, mimeType };
}

export function validateCaption(caption: string): CaptionValidationResult {
  if (caption.length > MAX_CAPTION_LENGTH) {
    return {
      ok: false,
      message: `Caption must be ${MAX_CAPTION_LENGTH} characters or fewer.`,
    };
  }

  return { ok: true };
}

/**
 * Duration is optional (Android pickers sometimes omit it).
 * When present, reject empty / invalid values. No hard max — matches web.
 */
export function validateVideoDuration(
  durationMs: number | null | undefined
): DurationValidationResult {
  if (durationMs == null) {
    return { ok: true };
  }
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return {
      ok: false,
      message: "This video has invalid duration metadata. Try another clip.",
    };
  }
  return { ok: true };
}

export function videoExtensionForMime(mimeType: string): string {
  switch (mimeType) {
    case "video/webm":
      return "webm";
    case "video/quicktime":
      return "mov";
    case "video/mp4":
    default:
      return "mp4";
  }
}

export function isOwnedVideoPath(userId: string, path: string): boolean {
  const normalized = path.replace(/^\/+/, "");
  return (
    normalized.startsWith(`${userId}/`) &&
    normalized.length > userId.length + 1 &&
    !normalized.includes("..") &&
    !normalized.includes("\\")
  );
}

/** Display-only hashtag parse from caption (matches web Discover). */
export function extractHashtags(caption: string): string[] {
  const matches = caption.match(/#[\p{L}\p{N}_]+/gu);
  if (!matches) {
    return [];
  }
  const unique = new Set(matches.map((tag) => tag.slice(0, 48)));
  return Array.from(unique).slice(0, 8);
}

export function newUploadFileId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `u-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
