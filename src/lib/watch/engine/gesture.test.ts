import { describe, expect, it } from "vitest";

import {
  resolveWatchEngineReleaseTarget,
  WATCH_ENGINE_COMMIT_FRACTION,
  WATCH_ENGINE_FLICK_PAGES_PER_SEC,
} from "./gesture";

const HEIGHT = 2376;

describe("resolveWatchEngineReleaseTarget", () => {
  it("commits a short deliberate ~20% forward swipe", () => {
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

  it("commits a 20% backward swipe", () => {
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
