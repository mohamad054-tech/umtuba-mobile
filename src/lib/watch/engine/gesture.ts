import { clampWatchEngineIndex } from "./identity";
import type { WatchEngineDirection } from "./types";

/** Owner-accepted short deliberate commit. New math, not the old handoff machine. */
export const WATCH_ENGINE_COMMIT_FRACTION = 0.1;

/** Velocity-sensitive flick. Distance still wins when the finger traveled 10%. */
export const WATCH_ENGINE_FLICK_PAGES_PER_SEC = 1;

export type WatchEngineReleaseDecision = {
  fromIndex: number;
  targetIndex: number;
  direction: WatchEngineDirection;
  pageFraction: number;
  reason: "commit" | "flick" | "hold";
};

export function watchEnginePagesPerSecond(input: {
  velocityY?: number | null;
  itemHeight: number;
}): number {
  if (
    input.velocityY == null ||
    !Number.isFinite(input.velocityY) ||
    !Number.isFinite(input.itemHeight) ||
    input.itemHeight <= 0
  ) {
    return 0;
  }
  return input.velocityY / input.itemHeight;
}

export function resolveWatchEngineReleaseTarget(input: {
  fromIndex: number;
  currentOffset: number;
  dragStartOffset: number;
  itemHeight: number;
  itemCount: number;
  velocityY?: number | null;
}): WatchEngineReleaseDecision | null {
  if (!Number.isFinite(input.itemHeight) || input.itemHeight <= 0) return null;
  if (!Number.isFinite(input.itemCount) || input.itemCount <= 0) return null;
  if (!Number.isFinite(input.currentOffset) || input.currentOffset < 0) {
    return null;
  }
  if (!Number.isFinite(input.dragStartOffset) || input.dragStartOffset < 0) {
    return null;
  }
  const from = clampWatchEngineIndex(input.fromIndex, input.itemCount);
  if (from == null) return null;

  const delta = input.currentOffset - input.dragStartOffset;
  const pageFraction = Math.abs(delta) / input.itemHeight;
  const signedPages = watchEnginePagesPerSecond({
    velocityY: input.velocityY,
    itemHeight: input.itemHeight,
  });

  let direction: WatchEngineDirection = "none";
  if (delta > 0) direction = "forward";
  else if (delta < 0) direction = "backward";

  const candidate =
    direction === "forward"
      ? from + 1
      : direction === "backward"
        ? from - 1
        : from;
  const target = clampWatchEngineIndex(candidate, input.itemCount) ?? from;

  const committedDistance =
    Math.abs(delta) + 1e-6 >= input.itemHeight * WATCH_ENGINE_COMMIT_FRACTION;
  if (committedDistance && target !== from) {
    return {
      fromIndex: from,
      targetIndex: target,
      direction,
      pageFraction,
      reason: "commit",
    };
  }

  const velocityAgrees =
    direction === "forward"
      ? signedPages > 0
      : direction === "backward"
        ? signedPages < 0
        : false;
  if (
    velocityAgrees &&
    Math.abs(signedPages) >= WATCH_ENGINE_FLICK_PAGES_PER_SEC &&
    target !== from
  ) {
    return {
      fromIndex: from,
      targetIndex: target,
      direction,
      pageFraction,
      reason: "flick",
    };
  }

  return {
    fromIndex: from,
    targetIndex: from,
    direction: "none",
    pageFraction,
    reason: "hold",
  };
}

export function watchEngineOffsetForIndex(
  index: number,
  itemHeight: number
): number | null {
  if (!Number.isFinite(index) || index < 0) return null;
  if (!Number.isFinite(itemHeight) || itemHeight <= 0) return null;
  return Math.trunc(index) * itemHeight;
}
