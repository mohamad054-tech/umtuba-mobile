export const MESSAGE_MEDIA_BUCKET = "message-media";

export const MESSAGE_MEDIA_MAX_BYTES = 20 * 1024 * 1024;

export const UM_STREAK_CAPTION_MAX = 280;

export const MESSAGE_MEDIA_MIME = {
  image: ["image/jpeg", "image/png", "image/webp"] as const,
  video: ["video/mp4", "video/webm", "video/quicktime"] as const,
} as const;

export function isOwnedMessageMediaPath(
  userId: string,
  conversationId: string,
  path: string
): boolean {
  return path.startsWith(`${userId}/${conversationId}/`);
}

export function buildMessageMediaPath(input: {
  userId: string;
  conversationId: string;
  fileId: string;
  extension: string;
}): string {
  const extension = input.extension.replace(/^\./, "").toLowerCase();
  return `${input.userId}/${input.conversationId}/${input.fileId}.${extension}`;
}

export function extensionForMessageMime(mimeType: string): string | null {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    case "video/quicktime":
      return "mov";
    default:
      return null;
  }
}

export function classifyMessageMediaMime(
  mimeType: string
): { ok: true; mediaType: "image" | "video" } | { ok: false; message: string } {
  if ((MESSAGE_MEDIA_MIME.image as readonly string[]).includes(mimeType)) {
    return { ok: true, mediaType: "image" };
  }
  if ((MESSAGE_MEDIA_MIME.video as readonly string[]).includes(mimeType)) {
    return { ok: true, mediaType: "video" };
  }
  return { ok: false, message: "Unsupported visual media type." };
}

export function validateMessageMediaFile(input: {
  mimeType: string;
  byteSize: number;
}): { ok: true; mediaType: "image" | "video" } | { ok: false; message: string } {
  if (input.byteSize <= 0 || input.byteSize > MESSAGE_MEDIA_MAX_BYTES) {
    return { ok: false, message: "Visual media is too large." };
  }
  return classifyMessageMediaMime(input.mimeType);
}

export function inferMessageMediaMime(input: {
  mimeType?: string | null;
  fileName?: string | null;
  uri?: string | null;
  mediaType?: "image" | "video" | null;
}): string {
  const trimmed = (input.mimeType || "").trim().toLowerCase();
  if (classifyMessageMediaMime(trimmed).ok) {
    return trimmed;
  }

  const name = `${input.fileName || ""} ${input.uri || ""}`.toLowerCase();
  if (name.includes(".png")) return "image/png";
  if (name.includes(".webp")) return "image/webp";
  if (name.includes(".jpg") || name.includes(".jpeg")) return "image/jpeg";
  if (name.includes(".webm")) return "video/webm";
  if (name.includes(".mov") || name.includes(".qt")) return "video/quicktime";
  if (name.includes(".mp4") || name.includes(".m4v")) return "video/mp4";

  if (input.mediaType === "video") return "video/mp4";
  if (input.mediaType === "image") return "image/jpeg";
  return trimmed || "application/octet-stream";
}

export function newVisualFileId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
