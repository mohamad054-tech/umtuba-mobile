import { getErrorMessage } from "@/src/contracts/validation";
import type { WatchVideo } from "@/src/contracts/watch";

export type AppLifecycleState = "active" | "background" | "inactive" | "unknown";

/**
 * Only the active card may play, and only while the app is foregrounded
 * and the Watch screen is focused.
 */
export function shouldPlayVideo(input: {
  isActive: boolean;
  appState: AppLifecycleState;
  screenFocused: boolean;
}): boolean {
  return (
    input.isActive &&
    input.screenFocused &&
    input.appState === "active"
  );
}

/** Preload current + adjacent only (memory-friendly Android feed). */
export function shouldLoadPlayer(index: number, activeIndex: number): boolean {
  if (!Number.isFinite(index) || !Number.isFinite(activeIndex)) {
    return false;
  }
  return Math.abs(index - activeIndex) <= 1;
}

/** Append page results without duplicating post ids. */
export function mergeWatchVideos(
  existing: WatchVideo[],
  incoming: WatchVideo[]
): WatchVideo[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((v) => v.id));
  const merged = existing.slice();
  for (const video of incoming) {
    if (seen.has(video.id)) continue;
    seen.add(video.id);
    merged.push(video);
  }
  return merged;
}

/** Stable FlatList key — prefer post id, fall back to video id. */
export function watchItemKey(video: WatchVideo): string {
  if (video.postId != null) {
    return `post-${video.postId}`;
  }
  return video.id;
}

export function sanitizePlaybackError(error: unknown): string {
  return getErrorMessage(error, "Unable to play this video. Try again.");
}

const EXPIRED_URL_PATTERN =
  /\b(403|401|expired|signature|signed.?url|access.?denied|forbidden|token)\b/i;

/** Heuristic: signed URL may need refresh (never trust raw player text alone). */
export function isLikelyExpiredPlaybackUrl(error: unknown): boolean {
  let raw = "";
  if (error && typeof error === "object" && "message" in error) {
    raw = String((error as { message: unknown }).message);
  } else if (typeof error === "string") {
    raw = error;
  } else if (error instanceof Error) {
    raw = error.message;
  }
  return EXPIRED_URL_PATTERN.test(raw);
}

export function resolveMuteLabel(muted: boolean): string {
  return muted ? "Unmute video" : "Mute video";
}
