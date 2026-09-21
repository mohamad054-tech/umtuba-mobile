import { describe, expect, it } from "vitest";

import {
  shouldRestartWatchClipOnBecomeCurrent,
  watchTimelineRestarted,
} from "./replayOnBecomeCurrent";

describe("shouldRestartWatchClipOnBecomeCurrent", () => {
  it("restarts a clip marked ended even without a timeline", () => {
    expect(shouldRestartWatchClipOnBecomeCurrent({ ended: true })).toBe(true);
  });

  it("restarts when the retained player is at or near the end", () => {
    expect(
      shouldRestartWatchClipOnBecomeCurrent({
        currentTime: 12,
        duration: 12,
        ratio: 1,
      })
    ).toBe(true);
    expect(
      shouldRestartWatchClipOnBecomeCurrent({
        currentTime: 11.8,
        duration: 12,
        ratio: 11.8 / 12,
      })
    ).toBe(true);
  });

  it("does not restart a mid-clip swipe-back", () => {
    expect(
      shouldRestartWatchClipOnBecomeCurrent({
        ended: false,
        currentTime: 4,
        duration: 12,
        ratio: 4 / 12,
      })
    ).toBe(false);
  });

  it("resets the chrome bar to the start without losing duration", () => {
    expect(
      watchTimelineRestarted({ currentTime: 12, duration: 12, ratio: 1 })
    ).toEqual({ currentTime: 0, duration: 12, ratio: 0 });
  });
});
