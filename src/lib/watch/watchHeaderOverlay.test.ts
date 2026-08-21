import { describe, expect, it } from "vitest";

import {
  shouldPromoteWatchHeaderStackingContext,
  watchHeaderOverlayLayerStyle,
} from "./watchHeaderOverlay";

describe("Watch header overlay vs iOS AVPlayerLayer", () => {
  it("does not promote a stacking context over the iOS feed", () => {
    expect(shouldPromoteWatchHeaderStackingContext("ios")).toBe(false);
    expect(watchHeaderOverlayLayerStyle("ios")).toEqual({});
    expect(watchHeaderOverlayLayerStyle("ios")).not.toHaveProperty("zIndex");
    expect(watchHeaderOverlayLayerStyle("ios")).not.toHaveProperty("elevation");
  });

  it("keeps Android header elevation so the arrow stays above the list", () => {
    expect(shouldPromoteWatchHeaderStackingContext("android")).toBe(true);
    expect(watchHeaderOverlayLayerStyle("android")).toEqual({
      zIndex: 20,
      elevation: 20,
    });
  });
});
