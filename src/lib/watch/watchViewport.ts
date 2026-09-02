/**
 * One frozen Watch list height per layout session.
 *
 * TextureView size (2121→1720, 968×968) must never write itemHeight,
 * snapToInterval, or getItemLayout. Fold/unfold is a new session.
 */

import {
  resolveWatchIndexFromScrollOffset,
  sanitizeWatchListIndex,
  toWatchListPixels,
} from "./playbackPolicy";

/** Width jump that means Fold/unfold or a real window change, not TextureView jitter. */
export const WATCH_LAYOUT_SESSION_WIDTH_DELTA_PX = 80;

export function shouldApplyTextureViewSizeToItemHeight(): false {
  return false;
}

/** Height-only TextureView/list jitter must not scrollToOffset or claimActiveIndex. */
export function shouldScrollOnItemHeightJitter(): false {
  return false;
}

export function isWatchViewportLayoutSessionChange(input: {
  frozenWidth: number;
  nextWidth: number;
}): boolean {
  const frozen = toWatchListPixels(input.frozenWidth);
  const next = toWatchListPixels(input.nextWidth);
  if (frozen == null || next == null) return false;
  return Math.abs(next - frozen) >= WATCH_LAYOUT_SESSION_WIDTH_DELTA_PX;
}

export function resolveFrozenWatchViewport(input: {
  frozenHeight: number | null;
  frozenWidth: number | null;
  measuredHeight: number;
  measuredWidth: number;
}): {
  height: number | null;
  width: number | null;
  isNewSession: boolean;
  heightChanged: boolean;
} {
  const measuredH = toWatchListPixels(input.measuredHeight);
  const measuredW = toWatchListPixels(input.measuredWidth);
  if (measuredH == null) {
    return {
      height: input.frozenHeight,
      width: input.frozenWidth,
      isNewSession: false,
      heightChanged: false,
    };
  }
  if (input.frozenHeight == null) {
    return {
      height: measuredH,
      width: measuredW,
      isNewSession: true,
      heightChanged: true,
    };
  }
  const sessionChange =
    measuredW != null &&
    input.frozenWidth != null &&
    isWatchViewportLayoutSessionChange({
      frozenWidth: input.frozenWidth,
      nextWidth: measuredW,
    });
  if (!sessionChange) {
    return {
      height: input.frozenHeight,
      width: input.frozenWidth,
      isNewSession: false,
      heightChanged: false,
    };
  }
  return {
    height: measuredH,
    width: measuredW,
    isNewSession: true,
    heightChanged: measuredH !== input.frozenHeight,
  };
}

export function resolveWatchPagingMetrics(itemHeight: number): {
  itemHeight: number;
  snapToInterval: number;
  getItemLayout: (index: number) => {
    length: number;
    offset: number;
    index: number;
  };
} | null {
  const height = toWatchListPixels(itemHeight);
  if (height == null) return null;
  return {
    itemHeight: height,
    snapToInterval: height,
    getItemLayout: (index: number) => ({
      length: height,
      offset: height * index,
      index,
    }),
  };
}

/**
 * Native settle is authoritative. JS must not stay on page 2 while the
 * list is visually on page 0.
 */
export function reconcileWatchActiveIndex(input: {
  nativePage: number | null;
  activeIndex: number;
  itemCount: number;
}): number | null {
  if (!Number.isFinite(input.itemCount) || input.itemCount <= 0) {
    return null;
  }
  const native = sanitizeWatchListIndex(input.nativePage ?? Number.NaN);
  if (native == null) return null;
  const page = Math.min(native, input.itemCount - 1);
  return page;
}

export function findWatchIndexByPostIdentity(
  videos: ReadonlyArray<{ id: string; postId?: number | null }>,
  postIdentity: string | number | null
): number | null {
  if (postIdentity == null) return null;
  const key = String(postIdentity);
  const index = videos.findIndex((video) => {
    if (video.postId != null && String(video.postId) === key) return true;
    if (video.id === key) return true;
    if (video.postId != null && `post-${video.postId}` === key) return true;
    return false;
  });
  return index >= 0 ? index : null;
}

export function preserveWatchPostAcrossLayoutSession(input: {
  activePostId: number | string | null;
  videos: ReadonlyArray<{ id: string; postId?: number | null }>;
  fallbackIndex: number;
}): number {
  const found = findWatchIndexByPostIdentity(input.videos, input.activePostId);
  if (found != null) return found;
  return sanitizeWatchListIndex(input.fallbackIndex) ?? 0;
}

export function resolveWatchNativePage(
  offset: number,
  itemHeight: number,
  itemCount: number
): number | null {
  return resolveWatchIndexFromScrollOffset(offset, itemHeight, itemCount);
}
