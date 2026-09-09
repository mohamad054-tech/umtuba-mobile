import { describe, expect, it } from "vitest";

import {
  WATCH_DOUBLE_TAP_WINDOW_MS,
  resolveWatchTapAction,
  shouldDispatchWatchTapAfterTouch,
  shouldWatchScrubClaimGesture,
  shouldWatchTapLayerYieldVertical,
} from "@/src/lib/watch/watchGestures";

import {
  resolveWatchEngineReleaseTarget,
  WATCH_ENGINE_COMMIT_FRACTION,
  WATCH_ENGINE_FLICK_PAGES_PER_SEC,
} from "./gesture";

const HEIGHT = 2376;

const FOLD6_COVER_CELL_PX = 2121;

describe("resolveWatchEngineReleaseTarget", () => {
  it("keeps the owner-authorized 10 percent commit and the existing flick velocity", () => {
    expect(WATCH_ENGINE_COMMIT_FRACTION).toBe(0.1);
    expect(WATCH_ENGINE_FLICK_PAGES_PER_SEC).toBe(1);
  });

  it("commits a short deliberate 10% forward swipe", () => {
    const next = resolveWatchEngineReleaseTarget({
      fromIndex: 1,
      dragStartOffset: HEIGHT,
      currentOffset: HEIGHT + HEIGHT * WATCH_ENGINE_COMMIT_FRACTION,
      itemHeight: HEIGHT,
      itemCount: 20,
    });
    expect(next?.reason).toBe("commit");
    expect(next?.targetIndex).toBe(2);
  });

  it("commits a 10% backward swipe", () => {
    const next = resolveWatchEngineReleaseTarget({
      fromIndex: 2,
      dragStartOffset: 2 * HEIGHT,
      currentOffset: 2 * HEIGHT - HEIGHT * WATCH_ENGINE_COMMIT_FRACTION,
      itemHeight: HEIGHT,
      itemCount: 20,
    });
    expect(next?.targetIndex).toBe(1);
    expect(next?.direction).toBe("backward");
  });

  it("holds below 10% and commits at 10% on the Fold6 cover cell", () => {
    const hold = resolveWatchEngineReleaseTarget({
      fromIndex: 0,
      dragStartOffset: 0,
      currentOffset: FOLD6_COVER_CELL_PX * 0.1 - 1,
      itemHeight: FOLD6_COVER_CELL_PX,
      itemCount: 10,
    });
    expect(hold?.reason).toBe("hold");
    expect(hold?.targetIndex).toBe(0);

    const commit = resolveWatchEngineReleaseTarget({
      fromIndex: 0,
      dragStartOffset: 0,
      currentOffset: FOLD6_COVER_CELL_PX * 0.1,
      itemHeight: FOLD6_COVER_CELL_PX,
      itemCount: 10,
    });
    expect(commit?.reason).toBe("commit");
    expect(commit?.targetIndex).toBe(1);
    expect(Math.round(FOLD6_COVER_CELL_PX * WATCH_ENGINE_COMMIT_FRACTION)).toBe(
      212
    );
  });

  it("does not require 50% or 80% travel", () => {
    const next = resolveWatchEngineReleaseTarget({
      fromIndex: 0,
      dragStartOffset: 0,
      currentOffset: HEIGHT * 0.21,
      itemHeight: HEIGHT,
      itemCount: 10,
    });
    expect(next?.targetIndex).toBe(1);
  });

  it("flicks when velocity is at least one page per second", () => {
    const next = resolveWatchEngineReleaseTarget({
      fromIndex: 3,
      dragStartOffset: 3 * HEIGHT,
      currentOffset: 3 * HEIGHT + HEIGHT * 0.08,
      itemHeight: HEIGHT,
      itemCount: 10,
      velocityY: HEIGHT * WATCH_ENGINE_FLICK_PAGES_PER_SEC,
    });
    expect(next?.reason).toBe("flick");
    expect(next?.targetIndex).toBe(4);
  });

  it("measures from drag-start offset, not a reconstructed page origin", () => {
    const next = resolveWatchEngineReleaseTarget({
      fromIndex: 1,
      dragStartOffset: HEIGHT * 0.15,
      currentOffset: HEIGHT * 0.15 + HEIGHT * 0.22,
      itemHeight: HEIGHT,
      itemCount: 10,
    });
    expect(next?.targetIndex).toBe(2);
  });

  it("still flicks below the 10 percent distance when velocity is one page per second", () => {
    const next = resolveWatchEngineReleaseTarget({
      fromIndex: 3,
      dragStartOffset: 3 * HEIGHT,
      currentOffset: 3 * HEIGHT + HEIGHT * 0.08,
      itemHeight: HEIGHT,
      itemCount: 10,
      velocityY: HEIGHT * WATCH_ENGINE_FLICK_PAGES_PER_SEC,
    });
    expect(next?.reason).toBe("flick");
    expect(next?.targetIndex).toBe(4);
    expect(0.08).toBeLessThan(WATCH_ENGINE_COMMIT_FRACTION);
  });

  it("holds when travel and flick are both short", () => {
    const next = resolveWatchEngineReleaseTarget({
      fromIndex: 5,
      dragStartOffset: 5 * HEIGHT,
      currentOffset: 5 * HEIGHT + HEIGHT * 0.05,
      itemHeight: HEIGHT,
      itemCount: 10,
      velocityY: 10,
    });
    expect(next?.reason).toBe("hold");
    expect(next?.targetIndex).toBe(5);
  });
});

describe("10 percent threshold does not rewrite sibling Watch contracts", () => {
  it("keeps horizontal scrub claiming horizontal travel only", () => {
    expect(shouldWatchScrubClaimGesture({ dx: 12, dy: 2 })).toBe(true);
    expect(shouldWatchScrubClaimGesture({ dx: 2, dy: 16 })).toBe(false);
  });

  it("keeps tap vs vertical yield and does not turn a short tap into a swipe", () => {
    expect(shouldWatchTapLayerYieldVertical({ dx: 2, dy: 12 })).toBe(true);
    expect(shouldDispatchWatchTapAfterTouch({ dx: 0, dy: 2 })).toBe(true);
    expect(
      shouldDispatchWatchTapAfterTouch({ dx: 0, dy: 16, yieldedVertical: true })
    ).toBe(false);
  });

  it("keeps double-tap classified as double, not a single pause", () => {
    expect(
      resolveWatchTapAction({
        nowMs: 1000 + WATCH_DOUBLE_TAP_WINDOW_MS,
        lastTapAt: 1000,
      }).action
    ).toBe("double");
  });
});
