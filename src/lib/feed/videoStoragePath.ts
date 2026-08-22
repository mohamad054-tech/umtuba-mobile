import { POST_VIDEOS_BUCKET } from "@/src/contracts/video";

export type VideoStoragePathResult =
  | { ok: true; path: string }
  | { ok: false; reason: "empty" | "unsafe" | "not-object-path" };

/**
 * Storage object path for post-videos. Leading slashes and a repeated
 * bucket prefix are stripped. URLs and traversal are rejected so we do
 * not send a path that Storage will 403.
 */
export function normalizeVideoStoragePath(
  raw: string | null | undefined
): VideoStoragePathResult {
  let path = (raw ?? "").trim();
  if (!path) return { ok: false, reason: "empty" };
  if (/^https?:\/\//i.test(path)) {
    return { ok: false, reason: "not-object-path" };
  }
  path = path.replace(/^\/+/, "");
  const bucketPrefix = `${POST_VIDEOS_BUCKET}/`;
  if (path.startsWith(bucketPrefix)) {
    path = path.slice(bucketPrefix.length).replace(/^\/+/, "");
  }
  if (!path) return { ok: false, reason: "empty" };
  if (path.includes("..") || path.includes("\\") || path.includes("?")) {
    return { ok: false, reason: "unsafe" };
  }
  return { ok: true, path };
}

export function isLegacyHttpPlaybackUrl(
  raw: string | null | undefined
): raw is string {
  const trimmed = (raw ?? "").trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

export function isPlayableWatchSrc(src: string | null | undefined): boolean {
  const trimmed = (src ?? "").trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

/** Native player mounts only when a playable URL exists. URL prep is not a player. */
export function shouldMountWatchPlayer(input: {
  shouldLoadPlayer: boolean;
  src: string | null | undefined;
}): boolean {
  return input.shouldLoadPlayer === true && isPlayableWatchSrc(input.src);
}
