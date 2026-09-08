import { describe, expect, it } from "vitest";

import {
  resolveWatchTapPauseCommand,
  shouldLifecycleResumeAfterUserPause,
} from "@/src/lib/watch/playbackPolicy";
import { shouldTreatWatchPointerAsSwipe } from "@/src/lib/watch/watchGestures";

import {
  resolveWatchEngineWantsPlay,
  shouldRecreateWatchEnginePlayer,
  shouldStartWatchEnginePlayback,
} from "./readiness";

function enginePlayAfterTap(input: {
  userPaused: boolean;
  firstFrameReady: boolean;
}) {
  const wantsPlay = resolveWatchEngineWantsPlay({
    isCurrent: true,
    screenFocused: true,
    userPaused: input.userPaused,
  });
  return {
    wantsPlay,
    canPlay: shouldStartWatchEnginePlayback({
      wantsPlay,
      sourcePlayable: true,
      surfaceAttached: true,
    }),
    lifecycleResume: shouldLifecycleResumeAfterUserPause({
      userPaused: input.userPaused,
      lifecycleWantsPlay: input.firstFrameReady,
    }),
  };
}

describe("watch engine tap pause", () => {
  it("routes a single tap to the active player and pauses", () => {
    const tap = resolveWatchTapPauseCommand({
      isActive: true,
      feedShouldPlay: true,
      paneStatus: "loading",
      userPaused: false,
    });
    expect(tap.invokeHandler).toBe(true);
    expect(tap.pauseCommand).toBe(true);
    expect(tap.nextUserPaused).toBe(true);
    expect(enginePlayAfterTap({ userPaused: tap.nextUserPaused, firstFrameReady: true }))
      .toEqual({
        wantsPlay: false,
        canPlay: false,
        lifecycleResume: false,
      });
  });

  it("resumes from the same player after a second tap", () => {
    const resume = resolveWatchTapPauseCommand({
      isActive: true,
      feedShouldPlay: true,
      paneStatus: "loading",
      userPaused: true,
    });
    expect(resume.invokeHandler).toBe(true);
    expect(resume.pauseCommand).toBe(false);
    expect(resume.nextUserPaused).toBe(false);
    expect(enginePlayAfterTap({ userPaused: false, firstFrameReady: true }).canPlay).toBe(
      true
    );
    expect(
      shouldRecreateWatchEnginePlayer({
        previousMediaId: "post-1",
        nextMediaId: "post-1",
        previousSrc: "https://cdn.example/a.mp4",
        nextSrc: "https://cdn.example/a.mp4",
      })
    ).toBe(false);
  });

  it("does not let first-frame readiness overwrite a latched pause", () => {
    const paused = enginePlayAfterTap({
      userPaused: true,
      firstFrameReady: true,
    });
    expect(paused.wantsPlay).toBe(false);
    expect(paused.canPlay).toBe(false);
    expect(paused.lifecycleResume).toBe(false);
  });

  it("does not treat a stationary tap as a swipe", () => {
    expect(shouldTreatWatchPointerAsSwipe({ movedPx: 0 })).toBe(false);
    expect(shouldTreatWatchPointerAsSwipe({ movedPx: 3 })).toBe(false);
  });
});
