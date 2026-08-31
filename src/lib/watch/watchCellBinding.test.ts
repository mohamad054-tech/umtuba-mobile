import { describe, expect, it } from "vitest";

import {
  isOneCellLateBinding,
  isWatchCellBindingAligned,
  watchMediaIdentity,
  watchSequenceStaysAligned,
} from "./watchCellBinding";

describe("watchMediaIdentity", () => {
  it("uses post id, never the list index", () => {
    expect(watchMediaIdentity({ id: "clip-a", postId: 41 })).toBe("post-41");
    expect(watchMediaIdentity({ id: "legacy-clip" })).toBe("legacy-clip");
    expect(watchMediaIdentity({ id: "clip-a", postId: 41 })).not.toBe("0");
  });
});

describe("Watch 1 → 2 → 3 cell binding", () => {
  it("aligns visible item, player, and surface on consecutive posts", () => {
    const steps = [
      {
        index: 0,
        mediaId: "post-1",
        playerMediaId: "post-1",
        surfaceMediaId: "post-1",
      },
      {
        index: 1,
        mediaId: "post-2",
        playerMediaId: "post-2",
        surfaceMediaId: "post-2",
      },
      {
        index: 2,
        mediaId: "post-3",
        playerMediaId: "post-3",
        surfaceMediaId: "post-3",
      },
    ];
    expect(watchSequenceStaysAligned(steps)).toBe(true);
    expect(
      isWatchCellBindingAligned({
        visibleIndex: 1,
        visibleMediaId: "post-2",
        activeIndex: 1,
        activeMediaId: "post-2",
        playerMediaId: "post-2",
        cachedMediaId: "post-2",
        surfaceMediaId: "post-2",
      })
    ).toBe(true);
  });

  it("rejects one-cell-late picture while audio follows the visible item", () => {
    expect(
      watchSequenceStaysAligned([
        {
          index: 0,
          mediaId: "post-1",
          playerMediaId: "post-1",
          surfaceMediaId: "post-1",
        },
        {
          index: 1,
          mediaId: "post-2",
          playerMediaId: "post-2",
          surfaceMediaId: "post-1",
        },
        {
          index: 2,
          mediaId: "post-3",
          playerMediaId: "post-2",
          surfaceMediaId: "post-2",
        },
      ])
    ).toBe(false);
    expect(
      isOneCellLateBinding({ visibleIndex: 1, surfaceIndex: 0 })
    ).toBe(true);
    expect(
      isWatchCellBindingAligned({
        visibleIndex: 1,
        visibleMediaId: "post-2",
        activeIndex: 1,
        activeMediaId: "post-2",
        playerMediaId: "post-2",
        surfaceMediaId: "post-1",
      })
    ).toBe(false);
  });
});
