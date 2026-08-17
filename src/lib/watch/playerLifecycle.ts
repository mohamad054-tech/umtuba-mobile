/**
 * Shared Watch player lifecycle.
 *
 * PRODUCT: ONLY_ACTIVE_WATCH_POST_CAN_PRODUCE_AUDIO
 * IMPLEMENTATION: pause + mute + loop=false on still-mounted non-active
 * players. Native release is owned by useVideoPlayer / useReleasingSharedObject.
 * JS must detach (mark dead, drop refs) and never call play/pause/mute after.
 *
 * iOS: do not play/pause/seek until AVPlayerItem is ready. Pause-during-replace
 * after a ±1 remount is the Build 15 intermittent "resource unavailable" class.
 */

import { shouldLoadPlayer } from "./playbackPolicy";

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

/** Unmount/swap must not invoke player methods. Native release owns teardown. */
export function shouldCallPlayerMethodsOnUnmount(): false {
  return false;
}

export function resolveWatchNativePlatform(
  os: string | null | undefined
): WatchNativePlatform {
  return os === "ios" ? "ios" : "android";
}

/**
 * iOS must not issue play/pause/seek until the item is ready.
 * Mute/volume/loop chrome is always safe. Android may transport immediately.
 */
export function shouldApplyWatchTransport(input: {
  playerAlive: boolean;
  itemReady: boolean;
  kind: WatchTransportKind;
  platform: WatchNativePlatform;
}): boolean {
  if (!input.playerAlive) return false;
  if (input.kind === "chrome") return true;
  if (input.platform === "ios" && !input.itemReady) return false;
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
  itemCount: number
): number[] {
  const mounted: number[] = [];
  for (let index = 0; index < itemCount; index += 1) {
    if (shouldLoadPlayer(index, activeIndex)) {
      mounted.push(index);
    }
  }
  return mounted;
}

/** Indexes that leave the ±1 window and later remount (A→B→C→B remounts 0). */
export function watchWindowRemounts(
  sequence: number[],
  itemCount: number
): number[] {
  const remounted: number[] = [];
  let previous = new Set<number>();
  for (const active of sequence) {
    const next = new Set(watchWindowMountedIndexes(active, itemCount));
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
