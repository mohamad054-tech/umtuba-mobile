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
  const seen = new Set<string>();
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    if (!step) return false;
    if (step.playerMediaId !== step.mediaId) return false;
    if (step.surfaceMediaId !== step.mediaId) return false;
    if (seen.has(step.mediaId)) return false;
    seen.add(step.mediaId);
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

export type WatchBoundCellSource = {
  mediaId: string;
  src: string;
  mustReplace: boolean;
};

/**
 * Recycled cells keep the previous player/src until identity is compared.
 * Replace before activating so video 2 cannot play video 1's surface.
 */
export function resolveWatchBoundCellSource(input: {
  cellMediaId: string;
  cellSrc: string;
  playerMediaId: string | null;
  playerSrc: string | null;
}): WatchBoundCellSource {
  const src = (input.cellSrc ?? "").trim();
  const playerMediaId = input.playerMediaId;
  const playerSrc = (input.playerSrc ?? "").trim();
  if (playerMediaId == null || playerMediaId !== input.cellMediaId) {
    return { mediaId: input.cellMediaId, src, mustReplace: true };
  }
  if (playerSrc !== src) {
    return { mediaId: input.cellMediaId, src, mustReplace: true };
  }
  return { mediaId: input.cellMediaId, src, mustReplace: false };
}

export function shouldReplaceWatchCellSource(input: {
  cellMediaId: string;
  cellSrc: string;
  playerMediaId: string | null;
  playerSrc: string | null;
}): boolean {
  return resolveWatchBoundCellSource(input).mustReplace;
}

export type WatchSwipeBindStep = {
  visibleIndex: number;
  visibleMediaId: string;
  cellKey: string;
  playerMediaId: string;
  surfaceMediaId: string;
  cachedMediaId?: string | null;
  audioMediaId: string;
};

/** 1→2: picture, audio, cell, player, and cache must all be post 2. */
export function isWatchSwipeBindingCorrect(
  step: WatchSwipeBindStep
): boolean {
  return isWatchCellBindingAligned({
    visibleIndex: step.visibleIndex,
    visibleMediaId: step.visibleMediaId,
    activeIndex: step.visibleIndex,
    activeMediaId: step.visibleMediaId,
    playerMediaId: step.playerMediaId,
    cachedMediaId: step.cachedMediaId,
    surfaceMediaId: step.surfaceMediaId,
  })
    && step.cellKey === step.visibleMediaId
    && step.audioMediaId === step.visibleMediaId
    && step.playerMediaId === step.visibleMediaId;
}

/** Cached backward target must reacquire the same media/surface, never a black hole. */
export function shouldRebindRetainedWatchSurface(input: {
  direction: "backward" | "forward";
  cachedHit: boolean;
  playerMediaId: string;
  targetMediaId: string;
  surfaceAttached: boolean;
}): boolean {
  if (input.direction !== "backward") return false;
  if (!input.cachedHit) return false;
  if (input.playerMediaId !== input.targetMediaId) return true;
  return input.surfaceAttached !== true;
}

export function isBackwardRetainedPlaybackCoherent(input: {
  visibleIndex: number;
  committedIndex: number;
  playerMediaId: string;
  targetMediaId: string;
  surfaceAttached: boolean;
  firstFrame: boolean;
  audibleOwnerIndex: number | null;
  blackSurface: boolean;
}): boolean {
  if (input.visibleIndex !== input.committedIndex) return false;
  if (input.playerMediaId !== input.targetMediaId) return false;
  if (!input.surfaceAttached || !input.firstFrame) return false;
  if (input.blackSurface) return false;
  if (
    input.audibleOwnerIndex != null &&
    input.audibleOwnerIndex !== input.committedIndex
  ) {
    return false;
  }
  return true;
}

export function isVisibleIndexSurfaceAudioAtomic(input: {
  visiblePage: number;
  committedIndex: number;
  presentationOwner: number;
  boundMediaId: string;
  committedMediaId: string;
  audibleOwnerIndex: number | null;
}): boolean {
  if (input.visiblePage !== input.committedIndex) return false;
  if (input.presentationOwner !== input.committedIndex) return false;
  if (input.boundMediaId !== input.committedMediaId) return false;
  if (input.audibleOwnerIndex == null) return true;
  return input.audibleOwnerIndex === input.committedIndex;
}
