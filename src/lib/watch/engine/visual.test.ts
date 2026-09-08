import { describe, expect, it } from "vitest";

import {
  resolveWatchEngineVisualLayer,
  watchEngineAllowsEmptyTexture,
  watchEngineTargetIsDrawable,
} from "./visual";

describe("watch engine visual continuity", () => {
  it("keeps the outgoing frame until the target is drawable", () => {
    const layer = resolveWatchEngineVisualLayer({
      targetIndex: 2,
      settledIndex: 1,
      incomingFirstFrame: false,
      incomingSurfaceReady: false,
    });
    expect(layer).toBe("outgoing");
    expect(watchEngineAllowsEmptyTexture(layer)).toBe(false);
  });

  it("shows incoming only when the target first frame is ready", () => {
    expect(
      watchEngineTargetIsDrawable({
        targetMediaId: "post-2",
        firstFrameMediaId: "post-2",
      })
    ).toBe(true);
    expect(
      resolveWatchEngineVisualLayer({
        targetIndex: 2,
        settledIndex: 1,
        incomingFirstFrame: true,
        incomingSurfaceReady: true,
      })
    ).toBe("incoming");
  });
});
