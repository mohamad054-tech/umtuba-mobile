import type { WatchVideo } from "@/src/contracts/watch";
import {
  isLegacyHttpPlaybackUrl,
  isLocalWatchPlaybackUri,
} from "@/src/lib/feed/videoStoragePath";

import type { WatchMediaCachePort } from "./androidWatchMediaCache";
import { watchMediaIdentity } from "./watchCellBinding";

/** Account-scoped Watch offline snapshots. Complements rolling file cache. */
export const WATCH_OFFLINE_MANIFEST_TARGET = 5;
export const WATCH_OFFLINE_MANIFEST_VERSION = 1;
export const WATCH_OFFLINE_MANIFEST_PREFIX = "umtuba-watch-offline-manifest-";
export const WATCH_FEED_BOOTSTRAP_TIMEOUT_MS = 8000;

export type WatchOfflineManifestEntry = {
  postId: number;
  videoId: string;
  mediaId: string;
  title: string;
  caption: string;
  location: { city: string; country: string };
  music: string;
  aiSummary: string;
  translation: string;
  author: WatchVideo["author"];
  stats: WatchVideo["stats"];
  likedByMe: boolean;
  savedByMe: boolean;
  source: "supabase";
  videoPath?: string | null;
  poster?: string;
  publishedAt?: string | null;
  durationMs?: number | null;
  remoteUri: string;
  localUri: string;
  cachedAt: number;
  lastWatchedAt: number;
};

export type WatchOfflineManifest = {
  version: number;
  accountId: string;
  target: number;
  entries: WatchOfflineManifestEntry[];
};

export function emptyWatchOfflineManifest(
  accountId: string,
  target = WATCH_OFFLINE_MANIFEST_TARGET
): WatchOfflineManifest {
  return {
    version: WATCH_OFFLINE_MANIFEST_VERSION,
    accountId,
    target,
    entries: [],
  };
}

export function sanitizeWatchOfflineAccountId(
  accountId: string | null | undefined
): string | null {
  const safe = (accountId ?? "").trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safe) return null;
  return safe.slice(0, 80);
}

export function watchOfflineManifestFileName(
  accountId: string | null | undefined
): string | null {
  const safe = sanitizeWatchOfflineAccountId(accountId);
  if (!safe) return null;
  return `${WATCH_OFFLINE_MANIFEST_PREFIX}${safe}.json`;
}

export function watchOfflineManifestUri(
  dir: string | null | undefined,
  accountId: string | null | undefined
): string | null {
  if (!dir) return null;
  const name = watchOfflineManifestFileName(accountId);
  if (!name) return null;
  return `${dir}${name}`;
}

export function canRetainWatchVideo(
  video: WatchVideo | null | undefined
): video is WatchVideo & { postId: number } {
  if (!video) return false;
  if (video.source !== "supabase") return false;
  if (video.postId == null || !Number.isInteger(video.postId) || video.postId <= 0) {
    return false;
  }
  return Boolean(video.id);
}

export function isValidWatchOfflineManifestEntry(
  entry: WatchOfflineManifestEntry | null | undefined
): entry is WatchOfflineManifestEntry {
  if (!entry) return false;
  if (!Number.isInteger(entry.postId) || entry.postId <= 0) return false;
  if (!entry.videoId || !entry.mediaId) return false;
  if (!isLocalWatchPlaybackUri(entry.localUri)) return false;
  const hasRemote =
    isLegacyHttpPlaybackUrl(entry.remoteUri) ||
    Boolean((entry.videoPath ?? "").trim());
  if (!hasRemote) return false;
  if (!Number.isFinite(entry.cachedAt) || !Number.isFinite(entry.lastWatchedAt)) {
    return false;
  }
  if (!entry.author || typeof entry.author.name !== "string") return false;
  if (!entry.stats || typeof entry.stats.likes !== "number") return false;
  if (typeof entry.caption !== "string") return false;
  return true;
}

