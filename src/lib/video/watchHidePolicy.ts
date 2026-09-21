/**
 * Hide-watched-videos policy (14-day window, 5s consecutive play).
 * Separate from posts.views / record_post_view / watch_signals.
 * Ported from umtuba-web origin/release/v1 @ 396107ec.
 */

export const WATCH_HIDE_WINDOW_DAYS = 14;
export const WATCH_HIDE_WINDOW_MS = WATCH_HIDE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
export const QUALIFIED_WATCH_MS = 5_000;
export const MIN_UNWATCHED_FEED = 10;
export const WATCH_HIDE_SEEK_RESET_MS = 750;
export const WATCH_HIDE_STORAGE_KEY = "umtuba.watchHide.v1";
export const WATCH_HIDE_GUEST_MAX = 400;

export type WatchHideEntry = {
  postId: number;
  watchedAt: number;
};

export function isRecentWatchHide(
  watchedAt: number,
  now = Date.now(),
  windowMs = WATCH_HIDE_WINDOW_MS
): boolean {
  return (
    Number.isFinite(watchedAt) &&
    now - watchedAt >= 0 &&
    now - watchedAt < windowMs
  );
}

export function sanitizeWatchHideEntries(
  raw: unknown,
  now = Date.now()
): WatchHideEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const byId = new Map<number, number>();
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const postId = Number((item as { postId?: unknown }).postId);
    const watchedAt = Number((item as { watchedAt?: unknown }).watchedAt);
    if (!Number.isInteger(postId) || postId <= 0 || !Number.isFinite(watchedAt)) {
      continue;
    }
    if (!isRecentWatchHide(watchedAt, now)) {
      continue;
    }
    const previous = byId.get(postId);
    if (previous == null || watchedAt > previous) {
      byId.set(postId, watchedAt);
    }
  }

  return Array.from(byId.entries())
    .map(([postId, watchedAt]) => ({ postId, watchedAt }))
    .sort((a, b) => a.watchedAt - b.watchedAt)
    .slice(-WATCH_HIDE_GUEST_MAX);
}

export function recentHiddenPostIds(
  entries: WatchHideEntry[],
  now = Date.now()
): Set<number> {
  return new Set(
    entries
      .filter((entry) => isRecentWatchHide(entry.watchedAt, now))
      .map((entry) => entry.postId)
  );
}

export function composeFeedWithWatchHide<T>(
  items: T[],
  readId: (item: T) => number,
  hidden: WatchHideEntry[],
  options?: {
    keepPostId?: number | null;
    minUnwatched?: number;
    now?: number;
  }
): T[] {
  const now = options?.now ?? Date.now();
  const minUnwatched = options?.minUnwatched ?? MIN_UNWATCHED_FEED;
  const keepPostId = options?.keepPostId ?? null;
  const hiddenIds = recentHiddenPostIds(hidden, now);
  const byId = new Map<number, T>();
  for (const item of items) {
    byId.set(readId(item), item);
  }

  const fresh: T[] = [];
  for (const item of items) {
    const id = readId(item);
    if (id === keepPostId || !hiddenIds.has(id)) {
      fresh.push(item);
    }
  }

  if (fresh.length >= minUnwatched) {
    return fresh;
  }

  const oldestHidden = [...hidden]
    .filter((entry) => hiddenIds.has(entry.postId) && entry.postId !== keepPostId)
    .sort((a, b) => a.watchedAt - b.watchedAt);

  const used = new Set(fresh.map(readId));
  const filled = [...fresh];
  for (const entry of oldestHidden) {
    if (filled.length >= minUnwatched) {
      break;
    }
    const item = byId.get(entry.postId);
    if (!item || used.has(entry.postId)) {
      continue;
    }
    filled.push(item);
    used.add(entry.postId);
  }

  return filled;
}

export function createConsecutiveWatchTracker(input: {
  onQualified: () => void;
  thresholdMs?: number;
}) {
  const thresholdMs = input.thresholdMs ?? QUALIFIED_WATCH_MS;
  let consecutiveMs = 0;
  let lastMediaTimeMs: number | null = null;
  let lastWallMs: number | null = null;
  let qualified = false;

  return {
    reset() {
      consecutiveMs = 0;
      lastMediaTimeMs = null;
      lastWallMs = null;
    },
    ingest(currentTimeMs: number, active: boolean, now = Date.now()) {
      if (qualified) {
        return false;
      }
      if (!active || !Number.isFinite(currentTimeMs)) {
        consecutiveMs = 0;
        lastMediaTimeMs = null;
        lastWallMs = null;
        return false;
      }
      if (lastMediaTimeMs == null || lastWallMs == null) {
        lastMediaTimeMs = currentTimeMs;
        lastWallMs = now;
        return false;
      }

      const mediaDelta = currentTimeMs - lastMediaTimeMs;
      const wallDelta = now - lastWallMs;
      lastMediaTimeMs = currentTimeMs;
      lastWallMs = now;

      if (mediaDelta < 0 || mediaDelta > wallDelta + WATCH_HIDE_SEEK_RESET_MS) {
        consecutiveMs = 0;
        return false;
      }
      if (mediaDelta < 80) {
        return false;
      }

      consecutiveMs += Math.min(mediaDelta, wallDelta + 80);
      if (consecutiveMs >= thresholdMs) {
        qualified = true;
        input.onQualified();
        return true;
      }
      return false;
    },
    get consecutiveMs() {
      return consecutiveMs;
    },
    get isQualified() {
      return qualified;
    },
  };
}
