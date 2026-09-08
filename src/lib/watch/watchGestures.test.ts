import { describe, expect, it, vi } from "vitest";

import { isRetryHitTargetClear } from "./playerLifecycle";
import {
  WATCH_DOUBLE_TAP_WINDOW_MS,
  createWatchTapClassifier,
  resolveWatchTapAction,
  shouldDispatchWatchTapAfterTouch,
  shouldDispatchWatchVideoTap,
  shouldEnableWatchPullToRefresh,
  shouldMountWatchVideoTapLayer,
  shouldTreatWatchPointerAsSwipe,
  shouldWatchScrubClaimGesture,
  shouldWatchTapLayerYieldVertical,
  type WatchGestureSurface,
} from "./watchGestures";

const CHROME: WatchGestureSurface[] = [
  "rail",
  "comments",
  "share",
  "save",
  "like-control",
  "sound",
  "profile",
  "caption",
  "timeline",
  "volume",
  "retry",
  "quick-actions",
  "header",
];

describe("resolveWatchTapAction", () => {
  it("schedules a single tap when there is no prior tap", () => {
    expect(
      resolveWatchTapAction({ nowMs: 1000, lastTapAt: null })
    ).toEqual({
      action: "schedule-single",
      nextLastTapAt: 1000,
      cancelPendingSingle: true,
    });
  });

  it("classifies a second tap inside the window as double and cancels single", () => {
    expect(
      resolveWatchTapAction({
        nowMs: 1000 + WATCH_DOUBLE_TAP_WINDOW_MS,
        lastTapAt: 1000,
      })
    ).toEqual({
      action: "double",
      nextLastTapAt: null,
      cancelPendingSingle: true,
    });
  });

  it("treats a late second tap as a new single", () => {
    expect(
      resolveWatchTapAction({
        nowMs: 1000 + WATCH_DOUBLE_TAP_WINDOW_MS + 1,
        lastTapAt: 1000,
      }).action
    ).toBe("schedule-single");
  });
});

describe("WatchTapClassifier — play/pause vs like", () => {
  it("single tap fires play/pause after the window and never likes", () => {
    vi.useFakeTimers();
    const onSingle = vi.fn();
    const onDouble = vi.fn();
    const classifier = createWatchTapClassifier({
      nowMs: () => Date.now(),
    });
    expect(classifier.tap({ onSingle, onDouble })).toBe("single-pending");
    expect(onSingle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(WATCH_DOUBLE_TAP_WINDOW_MS);
    expect(onSingle).toHaveBeenCalledTimes(1);
    expect(onDouble).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("double tap likes and does not fire the pending single-tap play/pause", () => {
    vi.useFakeTimers();
    let now = 5_000;
    const onSingle = vi.fn();
    const onDouble = vi.fn();
    const classifier = createWatchTapClassifier({
      nowMs: () => now,
    });
    expect(classifier.tap({ onSingle, onDouble })).toBe("single-pending");
    now += 80;
    expect(classifier.tap({ onSingle, onDouble })).toBe("double");
    vi.advanceTimersByTime(WATCH_DOUBLE_TAP_WINDOW_MS + 50);
    expect(onDouble).toHaveBeenCalledTimes(1);
    expect(onSingle).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("Watch gesture surfaces", () => {
  it("dispatches video-area taps only", () => {
    expect(shouldDispatchWatchVideoTap("video")).toBe(true);
    for (const surface of CHROME) {
      expect(shouldDispatchWatchVideoTap(surface)).toBe(false);
    }
  });

  it("does not mount the video tap layer over retry", () => {
    expect(shouldMountWatchVideoTapLayer({ paneStatus: "ready" })).toBe(true);
    expect(shouldMountWatchVideoTapLayer({ paneStatus: "loading" })).toBe(true);
    expect(shouldMountWatchVideoTapLayer({ paneStatus: "error" })).toBe(false);
    expect(
      isRetryHitTargetClear({
        errorVisible: true,
        tapLayerBlocksRetry: shouldMountWatchVideoTapLayer({
          paneStatus: "error",
        }),
      })
    ).toBe(true);
  });
});

describe("tap vs swipe", () => {
  it("does not treat a tap without meaningful movement as a swipe", () => {
    expect(shouldTreatWatchPointerAsSwipe({ movedPx: 0 })).toBe(false);
    expect(shouldTreatWatchPointerAsSwipe({ movedPx: 3 })).toBe(false);
    expect(shouldTreatWatchPointerAsSwipe({ movedPx: 8 })).toBe(true);
    expect(shouldTreatWatchPointerAsSwipe({ movedPx: -12 })).toBe(true);
  });

  it("yields the tap layer as soon as the move is vertical", () => {
    expect(shouldWatchTapLayerYieldVertical({ dx: 0, dy: 0 })).toBe(false);
    expect(shouldWatchTapLayerYieldVertical({ dx: 4, dy: 4 })).toBe(false);
    expect(shouldWatchTapLayerYieldVertical({ dx: 2, dy: 12 })).toBe(true);
    expect(shouldWatchTapLayerYieldVertical({ dx: 20, dy: 4 })).toBe(false);
  });

  it("does not fire tap after a yielded vertical drag", () => {
    expect(
      shouldDispatchWatchTapAfterTouch({ dx: 0, dy: 2, yieldedVertical: false })
    ).toBe(true);
    expect(
      shouldDispatchWatchTapAfterTouch({ dx: 0, dy: 16, yieldedVertical: true })
    ).toBe(false);
  });

  it("lets the scrub bar claim horizontal travel only", () => {
    expect(shouldWatchScrubClaimGesture({ dx: 12, dy: 2 })).toBe(true);
    expect(shouldWatchScrubClaimGesture({ dx: 2, dy: 16 })).toBe(false);
    expect(shouldWatchScrubClaimGesture({ dx: 3, dy: 1 })).toBe(false);
  });
});

describe("Watch pull-to-refresh vs paging", () => {
  it("keeps refresh only on the first item so downward paging wins after", () => {
    expect(shouldEnableWatchPullToRefresh(0)).toBe(true);
    expect(shouldEnableWatchPullToRefresh(1)).toBe(false);
    expect(shouldEnableWatchPullToRefresh(4)).toBe(false);
    expect(shouldEnableWatchPullToRefresh(-1)).toBe(false);
    expect(shouldEnableWatchPullToRefresh(Number.NaN)).toBe(false);
  });
});