export function parseWatchOfflineManifest(
  raw: string | null | undefined,
  expectedAccountId?: string | null
): WatchOfflineManifest {
  const fallback = emptyWatchOfflineManifest(expectedAccountId ?? "");
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as WatchOfflineManifest;
    if (!parsed || !Array.isArray(parsed.entries)) return fallback;
    const accountId = (parsed.accountId ?? "").trim();
    if (!accountId) return fallback;
    if (
      expectedAccountId &&
      sanitizeWatchOfflineAccountId(accountId) !==
        sanitizeWatchOfflineAccountId(expectedAccountId)
    ) {
      return emptyWatchOfflineManifest(expectedAccountId);
    }
    return {
      version: WATCH_OFFLINE_MANIFEST_VERSION,
      accountId,
      target: WATCH_OFFLINE_MANIFEST_TARGET,
      entries: parsed.entries.filter(isValidWatchOfflineManifestEntry),
    };
  } catch {
    return fallback;
  }
}

export function snapshotWatchVideoForOffline(input: {
  video: WatchVideo;
  localUri: string;
  remoteUri?: string | null;
  cachedAt?: number;
  lastWatchedAt?: number;
  existing?: WatchOfflineManifestEntry | null;
}): WatchOfflineManifestEntry | null {
  const { video } = input;
  if (!canRetainWatchVideo(video)) return null;
  if (!isLocalWatchPlaybackUri(input.localUri)) return null;
  const remoteUri = (
    input.remoteUri ||
    input.existing?.remoteUri ||
    (isLegacyHttpPlaybackUrl(video.src) ? video.src : "")
  ).trim();
  const videoPath = (video.videoPath ?? input.existing?.videoPath ?? "").trim();
  if (!isLegacyHttpPlaybackUrl(remoteUri) && !videoPath) return null;
  const now = Date.now();
  return {
    postId: video.postId,
    videoId: video.id,
    mediaId: watchMediaIdentity(video),
    title: video.title,
    caption: video.caption,
    location: {
      city: video.location?.city ?? "",
      country: video.location?.country ?? "",
    },
    music: video.music ?? "",
    aiSummary: video.aiSummary ?? "",
    translation: video.translation ?? "",
    author: { ...video.author },
    stats: { ...video.stats },
    likedByMe: video.likedByMe === true,
    savedByMe: video.savedByMe === true,
    source: "supabase",
    videoPath: videoPath || video.videoPath || null,
    poster: video.poster ?? input.existing?.poster,
    publishedAt: video.publishedAt ?? input.existing?.publishedAt ?? null,
    durationMs: video.durationMs ?? input.existing?.durationMs ?? null,
    remoteUri,
    localUri: input.localUri,
    cachedAt: input.existing?.cachedAt ?? input.cachedAt ?? now,
    lastWatchedAt: input.lastWatchedAt ?? input.existing?.lastWatchedAt ?? now,
  };
}

export function watchVideoFromOfflineEntry(
  entry: WatchOfflineManifestEntry
): WatchVideo {
  return {
    id: entry.videoId,
    postId: entry.postId,
    videoPath: entry.videoPath ?? null,
    src: entry.localUri,
    poster: entry.poster,
    title: entry.title,
    caption: entry.caption,
    location: { ...entry.location },
    music: entry.music,
    aiSummary: entry.aiSummary,
    translation: entry.translation,
    author: { ...entry.author },
    stats: { ...entry.stats },
    likedByMe: entry.likedByMe,
    savedByMe: entry.savedByMe,
    source: "supabase",
    publishedAt: entry.publishedAt ?? null,
    durationMs: entry.durationMs ?? null,
  };
}

export function watchVideosFromOfflineManifest(
  manifest: WatchOfflineManifest
): WatchVideo[] {
  return [...manifest.entries]
    .filter(isValidWatchOfflineManifestEntry)
    .sort(compareOfflineEntriesRecentFirst)
    .map(watchVideoFromOfflineEntry);
}

function compareOfflineEntriesRecentFirst(
  a: WatchOfflineManifestEntry,
  b: WatchOfflineManifestEntry
): number {
  if (b.lastWatchedAt !== a.lastWatchedAt) {
    return b.lastWatchedAt - a.lastWatchedAt;
  }
  if (b.cachedAt !== a.cachedAt) {
    return b.cachedAt - a.cachedAt;
  }
  return b.postId - a.postId;
}

