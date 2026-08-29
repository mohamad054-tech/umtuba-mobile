import { describe, expect, it } from "vitest";

import {
  FOLD6_WATCH_FOLDED_CELL_PX,
  FOLD6_WATCH_UNFOLDED_CELL_PX,
  WATCH_PORTRAIT_FRAME_ASPECT,
  WATCH_VIDEO_CONTENT_FIT,
  resolveWatchVideoCrop,
  watchVideoFrameFullyVisible,
} from "./watchVideoFit";

describe("Watch video FIT / contain on Fold6", () => {
  it("locks Watch TextureView to contain (RESIZE_MODE_FIT), never cover/ZOOM", () => {
    expect(WATCH_VIDEO_CONTENT_FIT).toBe("contain");
    expect(WATCH_VIDEO_CONTENT_FIT).not.toBe("cover");
  });

  it("proves folded cover ZOOM crops left/right on a 9:16 frame", () => {
    const cover = resolveWatchVideoCrop({
      cellWidth: FOLD6_WATCH_FOLDED_CELL_PX.width,
      cellHeight: FOLD6_WATCH_FOLDED_CELL_PX.height,
      frameAspect: WATCH_PORTRAIT_FRAME_ASPECT,
      contentFit: "cover",
    });
    expect(cover.left).toBeGreaterThan(1);
    expect(cover.right).toBeGreaterThan(1);
    expect(cover.top).toBe(0);
    expect(cover.bottom).toBe(0);
    expect(watchVideoFrameFullyVisible(cover)).toBe(false);

    const fit = resolveWatchVideoCrop({
      cellWidth: FOLD6_WATCH_FOLDED_CELL_PX.width,
      cellHeight: FOLD6_WATCH_FOLDED_CELL_PX.height,
      frameAspect: WATCH_PORTRAIT_FRAME_ASPECT,
      contentFit: WATCH_VIDEO_CONTENT_FIT,
    });
    expect(watchVideoFrameFullyVisible(fit)).toBe(true);
  });

  it("proves unfolded inner ZOOM crops top/bottom on a 9:16 frame", () => {
    const cover = resolveWatchVideoCrop({
      cellWidth: FOLD6_WATCH_UNFOLDED_CELL_PX.width,
      cellHeight: FOLD6_WATCH_UNFOLDED_CELL_PX.height,
      frameAspect: WATCH_PORTRAIT_FRAME_ASPECT,
      contentFit: "cover",
    });
    expect(cover.top).toBeGreaterThan(1);
    expect(cover.bottom).toBeGreaterThan(1);
    expect(cover.left).toBe(0);
    expect(cover.right).toBe(0);
    expect(watchVideoFrameFullyVisible(cover)).toBe(false);

    const fit = resolveWatchVideoCrop({
      cellWidth: FOLD6_WATCH_UNFOLDED_CELL_PX.width,
      cellHeight: FOLD6_WATCH_UNFOLDED_CELL_PX.height,
      frameAspect: WATCH_PORTRAIT_FRAME_ASPECT,
      contentFit: WATCH_VIDEO_CONTENT_FIT,
    });
    expect(watchVideoFrameFullyVisible(fit)).toBe(true);
  });
});
