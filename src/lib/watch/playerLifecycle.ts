/**
 * Shared Watch player lifecycle.
 *
 * PRODUCT: ONLY_ACTIVE_WATCH_POST_CAN_PRODUCE_AUDIO
 * ACTIVE_PLAYING_VIDEO_COUNT <= 1
 *
 * iOS may keep a ±1 preload window mounted. Android mounts the active
 * item only (dd86a3e). Mounted != audible. Neighbors stay silent.
 *
 * Release sequence: silence while the SharedObject is still alive, then
 * detach JS bindings. Native release is owned by useVideoPlayer /
 * useReleasingSharedObject. After detach, never call play/pause/mute.
 *
 * Play/seek wait until the item is ready. Silence of a non-owner must
 * not wait — that was Build 24 leftover audio + post-asset stall.
 */

import { shouldLoadPlayer } from "./playbackPolicy";
import {
  applyInactiveAudioTeardown,
  runAlivePlayerOp,
  type PlayerLike,
} from "./playerSession";

export type WatchNativePlatform = "ios" | "android";
export type WatchTransportKind = "play" | "pause" | "seek" | "chrome";

export function detachWatchPlayerBinding(input: {
  markDead: () => void;
  clearPlayGeneration: () => void;
  dropBoundRef: () => void;
}): void {
  input.markDead();
  input.clearPlayGeneration();
  input.dropBoundRef();
}

/** After detach/markDead, do not invoke player methods. */
export function shouldCallPlayerMethodsOnUnmount(): false {
  return false;
}

/** Mute+pause the still-alive player before useReleasingSharedObject drops it. */
export function shouldSilencePlayerBeforeDetach(): true {
  return true;
}

export type WatchNativePlayerStatus =
  | "idle"
  | "loading"
  | "readyToPlay"
  | "error"
  | string
  | null
  | undefined;

export type WatchJsPlayerStatus = "idle" | "loading" | "ready" | "error";

/**
 * Native readyToPlay can beat the React bind. Record it and apply on bind
 * so the active item does not sit 12–20s waiting for a second statusChange.
 */
export function resolveNativePlayerStatusCatchup(input: {
  bound: boolean;
  nativeStatus: WatchNativePlayerStatus;
  jsStatus: WatchJsPlayerStatus;
}): WatchJsPlayerStatus | null {
  if (!input.bound) return null;
  if (input.nativeStatus === "readyToPlay" && input.jsStatus !== "ready") {
    return "ready";
  }
  if (input.nativeStatus === "error" && input.jsStatus !== "error") {
    return "error";
  }
  if (input.nativeStatus === "loading" && input.jsStatus === "idle") {
    return "loading";
  }
  return null;
}

export function shouldStartPlaybackAfterAsset(input: {
  nativeReady: boolean;
  jsReady: boolean;
  isActive: boolean;
  shouldPlay: boolean;
  playerAlive: boolean;
  ownerGeneration: number;
  commandGeneration: number;
}): boolean {
  if (!input.playerAlive) return false;
  if (!input.isActive || !input.shouldPlay) return false;
  if (!(input.nativeReady || input.jsReady)) return false;
  if (!Number.isFinite(input.ownerGeneration)) return false;
  if (!Number.isFinite(input.commandGeneration)) return false;
  return input.ownerGeneration === input.commandGeneration;
}

export type InactiveTeardownMode = "mute-and-pause" | "mute-only";

/**
 * iOS leftover AVPlayer audio is the Build 24 overlap class — always pause.
 * Android preparing ExoPlayer must not be paused before ready (dd86a3e).
 */
export function resolveInactiveTeardownMode(input: {
  platform: WatchNativePlatform;
  itemReady: boolean;
}): InactiveTeardownMode {
  if (input.platform === "ios") return "mute-and-pause";
  return input.itemReady ? "mute-and-pause" : "mute-only";
}

export function applyWatchInactiveTeardown(
  player: PlayerLike,
  input: { platform: WatchNativePlatform; itemReady: boolean }
): boolean {
  if (resolveInactiveTeardownMode(input) === "mute-only") {
    return runAlivePlayerOp(player, (alive) => {
      alive.muted = true;
      alive.volume = 0;
      alive.loop = false;
    });
  }
  return applyInactiveAudioTeardown(player, { resetPosition: false });
}

