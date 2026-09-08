import { describe, expect, it } from "vitest";

import {
  resolveWatchEngineReadiness,
  resolveWatchEngineWantsPlay,
  shouldRecreateWatchEnginePlayer,
  shouldStartWatchEnginePlayback,
} from "./readiness";

import {
  FOLD6_WATCH_FOLDED_CELL_PX,
  WATCH_PORTRAIT_FRAME_ASPECT,
  WATCH_VIDEO_CONTENT_FIT,
  resolveWatchVideoCrop,
  watchVideoFrameFullyVisible,
} from "@/src/lib/watch/watchVideoFit";

/** Fold6 cover TextureView cell from 1003f14 / 36e3ff2 UI dumps. */
const FOLD6_COVER_TEXTURE_CELL_PX = { width: 968, height: 2121 } as const;

describe("watch engine content fit", () => {
  it("uses the product contain contract, not cover/ZOOM", () => {
    expect(WATCH_VIDEO_CONTENT_FIT).toBe("contain");
    expect(WATCH_VIDEO_CONTENT_FIT).not.toBe("cover");
  });

  it("does not crop 9:16 left/right on Fold6 cover", () => {
    for (const cell of [FOLD6_WATCH_FOLDED_CELL_PX, FOLD6_COVER_TEXTURE_CELL_PX]) {
      const crop = resolveWatchVideoCrop({
        cellWidth: cell.width,
        cellHeight: cell.height,
        frameAspect: WATCH_PORTRAIT_FRAME_ASPECT,
        contentFit: WATCH_VIDEO_CONTENT_FIT,
      });
      expect(crop.left).toBe(0);
      expect(crop.right).toBe(0);
      expect(watchVideoFrameFullyVisible(crop)).toBe(true);
    }
  });

  it("keeps TextureView readiness and play/pause gates", () => {
    expect(
      resolveWatchEngineReadiness({
        sourcePlayable: true,
        surfaceAttached: true,
        firstFrameReady: true,
      })
    ).toBe("ready-to-render");
    expect(
      shouldStartWatchEnginePlayback({
        wantsPlay: true,
        sourcePlayable: true,
        surfaceAttached: true,
      })
    ).toBe(true);
    expect(
      resolveWatchEngineWantsPlay({
        isCurrent: true,
        screenFocused: true,
        userPaused: true,
      })
    ).toBe(false);
    expect(
      shouldRecreateWatchEnginePlayer({
        previousMediaId: "post-1",
        nextMediaId: "post-1",
        previousSrc: "https://cdn.example/a.mp4",
        nextSrc: "https://cdn.example/a.mp4",
      })
    ).toBe(false);
  });
});
