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

/**
 * Keep a bounded 3-item playback window: previous + current + next.
 * Android TextureView stays active-only (load window 0). Neighbors keep a
 * silent prepared player so back does not remount and N+2 starts when the
 * window slides. Never the whole feed.
 */
export function resolveWatchPlayerPrepareWindow(
  _platform?: string | null
): number {
  return 1;
}

export function shouldPrepareWatchPlayer(
  index: number,
  activeIndex: number,
  platform?: string | null
): boolean {
  if (!Number.isFinite(index) || !Number.isFinite(activeIndex)) {
    return false;
  }
  void platform;
  return (
    Math.abs(index - activeIndex) <= resolveWatchPlayerPrepareWindow(platform)
  );
}

/**
 * Attach the next Android TextureView only after ExoPlayer is READY and
 * the current clip is near end. Off-screen, next-only — not a visible
 * second player and not a ±1 window.
 */
export const ANDROID_NEXT_SURFACE_WARM_REMAINING_MS = 1800;
export const ANDROID_HANDOFF_WAIT_MS = 700;

export function resolveAndroidNextWarmIndex(
  activeIndex: number,
  itemCount: number
): number | null {
  if (!Number.isFinite(activeIndex) || !Number.isFinite(itemCount)) {
    return null;
  }
  const current = Math.trunc(activeIndex);
  const next = current + 1;
  if (current < 0 || next >= Math.trunc(itemCount)) return null;
  return next;
}

export function resolveAndroidPreviousWarmIndex(
  activeIndex: number
): number | null {
  if (!Number.isFinite(activeIndex)) return null;
  const previous = Math.trunc(activeIndex) - 1;
  return previous >= 0 ? previous : null;
}

export type WatchWarmDirection = "forward" | "backward";

export function resolveWatchWarmDirection(input: {
  previousActiveIndex: number;
  nextActiveIndex: number;
}): WatchWarmDirection {
  if (
    Number.isFinite(input.previousActiveIndex) &&
    Number.isFinite(input.nextActiveIndex) &&
    input.nextActiveIndex < input.previousActiveIndex
  ) {
    return "backward";
  }
  return "forward";
}

/** One off-screen neighbor: next after a forward settle, previous after a back settle. */
export function resolveAndroidDirectionalWarmIndex(
  activeIndex: number,
  itemCount: number,
  direction: WatchWarmDirection
): number | null {
  if (direction === "backward") {
    return resolveAndroidPreviousWarmIndex(activeIndex);
  }
  return resolveAndroidNextWarmIndex(activeIndex, itemCount);
}

/** Backward settle must not also latch the unused forward TextureView. */
export function shouldLatchAndroidForwardWarmSurface(input: {
  direction: WatchWarmDirection;
  warmIndex: number | null;
}): boolean {
  return input.direction === "forward" && input.warmIndex != null;
}

/** First-frame from a detached or newly reattached surface must not unlock audio. */
export function shouldPreserveWatchFirstFrameAcrossSurface(input: {
  wasAttached: boolean;
  isAttached: boolean;
}): boolean {
  return input.wasAttached === true && input.isAttached === true;
}

export function shouldWarmAndroidNextSurface(input: {
  platform?: string | null;
  remainingMs: number | null | undefined;
  ended?: boolean;
  nextPrepared?: boolean;
}): boolean {
  if (input.platform !== "android") return false;
  if (input.nextPrepared === true) return true;
  if (input.ended === true) return true;
  if (input.remainingMs == null || !Number.isFinite(input.remainingMs)) {
    return false;
  }
  return input.remainingMs <= ANDROID_NEXT_SURFACE_WARM_REMAINING_MS;
}

/**
 * Surface mount from the last owner-working Watch runtime (b5cba17).
 * Active load-window cells always attach. Android may also attach the
 * next prepared neighbor once it is READY and warmed — that handoff
 * TextureView must not own paging or activeIndex.
 */
export function shouldAttachWatchSurface(input: {
  loadPlayer: boolean;
  preparePlayer: boolean;
  itemReady: boolean;
  warmNextSurface: boolean;
  isNextItem?: boolean;
  platform?: string | null;
}): boolean {
  void input.isNextItem;
  if (input.loadPlayer) return true;
  if (input.platform !== "android") return false;
  return (
    input.preparePlayer === true &&
    input.itemReady === true &&
    input.warmNextSurface === true
  );
}

export type WatchHandoffReadiness =
  | "blocked"
  | "ready-buffered"
  | "ready-to-render";

export function resolveWatchHandoffReadiness(input: {
  nextReady: boolean;
  nextFirstFrame: boolean;
}): WatchHandoffReadiness {
  if (input.nextFirstFrame) return "ready-to-render";
  if (input.nextReady) return "ready-buffered";
  return "blocked";
}

/**
 * Prefer first-frame (decoder + TextureView). After max wait, advance
 * anyway so the last frame cannot stall forever.
 */
export function shouldHandoffWatchAdvance(input: {
  nextFirstFrame: boolean;
  waitedMs: number;
  maxWaitMs?: number;
}): boolean {
  if (input.nextFirstFrame) return true;
  if (!Number.isFinite(input.waitedMs) || input.waitedMs < 0) return false;
  const max = input.maxWaitMs ?? ANDROID_HANDOFF_WAIT_MS;
  return input.waitedMs >= max;
}