/** Silence first, then drop JS bindings. Safe if the object is already dead. */
export function releaseWatchPlayerBinding(input: {
  player: PlayerLike | null | undefined;
  markDead: () => void;
  clearPlayGeneration: () => void;
  dropBoundRef: () => void;
}): void {
  if (input.player) {
    applyInactiveAudioTeardown(input.player, { resetPosition: false });
  }
  detachWatchPlayerBinding({
    markDead: input.markDead,
    clearPlayGeneration: input.clearPlayGeneration,
    dropBoundRef: input.dropBoundRef,
  });
}

export function bumpWatchLeaveGeneration(prev: number): number {
  return nextPlayerInstanceGeneration(prev);
}

export function shouldHonorPlayerEventAfterLeave(input: {
  screenFocused: boolean;
  eventGeneration: number | null;
  ownerGeneration: number;
}): boolean {
  if (!input.screenFocused) return false;
  if (input.eventGeneration == null) return false;
  if (!Number.isFinite(input.ownerGeneration)) return false;
  if (!Number.isFinite(input.eventGeneration)) return false;
  return input.eventGeneration === input.ownerGeneration;
}

/** Neighbor cards may preload video, never a second selected-sound player. */
export function shouldMountSelectedSoundPlayer(input: {
  isActive: boolean;
  shouldLoadPlayer: boolean;
  uri: string | null | undefined;
}): boolean {
  return (
    input.isActive === true &&
    input.shouldLoadPlayer === true &&
    typeof input.uri === "string" &&
    input.uri.trim().length > 0
  );
}

export function resolveWatchNativePlatform(
  os: string | null | undefined
): WatchNativePlatform {
  return os === "ios" ? "ios" : "android";
}

/**
 * Do not issue play/pause/seek until the item is ready.
 * Mute/volume/loop chrome is always safe.
 * iOS: pause-during-replace after a ±1 remount was Build 15 "resource unavailable".
 * Android: play/pause on a preparing ExoPlayer can leave TextureView in "loading".
 */
export function shouldApplyWatchTransport(input: {
  playerAlive: boolean;
  itemReady: boolean;
  kind: WatchTransportKind;
  platform: WatchNativePlatform;
}): boolean {
  if (!input.playerAlive) return false;
  if (input.kind === "chrome") return true;
  if (!input.itemReady) return false;
  void input.platform;
  return true;
}

export function nextPlayerInstanceGeneration(prev: number): number {
  const base = Number.isFinite(prev) && prev >= 0 ? prev : 0;
  return base + 1;
}

/** Retry only the post that is currently active and showing the overlay. */
export function resolveRetryTargetPostId(input: {
  activePostId: number | null;
  overlayPostId: number | null;
}): number | null {
  if (input.activePostId == null || input.overlayPostId == null) return null;
  if (input.activePostId !== input.overlayPostId) return null;
  return input.activePostId;
}

export function isRetryHitTargetClear(input: {
  errorVisible: boolean;
  tapLayerBlocksRetry: boolean;
}): boolean {
  return input.errorVisible && !input.tapLayerBlocksRetry;
}

export type WatchPlayerSlot = {
  postKey: string;
  src: string;
  instanceGeneration: number;
};

export function shouldRecreateWatchPlayer(
  prev: WatchPlayerSlot | null,
  next: WatchPlayerSlot
): boolean {
  if (prev == null) return true;
  if (prev.postKey !== next.postKey) return true;
  if (prev.instanceGeneration !== next.instanceGeneration) return true;
  return prev.src !== next.src;
}

export function watchWindowMountedIndexes(
  activeIndex: number,
  itemCount: number,
  platform?: string | null
): number[] {
  const mounted: number[] = [];
  for (let index = 0; index < itemCount; index += 1) {
    if (shouldLoadPlayer(index, activeIndex, platform)) {
      mounted.push(index);
    }
  }
  return mounted;
}

/** Indexes that leave the load window and later remount (A→B→C→B remounts 0). */
export function watchWindowRemounts(
  sequence: number[],
  itemCount: number,
  platform?: string | null
): number[] {
  const remounted: number[] = [];
  let previous = new Set<number>();
  for (const active of sequence) {
    const next = new Set(watchWindowMountedIndexes(active, itemCount, platform));
    if (previous.size > 0) {
      for (const index of next) {
        if (!previous.has(index)) {
          remounted.push(index);
        }
      }
    }
    previous = next;
  }
  return remounted;
}
