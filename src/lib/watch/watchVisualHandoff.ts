/**
 * Rapid-swipe visual continuity. The 20% commit is unchanged.
 *
 * TARGET_VISIBLE => TARGET_DRAWABLE_FIRST_FRAME
 * Outgoing surface stays the owner-visible frame until that is true.
 * Handoff immediately once the target first frame is drawable.
 *
 * Does not write activeIndex, scroll, or Phase 2 cache.
 */

export function shouldAttachPreparedNeighborSurface(input: {
  platform?: string | null;
  preparePlayer: boolean;
  itemReady: boolean;
  isNeighbor: boolean;
}): boolean {
  if (input.platform !== "android") return false;
  if (input.isNeighbor !== true) return false;
  return input.preparePlayer === true && input.itemReady === true;
}

/** Owner-visible VideoView. Active current may paint while decoding. */
export function shouldExposeWatchTargetSurface(input: {
  isActive: boolean;
  attached: boolean;
  firstFrameDrawable: boolean;
}): boolean {
  if (input.attached !== true) return false;
  if (input.isActive) return true;
  return input.firstFrameDrawable === true;
}

export function shouldRetainOutgoingWatchVisual(input: {
  targetIndex: number | null | undefined;
  targetFirstFrameDrawable: boolean;
}): boolean {
  if (input.targetIndex == null || !Number.isFinite(input.targetIndex)) {
    return false;
  }
  return input.targetFirstFrameDrawable !== true;
}

export function shouldHandoffWatchVisualImmediately(input: {
  targetFirstFrameDrawable: boolean;
}): boolean {
  return input.targetFirstFrameDrawable === true;
}
