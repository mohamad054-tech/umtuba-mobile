import { describe, expect, it } from "vitest";

import { scrubFillWidthPercent } from "@/src/lib/watch/playbackPolicy";
import { WATCH_ENGINE_COMMIT_FRACTION } from "./gesture";
import {
  resolveWatchEnginePlayAfterSeek,
  resolveWatchEngineSeekSeconds,
  shouldRecreateWatchEnginePlayerOnSeek,
  watchEngineSeekKeepsIdentity,
} from "./seek";
import { shouldRebuildWatchEngineRenderItemOnTimelineTick } from "./timelineStore";

describe("watch engine seek", () => {
  it("maps a ratio onto the engine duration", () => {
    expect(resolveWatchEngineSeekSeconds({ ratio: 0.25, duration: 80 })).toBe(20);
    expect(resolveWatchEngineSeekSeconds({ ratio: 0.5, duration: 0 })).toBeNull();
  });

  it("keeps playing after seek when the user did not pause", () => {
    expect(
      resolveWatchEnginePlayAfterSeek({
        isCurrent: true,
        screenFocused: true,
        userPaused: false,
        sourcePlayable: true,
        surfaceAttached: true,
      })
    ).toBe(true);
  });

  it("stays paused after seek when the user pause latch is set", () => {
    expect(
      resolveWatchEnginePlayAfterSeek({
        isCurrent: true,
        screenFocused: true,
        userPaused: true,
        sourcePlayable: true,
        surfaceAttached: true,
      })
    ).toBe(false);
  });

  it("does not recreate the player for seek on the same identity", () => {
    expect(shouldRecreateWatchEnginePlayerOnSeek()).toBe(false);
    expect(
      watchEngineSeekKeepsIdentity({
        mediaId: "post-1",
        src: "https://cdn.example/a.mp4",
      })
    ).toBe(true);
  });

  it("fills the visible progress track from the engine ratio", () => {
    expect(scrubFillWidthPercent(0)).toBe("0%");
    expect(scrubFillWidthPercent(0.4)).toBe("40%");
    expect(scrubFillWidthPercent(1)).toBe("100%");
  });

  it("does not rebuild renderItem on a timeline tick", () => {
    expect(shouldRebuildWatchEngineRenderItemOnTimelineTick()).toBe(false);
  });

  it("keeps the locked 20 percent page-change threshold", () => {
    expect(WATCH_ENGINE_COMMIT_FRACTION).toBe(0.2);
  });
});
