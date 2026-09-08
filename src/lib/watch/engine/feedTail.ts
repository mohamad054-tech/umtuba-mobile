export const WATCH_ENGINE_FEED_TAIL_REMAINING = 5;

export function shouldRequestWatchEngineFeedTail(input: {
  settledIndex: number;
  itemCount: number;
  hasMore: boolean;
  loadingMore?: boolean;
}): boolean {
  if (!input.hasMore || input.loadingMore) return false;
  if (!Number.isFinite(input.settledIndex) || !Number.isFinite(input.itemCount)) {
    return false;
  }
  if (input.itemCount <= 0) return false;
  const remaining = input.itemCount - 1 - input.settledIndex;
  return remaining <= WATCH_ENGINE_FEED_TAIL_REMAINING;
}
