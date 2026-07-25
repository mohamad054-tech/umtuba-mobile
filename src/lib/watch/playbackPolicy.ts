import AsyncStorage from "@react-native-async-storage/async-storage";

import { getErrorMessage } from "@/src/contracts/validation";
import type { WatchVideo } from "@/src/contracts/watch";

export type AppLifecycleState = "active" | "background" | "inactive" | "unknown";

/** Product default: Watch autoplay starts with audio on. */
export const DEFAULT_WATCH_MUTED = false;

/** In-app VideoPlayer.volume default (0–1). Not system volume. */
export const DEFAULT_WATCH_VOLUME = 1;

/** Auto-advance to the next Watch item when a clip ends. */
export const DEFAULT_WATCH_AUTO_NEXT = true;

export const WATCH_MUTE_STORAGE_KEY = "umtuba.watch.muted";
export const WATCH_VOLUME_STORAGE_KEY = "umtuba.watch.volume";
export const WATCH_AUTO_NEXT_STORAGE_KEY = "umtuba.watch.autoNext";

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

export function resolveAutoNextButtonText(autoNext: boolean): string {
  return autoNext ? "Auto-next on" : "Auto-next off";
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

export function clampWatchVolume(volume: number): number {
  if (!Number.isFinite(volume)) return DEFAULT_WATCH_VOLUME;
  return Math.min(1, Math.max(0, volume));
}

export function parseWatchVolumePreference(
  raw: string | null | undefined
): number {
  if (raw == null || raw === "") return DEFAULT_WATCH_VOLUME;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_WATCH_VOLUME;
  return clampWatchVolume(parsed);
}

export function serializeWatchVolumePreference(volume: number): string {
  return String(clampWatchVolume(volume));
}

export async function loadWatchVolumePreference(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(WATCH_VOLUME_STORAGE_KEY);
    return parseWatchVolumePreference(raw);
  } catch {
    return DEFAULT_WATCH_VOLUME;
  }
}

export async function saveWatchVolumePreference(volume: number): Promise<void> {
  try {
    await AsyncStorage.setItem(
      WATCH_VOLUME_STORAGE_KEY,
      serializeWatchVolumePreference(volume)
    );
  } catch {
    // Preference persistence is best-effort.
  }
}

export function parseWatchAutoNextPreference(
  raw: string | null | undefined
): boolean {
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return DEFAULT_WATCH_AUTO_NEXT;
}

export function serializeWatchAutoNextPreference(autoNext: boolean): string {
  return autoNext ? "1" : "0";
}

export async function loadWatchAutoNextPreference(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(WATCH_AUTO_NEXT_STORAGE_KEY);
    return parseWatchAutoNextPreference(raw);
  } catch {
    return DEFAULT_WATCH_AUTO_NEXT;
  }
}

export async function saveWatchAutoNextPreference(
  autoNext: boolean
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      WATCH_AUTO_NEXT_STORAGE_KEY,
      serializeWatchAutoNextPreference(autoNext)
    );
  } catch {
    // Preference persistence is best-effort.
  }
}

/** When auto-next is off, or this is the last feed item, loop the current clip. */
export function shouldLoopCurrentVideo(input: {
  autoNext: boolean;
  isLastItem: boolean;
}): boolean {
  if (!input.autoNext) return true;
  return input.isLastItem;
}

/**
 * Next feed index after playToEnd when auto-next is on.
 * Returns null when auto-next is off, list is empty, or already on the last item.
 */
export function resolveNextWatchIndex(input: {
  autoNext: boolean;
  activeIndex: number;
  itemCount: number;
}): number | null {
  if (!input.autoNext) return null;
  if (!Number.isFinite(input.activeIndex) || !Number.isFinite(input.itemCount)) {
    return null;
  }
  if (input.itemCount <= 0) return null;
  if (input.activeIndex < 0 || input.activeIndex >= input.itemCount) {
    return null;
  }
  const next = input.activeIndex + 1;
  if (next >= input.itemCount) return null;
  return next;
}

/** Clamp playback progress for the timeline (0–1). */
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

export function resolveSeekTime(ratio: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const clamped = Math.min(1, Math.max(0, ratio));
  return clamped * duration;
}

/** mm:ss (or h:mm:ss for long clips). */
export function formatPlaybackClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
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

/**
 * Effective player mute/volume so only the focused card can emit audio.
 * Inactive cards keep user preference in UI state but force silence on the player.
 */
export function resolveEffectiveAudio(input: {
  isActive: boolean;
  muted: boolean;
  volume: number;
}): { muted: boolean; volume: number } {
  const volume = clampWatchVolume(input.volume);
  if (!input.isActive) {
    return { muted: true, volume: 0 };
  }
  return { muted: input.muted, volume };
}
