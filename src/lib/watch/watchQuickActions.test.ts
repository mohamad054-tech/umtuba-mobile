import { describe, expect, it, vi } from "vitest";

import { WATCH_DOUBLE_TAP_WINDOW_MS, WATCH_LONG_PRESS_MS, createWatchTapClassifier, shouldOpenWatchQuickActions, shouldCancelWatchTapsOnLongPress } from "./watchGestures";
import {
  DEFAULT_WATCH_PLAYBACK_SPEED,
  WATCH_CAPTIONS_MODE,
  WATCH_PLAYBACK_SPEEDS,
  hasWatchCaptionTrack,
  isWatchQuickActionChrome,
  resetWatchPlaybackSpeedOnPageChange,
  resolveWatchPlaybackSpeed,
  resolveWatchQuickActions,
  shouldApplyWatchPlaybackSpeed,
} from "./watchQuickActions";
import {
  WATCH_SCRUB_MIN_DURATION_SEC,
  canSeekWithDuration,
  shouldExposeWatchScrub,
} from "./playbackPolicy";

describe("Watch long-press vs tap classifier", () => {
  it("opens quick actions only on the video surface", () => {
    expect(shouldOpenWatchQuickActions("video")).toBe(true);
    expect(shouldOpenWatchQuickActions("rail")).toBe(false);
    expect(shouldOpenWatchQuickActions("timeline")).toBe(false);
    expect(shouldOpenWatchQuickActions("volume")).toBe(false);
    expect(shouldOpenWatchQuickActions("quick-actions")).toBe(false);
    expect(isWatchQuickActionChrome("rail")).toBe(true);
  });

  it("cancels pending single/double taps when long-press fires", () => {
    expect(shouldCancelWatchTapsOnLongPress()).toBe(true);
    expect(WATCH_LONG_PRESS_MS).toBeGreaterThan(WATCH_DOUBLE_TAP_WINDOW_MS);
    vi.useFakeTimers();
    const onSingle = vi.fn();
    const onDouble = vi.fn();
    const classifier = createWatchTapClassifier({ nowMs: () => Date.now() });
    classifier.tap({ onSingle, onDouble });
    classifier.cancel();
    vi.advanceTimersByTime(WATCH_DOUBLE_TAP_WINDOW_MS + 50);
    expect(onSingle).not.toHaveBeenCalled();
    expect(onDouble).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("Watch playback speed", () => {
  it("defaults to 1.0x and only applies on the active player", () => {
    expect(WATCH_PLAYBACK_SPEEDS).toEqual([0.5, 1, 1.5, 2]);
    expect(resolveWatchPlaybackSpeed(undefined)).toBe(DEFAULT_WATCH_PLAYBACK_SPEED);
    expect(resolveWatchPlaybackSpeed(1.5)).toBe(1.5);
    expect(shouldApplyWatchPlaybackSpeed(true)).toBe(true);
    expect(shouldApplyWatchPlaybackSpeed(false)).toBe(false);
    expect(resetWatchPlaybackSpeedOnPageChange()).toBe(1);
  });
});

describe("Watch scrub eligibility", () => {
  it("keeps seek math and hides the affordance under 8s", () => {
    expect(WATCH_SCRUB_MIN_DURATION_SEC).toBe(8);
    expect(canSeekWithDuration(3)).toBe(true);
    expect(shouldExposeWatchScrub(3)).toBe(false);
    expect(shouldExposeWatchScrub(7.99)).toBe(false);
    expect(shouldExposeWatchScrub(8)).toBe(true);
    expect(shouldExposeWatchScrub(0)).toBe(false);
  });
});

describe("Watch quick-action catalog", () => {
  it("includes core actions and optional follow/report/share", () => {
    expect(resolveWatchQuickActions({})).toEqual([
      "save",
      "not-interested",
      "speed",
      "captions",
      "share",
    ]);
    expect(
      resolveWatchQuickActions({ canFollow: true, canReport: true })
    ).toContain("follow");
    expect(hasWatchCaptionTrack()).toBe(false);
    expect(WATCH_CAPTIONS_MODE).toBe("post-caption-overlay");
  });
});
