import {
  WATCH_ENGINE_COMMIT_FRACTION,
  watchEngineOffsetForIndex,
} from "./gesture";

/**
 * Android ScrollView.smoothScrollTo uses OverScroller DEFAULT_DURATION (250ms)
 * and eases out. After a 10% commit the remaining ~90% of the cell crawls.
 */
export const WATCH_ENGINE_NATIVE_SMOOTH_SCROLL_MS = 250;

/** Short UI-thread snap. Owner feel on Fold6 can retune this; not a locked contract. */
export const WATCH_ENGINE_SNAP_DURATION_MS = 120;

export function remainingWatchEngineSnapDistance(input: {
  currentOffset: number;
  targetOffset: number;
}): number {
  if (!Number.isFinite(input.currentOffset) || !Number.isFinite(input.targetOffset)) {
    return 0;
  }
  return Math.abs(input.targetOffset - input.currentOffset);
}

export function watchEngineRemainingAfterCommit(input: {
  itemHeight: number;
  traveledPx: number;
}): number {
  if (!Number.isFinite(input.itemHeight) || input.itemHeight <= 0) return 0;
  const traveled = Number.isFinite(input.traveledPx) ? Math.max(0, input.traveledPx) : 0;
  return Math.max(0, input.itemHeight - traveled);
}

export function resolveWatchEngineSnapDurationMs(): number {
  return WATCH_ENGINE_SNAP_DURATION_MS;
}

export function shouldUseNativeAnimatedScrollToOffset(): false {
  return false;
}

export function watchEngineSnapKeepsCommitFraction(): boolean {
  return WATCH_ENGINE_COMMIT_FRACTION === 0.1;
}

export function resolveWatchEngineSnapOffset(input: {
  index: number;
  itemHeight: number;
}): number | null {
  return watchEngineOffsetForIndex(input.index, input.itemHeight);
}
