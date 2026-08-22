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

/**
 * How many neighbors may mount a native player.
 * iOS: ±1 preload. Android: active only — extra TextureView/ExoPlayer
 * instances compete for decoders and keep the spinner on Fold6.
 */
export function resolveWatchPlayerLoadWindow(
  platform?: string | null
): number {
  return platform === "android" ? 0 : 1;
}

/** Preload current + platform window. Omit platform to keep the shared ±1 contract. */
export function shouldLoadPlayer(
  index: number,
  activeIndex: number,
  platform?: string | null
): boolean {
  if (!Number.isFinite(index) || !Number.isFinite(activeIndex)) {
    return false;
  }
  return (
    Math.abs(index - activeIndex) <= resolveWatchPlayerLoadWindow(platform)
  );
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

/** Viewer interaction signature so recycled cells cannot keep a stale heart. */
export function watchInteractionSignature(
  videos: readonly WatchVideo[]
): string {
  return videos
    .map(
      (video) =>
        `${watchItemKey(video)}:${video.likedByMe === true ? 1 : 0}:${video.savedByMe === true ? 1 : 0}`
    )
    .join("|");
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

/** Discrete in-app volume steps (5%). */
export const WATCH_VOLUME_STEP = 0.05;

export function quantizeWatchVolume(
  volume: number,
  step: number = WATCH_VOLUME_STEP
): number {
  const clamped = clampWatchVolume(volume);
  if (!Number.isFinite(step) || step <= 0) return clamped;
  const quantized = Math.round(clamped / step) * step;
  return clampWatchVolume(Number(quantized.toFixed(2)));
}

export function parseWatchVolumePreference(
  raw: string | null | undefined
): number {
  if (raw == null || raw === "") return DEFAULT_WATCH_VOLUME;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_WATCH_VOLUME;
  return quantizeWatchVolume(parsed);
}

export function serializeWatchVolumePreference(volume: number): string {
  return String(quantizeWatchVolume(volume));
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

/** Android RecyclerView/getInt requires whole pixels. Fold6 heights are fractional. */
export function toWatchListPixels(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const pixels = Math.round(value);
  return pixels > 0 ? pixels : null;
}

/** Viewability / claimActiveIndex must be a whole list index. */
export function sanitizeWatchListIndex(index: number): number | null {
  if (!Number.isFinite(index) || index < 0) return null;
  const whole = Math.trunc(index);
  if (Math.abs(index - whole) > 1e-6) return null;
  return whole;
}

/** Pixel offset for FlatList scrollToOffset (index * measured item height). */
export function resolveWatchScrollOffset(
  index: number,
  itemHeight: number
): number | null {
  const safeIndex = sanitizeWatchListIndex(index);
  const pixels = toWatchListPixels(itemHeight);
  if (safeIndex == null || pixels == null) return null;
  return safeIndex * pixels;
}

/**
 * While a programmatic auto-next scroll is in flight, ignore viewability
 * updates that would snap activeIndex back to the previous item.
 */
export function shouldAcceptViewableIndexUpdate(input: {
  nowMs: number;
  lockUntilMs: number;
}): boolean {
  if (!Number.isFinite(input.nowMs) || !Number.isFinite(input.lockUntilMs)) {
    return true;
  }
  return input.nowMs >= input.lockUntilMs;
}

/** Clamp a unit scrub ratio to 0..1. */
export function clampUnitRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(1, Math.max(0, ratio));
}

/**
 * Stable scrub math for Android: pageX relative to measureInWindow track origin.
 */
export function resolveScrubRatioFromPageX(
  pageX: number,
  trackX: number,
  trackWidth: number
): number {
  if (!Number.isFinite(pageX) || !Number.isFinite(trackX)) return 0;
  if (!Number.isFinite(trackWidth) || trackWidth <= 0) return 0;
  return clampUnitRatio((pageX - trackX) / trackWidth);
}

/**
 * Seek uses physical pageX (left → right). The fill/thumb must share that
 * origin. Yoga `width%` otherwise grows from the RTL start edge while
 * `left%` stays physical-left — a second cyan segment on Arabic Watch.
 */
export const WATCH_SCRUB_LAYOUT_DIRECTION = "ltr" as const;

export function scrubFillWidthPercent(ratio: number): `${number}%` {
  return `${clampUnitRatio(ratio) * 100}%`;
}

export function scrubThumbLeftPercent(ratio: number): `${number}%` {
  return `${clampUnitRatio(ratio) * 100}%`;
}

export function canSeekWithDuration(duration: number): boolean {
  return Number.isFinite(duration) && duration > 0;
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
  if (!canSeekWithDuration(duration)) return 0;
  return clampUnitRatio(ratio) * duration;
}

/** Seek seconds when duration is ready; otherwise null (ignore seek). */
export function resolveSeekTimeOrNull(
  ratio: number,
  duration: number
): number | null {
  if (!canSeekWithDuration(duration)) return null;
  return resolveSeekTime(ratio, duration);
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
