import { describe, expect, it } from "vitest";

import { WATCH_ENGINE_COMMIT_FRACTION } from "./gesture";
import {
  remainingWatchEngineSnapDistance,
  resolveWatchEngineSnapDurationMs,
  resolveWatchEngineSnapOffset,
  shouldUseNativeAnimatedScrollToOffset,
  watchEngineRemainingAfterCommit,
  watchEngineSnapKeepsCommitFraction,
  WATCH_ENGINE_NATIVE_SMOOTH_SCROLL_MS,
  WATCH_ENGINE_SNAP_DURATION_MS,
} from "./snap";

const FOLD6_CELL = 2121;

describe("watch engine snap speed", () => {
  it("keeps the 10 percent commit and does not use native animated scrollTo", () => {
    expect(WATCH_ENGINE_COMMIT_FRACTION).toBe(0.1);
    expect(watchEngineSnapKeepsCommitFraction()).toBe(true);
    expect(shouldUseNativeAnimatedScrollToOffset()).toBe(false);
  });

  it("measures remaining distance after a 10 percent Fold6 cover commit", () => {
    const traveled = FOLD6_CELL * WATCH_ENGINE_COMMIT_FRACTION;
    expect(Math.round(traveled)).toBe(212);
    expect(
      Math.round(watchEngineRemainingAfterCommit({ itemHeight: FOLD6_CELL, traveledPx: traveled }))
    ).toBe(1909);
    expect(
      remainingWatchEngineSnapDistance({
        currentOffset: traveled,
        targetOffset: FOLD6_CELL,
      })
    ).toBeCloseTo(1909, 0);
  });

  it("uses a short fixed snap instead of the native 250ms ease-out", () => {
    expect(WATCH_ENGINE_NATIVE_SMOOTH_SCROLL_MS).toBe(250);
    expect(resolveWatchEngineSnapDurationMs()).toBe(120);
    expect(WATCH_ENGINE_SNAP_DURATION_MS).toBeLessThan(
      WATCH_ENGINE_NATIVE_SMOOTH_SCROLL_MS
    );
  });

  it("snaps hold and advance to the same layout offsets as before", () => {
    expect(resolveWatchEngineSnapOffset({ index: 0, itemHeight: FOLD6_CELL })).toBe(0);
    expect(resolveWatchEngineSnapOffset({ index: 2, itemHeight: FOLD6_CELL })).toBe(
      4242
    );
  });
});
