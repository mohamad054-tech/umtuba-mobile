/** Canonical Watch media identity. Index is never an identity. */
export function watchEngineMediaId(video: {
  id: string;
  postId?: number | null;
}): string {
  if (video.postId != null) {
    return `post-${video.postId}`;
  }
  return video.id;
}

export function clampWatchEngineIndex(
  index: number,
  itemCount: number
): number | null {
  if (!Number.isFinite(index) || !Number.isFinite(itemCount) || itemCount <= 0) {
    return null;
  }
  const next = Math.trunc(index);
  if (next < 0 || next >= itemCount) return null;
  return next;
}

export function watchEngineIndexFromOffset(
  offset: number,
  itemHeight: number,
  itemCount: number
): number | null {
  if (!Number.isFinite(offset) || offset < 0) return null;
  if (!Number.isFinite(itemHeight) || itemHeight <= 0) return null;
  return clampWatchEngineIndex(Math.round(offset / itemHeight), itemCount);
}
