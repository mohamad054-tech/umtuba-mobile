import { VIDEO_SIGNED_URL_TTL_SECONDS } from "@/src/contracts/video";

export const SIGNED_URL_CACHE_MAX_ENTRIES = 48;
export const SIGNED_URL_REFRESH_SKEW_SECONDS = 90;

export type SignedUrlCacheEntry = {
  url: string;
  expiresAtMs: number;
};

export type SignedUrlCache = {
  peek: (path: string, nowMs?: number) => string | null;
  set: (path: string, url: string, nowMs?: number) => void;
  invalidate: (path: string) => void;
  clear: () => void;
  size: () => number;
};

function ttlMs(): number {
  return VIDEO_SIGNED_URL_TTL_SECONDS * 1000;
}

function refreshSkewMs(): number {
  return SIGNED_URL_REFRESH_SKEW_SECONDS * 1000;
}

export function isSignedUrlFresh(
  entry: SignedUrlCacheEntry | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!entry?.url) return false;
  return entry.expiresAtMs - nowMs > refreshSkewMs();
}

export function createSignedUrlCache(
  maxEntries: number = SIGNED_URL_CACHE_MAX_ENTRIES
): SignedUrlCache {
  const entries = new Map<string, SignedUrlCacheEntry>();

  return {
    peek(path, nowMs = Date.now()) {
      const key = path.trim();
      if (!key) return null;
      const entry = entries.get(key);
      if (!isSignedUrlFresh(entry, nowMs)) {
        if (entry) entries.delete(key);
        return null;
      }
      entries.delete(key);
      entries.set(key, entry as SignedUrlCacheEntry);
      return (entry as SignedUrlCacheEntry).url;
    },
    set(path, url, nowMs = Date.now()) {
      const key = path.trim();
      const trimmedUrl = url.trim();
      if (!key || !trimmedUrl) return;
      if (entries.has(key)) entries.delete(key);
      entries.set(key, {
        url: trimmedUrl,
        expiresAtMs: nowMs + ttlMs(),
      });
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest == null) break;
        entries.delete(oldest);
      }
    },
    invalidate(path) {
      entries.delete(path.trim());
    },
    clear() {
      entries.clear();
    },
    size() {
      return entries.size;
    },
  };
}

const defaultCache = createSignedUrlCache();

export const watchSignedUrlCache = defaultCache;