export function upsertWatchOfflineManifestEntry(
  manifest: WatchOfflineManifest,
  entry: WatchOfflineManifestEntry,
  target = WATCH_OFFLINE_MANIFEST_TARGET
): {
  manifest: WatchOfflineManifest;
  evicted: WatchOfflineManifestEntry[];
} {
  if (!isValidWatchOfflineManifestEntry(entry)) {
    return { manifest, evicted: [] };
  }
  const next = manifest.entries.filter(
    (row) => row.mediaId !== entry.mediaId && row.postId !== entry.postId
  );
  next.push(entry);
  next.sort(compareOfflineEntriesRecentFirst);
  const kept = next.slice(0, target);
  return {
    manifest: {
      version: WATCH_OFFLINE_MANIFEST_VERSION,
      accountId: manifest.accountId,
      target,
      entries: kept,
    },
    evicted: next.slice(target),
  };
}

export function reconcileWatchFeedWithOfflineManifest(
  feed: WatchVideo[],
  retained: WatchVideo[]
): WatchVideo[] {
  if (retained.length === 0) return feed;
  const byPostId = new Map<number, WatchVideo>();
  const byId = new Map<string, WatchVideo>();
  for (const video of retained) {
    if (video.postId != null) byPostId.set(video.postId, video);
    byId.set(video.id, video);
  }
  return feed.map((video) => {
    const hit =
      (video.postId != null ? byPostId.get(video.postId) : undefined) ??
      byId.get(video.id);
    if (!hit || !isLocalWatchPlaybackUri(hit.src)) return video;
    return { ...video, src: hit.src };
  });
}

export function offlineBootstrapUsesFileUrisOnly(
  videos: WatchVideo[]
): boolean {
  return (
    videos.length > 0 &&
    videos.every((video) => isLocalWatchPlaybackUri(video.src))
  );
}

async function resolveOptionalPort(
  port?: WatchMediaCachePort | null
): Promise<WatchMediaCachePort | null> {
  if (port) return port;
  try {
    const { resolveWatchMediaCachePort } = await import(
      "./androidWatchMediaCache"
    );
    return resolveWatchMediaCachePort();
  } catch {
    return null;
  }
}

export async function persistWatchOfflineManifest(input: {
  accountId: string;
  manifest: WatchOfflineManifest;
  port?: WatchMediaCachePort | null;
}): Promise<boolean> {
  const accountId = sanitizeWatchOfflineAccountId(input.accountId);
  if (!accountId) return false;
  const port = await resolveOptionalPort(input.port);
  if (!port) return false;
  const dest = watchOfflineManifestUri(port.cacheDirectory(), accountId);
  if (!dest) return false;
  const temp = `${dest}.tmp`;
  const payload = JSON.stringify({
    ...input.manifest,
    version: WATCH_OFFLINE_MANIFEST_VERSION,
    accountId,
    target: WATCH_OFFLINE_MANIFEST_TARGET,
  });
  await port.writeText(temp, payload);
  try {
    if (await port.exists(dest)) {
      await port.delete(dest);
    }
  } catch {
    // Replace still proceeds via move.
  }
  await port.move(temp, dest);
  return true;
}

export async function loadWatchOfflineManifest(input: {
  accountId: string | null | undefined;
  port?: WatchMediaCachePort | null;
  verifyFiles?: boolean;
}): Promise<WatchOfflineManifest> {
  const accountId = sanitizeWatchOfflineAccountId(input.accountId);
  const empty = emptyWatchOfflineManifest(accountId ?? "");
  if (!accountId) return empty;
  const port = await resolveOptionalPort(input.port);
  if (!port) return empty;
  const dest = watchOfflineManifestUri(port.cacheDirectory(), accountId);
  if (!dest) return empty;
  const raw = await port.readText(dest);
  const parsed = parseWatchOfflineManifest(raw, accountId);
  if (input.verifyFiles === false) return parsed;

  const kept: WatchOfflineManifestEntry[] = [];
  let removed = false;
  for (const entry of parsed.entries) {
    if (!isValidWatchOfflineManifestEntry(entry)) {
      removed = true;
      continue;
    }
    const exists = await port.exists(entry.localUri);
    const size = exists ? await port.size(entry.localUri) : 0;
    if (!exists || size <= 0) {
      removed = true;
      continue;
    }
    kept.push(entry);
  }
  const next: WatchOfflineManifest = {
    ...parsed,
    accountId,
    entries: kept,
  };
  if (removed) {
    await persistWatchOfflineManifest({
      accountId,
      manifest: next,
      port,
    });
  }
  return next;
}

