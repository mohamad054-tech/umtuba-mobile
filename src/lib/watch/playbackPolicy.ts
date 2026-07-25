import AsyncStorage from "@react-native-async-storage/async-storage";

import { getErrorMessage } from "@/src/contracts/validation";
import type { WatchVideo } from "@/src/contracts/watch";

export type AppLifecycleState = "active" | "background" | "inactive" | "unknown";

/** Product default: Watch autoplay starts with audio on. */
export const DEFAULT_WATCH_MUTED = false;

export const WATCH_MUTE_STORAGE_KEY = "umtuba.watch.muted";

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

/** Short visible mute control label. */
export function resolveMuteButtonText(muted: boolean): string {
  return muted ? "Unmute" : "Mute";
}

export function parseWatchMutedPreference(raw: string | null | undefined): boolean {
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return DEFAULT_WATCH_MUTED;
}

export function serializeWatchMutedPreference(muted: boolean): string {
  return muted ? "1" : "0";
}

export async function loadWatchMutedPreference(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(WATCH_MUTE_STORAGE_KEY);
    return parseWatchMutedPreference(raw);
  } catch {
    return DEFAULT_WATCH_MUTED;
  }
}

export async function saveWatchMutedPreference(muted: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(
      WATCH_MUTE_STORAGE_KEY,
      serializeWatchMutedPreference(muted)
    );
  } catch {
    // Preference persistence is best-effort.
  }
}

/** Clamp playback progress for the thin feed indicator (0–1). */
export function resolveProgressRatio(
  currentTime: number,
  duration: number
): number {
  if (
    !Number.isFinite(currentTime) ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return 0;
  }
  return Math.min(1, Math.max(0, currentTime / duration));
}

export function resolvePlayPauseFeedbackLabel(userPaused: boolean): string {
  return userPaused ? "Paused" : "Playing";
}

/**
 * Feed autoplay AND user tap-pause.
 * When the card is inactive, user pause is ignored so the next active card autoplays.
 */
export function shouldPlayWithUserPause(input: {
  feedShouldPlay: boolean;
  userPaused: boolean;
  isActive: boolean;
}): boolean {
  if (!input.isActive) return false;
  return input.feedShouldPlay && !input.userPaused;
}
