import type { WatchVideo } from "@/src/contracts/watch";

import { watchItemKey } from "./playbackPolicy";

/** Stable media/post identity. Never use visible list index as the media key. */
export function watchMediaIdentity(video: {
  id: string;
  postId?: number | null;
}): string {
  return watchItemKey(video as WatchVideo);
}

export type WatchCellBindSnapshot = {
  visibleIndex: number;
  visibleMediaId: string;
  activeIndex: number;
  activeMediaId: string;
  playerMediaId: string;
  cachedMediaId?: string | null;
  surfaceMediaId?: string | null;
};

export function isWatchCellBindingAligned(
  snapshot: WatchCellBindSnapshot
): boolean {
  if (snapshot.visibleIndex !== snapshot.activeIndex) return false;
  if (snapshot.visibleMediaId !== snapshot.activeMediaId) return false;
  if (snapshot.visibleMediaId !== snapshot.playerMediaId) return false;
  if (
    snapshot.surfaceMediaId != null &&
    snapshot.surfaceMediaId !== snapshot.visibleMediaId
  ) {
    return false;
  }
  if (
    snapshot.cachedMediaId != null &&
    snapshot.cachedMediaId !== snapshot.visibleMediaId
  ) {
    return false;
  }
  return true;
}

export type WatchSequenceStep = {
  index: number;
  mediaId: string;
  playerMediaId: string;
  surfaceMediaId: string;
};

/**
 * 1 → 2 → 3 must keep picture, audio, and cell identity on the same post.
 * A one-cell-late surface (audio N + picture N-1) fails this check.
 */
export function watchSequenceStaysAligned(
  steps: readonly WatchSequenceStep[]
): boolean {
  if (steps.length < 3) return false;
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    if (!step) return false;
    if (step.playerMediaId !== step.mediaId) return false;
    if (step.surfaceMediaId !== step.mediaId) return false;
    if (i === 0) continue;
    const previous = steps[i - 1];
    if (!previous) return false;
    if (step.index !== previous.index + 1) return false;
    if (step.mediaId === previous.mediaId) return false;
  }
  return true;
}

export function isOneCellLateBinding(input: {
  visibleIndex: number;
  surfaceIndex: number;
}): boolean {
  if (!Number.isFinite(input.visibleIndex) || !Number.isFinite(input.surfaceIndex)) {
    return false;
  }
  return input.surfaceIndex === input.visibleIndex - 1;
}