export async function rememberWatchedOfflineVideo(input: {
  accountId: string | null | undefined;
  video: WatchVideo;
  localUri: string;
  remoteUri?: string | null;
  now?: number;
  touchWatched?: boolean;
  port?: WatchMediaCachePort | null;
}): Promise<{
  manifest: WatchOfflineManifest;
  evicted: WatchOfflineManifestEntry[];
}> {
  const accountId = sanitizeWatchOfflineAccountId(input.accountId);
  const empty = emptyWatchOfflineManifest(accountId ?? "");
  if (!accountId) return { manifest: empty, evicted: [] };
  const port = await resolveOptionalPort(input.port);
  if (!port) return { manifest: empty, evicted: [] };
  const current = await loadWatchOfflineManifest({
    accountId,
    port,
    verifyFiles: false,
  });
  const existing =
    current.entries.find(
      (row) =>
        row.mediaId === watchMediaIdentity(input.video) ||
        row.postId === input.video.postId
    ) ?? null;
  const now = input.now ?? Date.now();
  const lastWatchedAt =
    input.touchWatched === false
      ? (existing?.lastWatchedAt ?? now)
      : now;
  const snapshot = snapshotWatchVideoForOffline({
    video: input.video,
    localUri: input.localUri,
    remoteUri: input.remoteUri,
    cachedAt: now,
    lastWatchedAt,
    existing,
  });
  if (!snapshot) return { manifest: current, evicted: [] };
  const { manifest, evicted } = upsertWatchOfflineManifestEntry(
    current,
    snapshot
  );
  await persistWatchOfflineManifest({ accountId, manifest, port });
  for (const gone of evicted) {
    try {
      await port.delete(gone.localUri);
    } catch {
      // Best-effort file cleanup after rolling eviction.
    }
  }
  return { manifest, evicted };
}

export async function clearWatchOfflineManifestForAccount(input: {
  accountId: string | null | undefined;
  port?: WatchMediaCachePort | null;
}): Promise<void> {
  const accountId = sanitizeWatchOfflineAccountId(input.accountId);
  if (!accountId) return;
  const port = await resolveOptionalPort(input.port);
  if (!port) return;
  const current = await loadWatchOfflineManifest({
    accountId,
    port,
    verifyFiles: false,
  });
  for (const entry of current.entries) {
    try {
      await port.delete(entry.localUri);
    } catch {
      // Best-effort privacy cleanup.
    }
  }
  const dest = watchOfflineManifestUri(port.cacheDirectory(), accountId);
  if (!dest) return;
  try {
    await port.delete(dest);
  } catch {
    // Already gone.
  }
  try {
    await port.delete(`${dest}.tmp`);
  } catch {
    // Ignore leftover temp.
  }
}

export type WatchStartupFeedResult<T extends { videos: WatchVideo[] }> = {
  page: T | null;
  videos: WatchVideo[];
  source: "feed" | "offline";
  timedOut: boolean;
};

export async function resolveWatchStartupFeed<
  T extends { videos: WatchVideo[] },
>(input: {
  accountId: string | null | undefined;
  fetchFeed: () => Promise<T>;
  timeoutMs?: number;
  port?: WatchMediaCachePort | null;
}): Promise<WatchStartupFeedResult<T>> {
  const retainedManifest = await loadWatchOfflineManifest({
    accountId: input.accountId,
    port: input.port,
    verifyFiles: true,
  });
  const retained = watchVideosFromOfflineManifest(retainedManifest);
  const timeoutMs = input.timeoutMs ?? WATCH_FEED_BOOTSTRAP_TIMEOUT_MS;

  try {
    const page = await withTimeout(input.fetchFeed(), timeoutMs);
    return {
      page,
      videos: reconcileWatchFeedWithOfflineManifest(page.videos, retained),
      source: "feed",
      timedOut: false,
    };
  } catch (error) {
    const timedOut =
      error instanceof Error && error.message === "WATCH_FEED_TIMEOUT";
    return {
      page: null,
      videos: retained,
      source: "offline",
      timedOut,
    };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("WATCH_FEED_TIMEOUT"));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