/** First-seen media/post identity wins. Later duplicates are dropped. */
export function dedupeWatchVideosPreserveOrder(
  videos: readonly WatchVideo[]
): WatchVideo[] {
  const seen = new Set<string>();
  const next: WatchVideo[] = [];
  for (const video of videos) {
    const key = watchItemKey(video);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(video);
  }
  return next;
}

/** Append page results without duplicating post/media ids or reordering. */
export function mergeWatchVideos(
  existing: WatchVideo[],
  incoming: WatchVideo[]
): WatchVideo[] {
  if (incoming.length === 0) {
    return dedupeWatchVideosPreserveOrder(existing);
  }
  return dedupeWatchVideosPreserveOrder([...existing, ...incoming]);
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
 * Diagnostic helper only. Watch paging ownership is viewability +
 * claimActiveIndex. Cache / scroll-offset math must not write activeIndex.
 */
export function resolveWatchIndexFromScrollOffset(
  offset: number,
  itemHeight: number,
  itemCount: number
): number | null {
  if (!Number.isFinite(offset) || offset < 0) return null;
  if (!Number.isFinite(itemCount) || itemCount <= 0) return null;
  const pixels = toWatchListPixels(itemHeight);
  if (pixels == null) return null;
  const raw = Math.round(offset / pixels);
  if (raw < 0) return 0;
  if (raw >= itemCount) return itemCount - 1;
  return raw;
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

/** Highest percentVisible viewable cell. Never the first array hit. */
export function resolveMostVisibleWatchIndex(
  items: ReadonlyArray<{
    index?: number | null;
    isViewable?: boolean;
    percentVisible?: number | null;
  }>
): number | null {
  let bestIndex: number | null = null;
  let bestPercent = -1;
  for (const item of items) {
    if (item.isViewable === false) continue;
    const safe = sanitizeWatchListIndex(item.index ?? Number.NaN);
    if (safe == null) continue;
    const percent =
      typeof item.percentVisible === "number" &&
      Number.isFinite(item.percentVisible)
        ? item.percentVisible
        : item.isViewable === true
          ? 80
          : 0;
    if (percent > bestPercent) {
      bestPercent = percent;
      bestIndex = safe;
    }
  }
  return bestIndex;
}

/**
 * Native settled page owns activeIndex. A stale lower-index viewability
 * hit cannot steal the page after a real 0→1 swipe.
 */
export function resolveWatchOwnedIndex(input: {
  nativePage: number | null;
  mostVisibleIndex: number | null;
  currentIndex?: number | null;
  nativeOffsetKnown?: boolean;
}): number | null {
  const native = sanitizeWatchListIndex(input.nativePage ?? Number.NaN);
  const visible = sanitizeWatchListIndex(
    input.mostVisibleIndex ?? Number.NaN
  );
  const current = sanitizeWatchListIndex(input.currentIndex ?? Number.NaN);

  if (input.nativeOffsetKnown === true && native != null) {
    return native;
  }

  if (visible != null) {
    if (current != null && visible < current) return current;
    return visible;
  }
  if (native != null) return native;
  return current;
}

/** First 80%-visible item is the only manual paging source. */
export function resolveWatchActiveIndexFromViewableItems(input: {
  viewableIndexes: readonly (number | null | undefined)[];
  nowMs: number;
  lockUntilMs: number;
}): number | null {
  if (
    !shouldAcceptViewableIndexUpdate({
      nowMs: input.nowMs,
      lockUntilMs: input.lockUntilMs,
    })
  ) {
    return null;
  }
  return resolveMostVisibleWatchIndex(
    input.viewableIndexes.map((index) => ({
      index,
      isViewable: index != null,
    }))
  );
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

/**
 * Hide the interactive scrub affordance on very short clips.
 * Seek math (`canSeekWithDuration` / RTL fill) is unchanged.
 */
export const WATCH_SCRUB_MIN_DURATION_SEC = 8;

export function shouldExposeWatchScrub(durationSec: number): boolean {
  return (
    canSeekWithDuration(durationSec) &&
    durationSec >= WATCH_SCRUB_MIN_DURATION_SEC
  );
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

/** First-video tap: handler, pause command, and latch against lifecycle resume. */
export function resolveWatchTapPauseCommand(input: {
  isActive: boolean;
  feedShouldPlay: boolean;
  paneStatus: string;
  userPaused: boolean;
}): {
  invokeHandler: boolean;
  nextUserPaused: boolean;
  shouldPlay: boolean;
  pauseCommand: boolean;
} {
  const invokeHandler =
    input.paneStatus !== "error" &&
    input.isActive &&
    input.feedShouldPlay;
  if (!invokeHandler) {
    return {
      invokeHandler: false,
      nextUserPaused: input.userPaused,
      shouldPlay: shouldPlayWithUserPause({
        feedShouldPlay: input.feedShouldPlay,
        userPaused: input.userPaused,
        isActive: input.isActive,
      }),
      pauseCommand: false,
    };
  }
  const nextUserPaused = !input.userPaused;
  return {
    invokeHandler: true,
    nextUserPaused,
    shouldPlay: shouldPlayWithUserPause({
      feedShouldPlay: input.feedShouldPlay,
      userPaused: nextUserPaused,
      isActive: true,
    }),
    pauseCommand: nextUserPaused,
  };
}

/** readyToPlay / status must not resume a latched user pause. */
export function shouldLifecycleResumeAfterUserPause(input: {
  userPaused: boolean;
  lifecycleWantsPlay: boolean;
}): boolean {
  if (input.userPaused) return false;
  return input.lifecycleWantsPlay;
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
