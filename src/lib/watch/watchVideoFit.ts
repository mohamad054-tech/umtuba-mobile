/**
 * Watch TextureView resize. expo-video maps:
 * contain → AspectRatioFrameLayout.RESIZE_MODE_FIT
 * cover   → AspectRatioFrameLayout.RESIZE_MODE_ZOOM (center-crop)
 *
 * Fold6 cover is narrower than 9:16, so ZOOM crops left/right.
 * Fold6 inner is wider than 9:16, so ZOOM crops top/bottom.
 * FIT/contain keeps the full frame and letterboxes/pillarboxes.
 */
export const WATCH_VIDEO_CONTENT_FIT = "contain" as const;

export type WatchVideoContentFit = "contain" | "cover" | "fill";

/** Typical published Watch portrait. */
export const WATCH_PORTRAIT_FRAME_ASPECT = 9 / 16;

/** Fold6 cover / inner WindowMetrics from SM-F956B ADB dumpsys (2026-08-29). */
export const FOLD6_WATCH_FOLDED_CELL_PX = { width: 968, height: 2376 } as const;
export const FOLD6_WATCH_UNFOLDED_CELL_PX = { width: 1856, height: 2160 } as const;

export type WatchVideoCrop = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const ZERO_CROP: WatchVideoCrop = { left: 0, right: 0, top: 0, bottom: 0 };

/**
 * Center-crop overflow for cover/ZOOM. contain/FIT and fill have no crop.
 */
export function resolveWatchVideoCrop(input: {
  cellWidth: number;
  cellHeight: number;
  frameAspect: number;
  contentFit: WatchVideoContentFit;
}): WatchVideoCrop {
  const { cellWidth, cellHeight, frameAspect, contentFit } = input;
  if (
    !Number.isFinite(cellWidth) ||
    !Number.isFinite(cellHeight) ||
    cellWidth <= 0 ||
    cellHeight <= 0 ||
    !Number.isFinite(frameAspect) ||
    frameAspect <= 0
  ) {
    return ZERO_CROP;
  }
  if (contentFit !== "cover") {
    return ZERO_CROP;
  }
  const cellAspect = cellWidth / cellHeight;
  if (frameAspect > cellAspect) {
    const overflow = cellHeight * frameAspect - cellWidth;
    const side = overflow / 2;
    return { left: side, right: side, top: 0, bottom: 0 };
  }
  if (frameAspect < cellAspect) {
    const overflow = cellWidth / frameAspect - cellHeight;
    const end = overflow / 2;
    return { left: 0, right: 0, top: end, bottom: end };
  }
  return ZERO_CROP;
}

export function watchVideoFrameFullyVisible(crop: WatchVideoCrop): boolean {
  return (
    crop.left <= 1e-6 &&
    crop.right <= 1e-6 &&
    crop.top <= 1e-6 &&
    crop.bottom <= 1e-6
  );
}
