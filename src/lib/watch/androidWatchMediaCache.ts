import { setVideoCacheSizeAsync } from "expo-video";

import type { WatchVideo } from "@/src/contracts/watch";
import { isLocalWatchPlaybackUri } from "@/src/lib/feed/videoStoragePath";

import { watchMediaIdentity } from "./watchCellBinding";
import {
  loadWatchOfflineManifest,
  rememberWatchedOfflineVideo,
} from "./watchOfflineManifest";
import { markWatchCache } from "./watchTransitionTrace";
import {
  inspectLocalWatchPlaybackFile,
  shouldApplyLocalWatchUriToVideo,
} from "./watchRetainedPlaybackFallback";

/** Bounded Media3 disk cache for Android Watch. LRU, not a gallery download. */
export const ANDROID_WATCH_VIDEO_CACHE_BYTES = 192 * 1024 * 1024;

export const ANDROID_WATCH_FORWARD_BUFFER_SECONDS = 8;
export const ANDROID_WATCH_MIN_BUFFER_SECONDS = 1;
export const ANDROID_WATCH_MAX_BUFFER_BYTES = 12 * 1024 * 1024;

/**
 * Rolling on-device Watch window. Identity is post/media id, not list index.
 * Phase 2 keeps five upcoming real videos ready. Phase 3 independently
 * retains the five most recently watched previous videos. Forward and
 * previous windows do not share eviction. Cache must never write
 * activeIndex, scroll FlatList, claim player ownership, or attach/detach
 * VideoView.
 */
export const ANDROID_WATCH_FORWARD_READY_TARGET = 5;
export const ANDROID_WATCH_PREVIOUS_READY_TARGET = 5;
export const ANDROID_WATCH_CACHE_TARGET = ANDROID_WATCH_FORWARD_READY_TARGET;
export const ANDROID_WATCH_CACHE_DIR_NAME = "umtuba-watch-media/";
export const ANDROID_WATCH_CACHE_MANIFEST_NAME = "umtuba-watch-rolling-v1.json";

export type AndroidWatchBufferOptions = {
  preferredForwardBufferDuration: number;
  minBufferForPlayback: number;
  maxBufferBytes: number;
  prioritizeTimeOverSizeThreshold: boolean;
};

export function resolveAndroidWatchBufferOptions(
  platform: string | null | undefined
): AndroidWatchBufferOptions | null {
  if (platform !== "android") return null;
  return {
    preferredForwardBufferDuration: ANDROID_WATCH_FORWARD_BUFFER_SECONDS,
    minBufferForPlayback: ANDROID_WATCH_MIN_BUFFER_SECONDS,
    maxBufferBytes: ANDROID_WATCH_MAX_BUFFER_BYTES,
    prioritizeTimeOverSizeThreshold: true,
  };
}

let configured = false;

export async function ensureAndroidWatchVideoCache(
  platform: string | null | undefined
): Promise<boolean> {
  if (platform !== "android" || configured) return configured;
  try {
    await setVideoCacheSizeAsync(ANDROID_WATCH_VIDEO_CACHE_BYTES);
    configured = true;
    return true;
  } catch {
    return false;
  }
}

export type WatchCacheEntry = {
  mediaId: string;
  videoId: string;
  uri: string;
  bytes: number;
  cachedAt: number;
};

export type WatchCacheManifest = {
  target: number;
  entries: WatchCacheEntry[];
};

export type WatchMediaCachePort = {
  cacheDirectory: () => string | null;
  documentDirectory: () => string | null;
  exists: (uri: string) => Promise<boolean>;
  size: (uri: string) => Promise<number>;
  download: (
    sourceUrl: string,
    destUri: string
  ) => Promise<{ uri: string; status: number }>;
  delete: (uri: string) => Promise<void>;
  ensureDir: (uri: string) => Promise<void>;
  readText: (uri: string) => Promise<string | null>;
  writeText: (uri: string, text: string) => Promise<void>;
  move: (from: string, to: string) => Promise<void>;
  copy: (from: string, to: string) => Promise<void>;
};

/** Expo FileSystem/legacy shape used by the production Watch cache port. */
export type ExpoWatchFileSystemLike = {
  cacheDirectory: string | null;
  documentDirectory: string | null;
  getInfoAsync: (
    uri: string
  ) => Promise<{ exists: boolean; size?: number }>;
  downloadAsync: (
    sourceUrl: string,
    destUri: string
  ) => Promise<{ uri: string; status: number }>;
  deleteAsync: (uri: string, options?: { idempotent?: boolean }) => Promise<void>;
  moveAsync: (options: { from: string; to: string }) => Promise<void>;
  copyAsync: (options: { from: string; to: string }) => Promise<void>;
  makeDirectoryAsync: (
    uri: string,
    options?: { intermediates?: boolean }
  ) => Promise<void>;
  readAsStringAsync: (uri: string) => Promise<string>;
  writeAsStringAsync: (uri: string, text: string) => Promise<void>;
};

export type WatchCachePlanItem = {
  mediaId: string;
  videoId: string;
  src: string;
};

export type WatchCacheWindowPlan = {
  target: number;
  previousTarget: number;
  keepIds: string[];
  downloadIds: string[];
  evictIds: string[];
  hits: string[];
  upcomingCount: number;
  previousCount: number;
};

export function emptyWatchCacheManifest(
  target = ANDROID_WATCH_CACHE_TARGET
): WatchCacheManifest {
  return { target, entries: [] };
}

export function watchCacheFileName(mediaId: string): string {
  const safe = mediaId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${safe}.mp4`;
}

export function isValidWatchCacheEntry(
  entry: WatchCacheEntry | null | undefined
): boolean {
  if (!entry) return false;
  if (!entry.mediaId || !entry.uri) return false;
  if (!isLocalWatchPlaybackUri(entry.uri)) return false;
  return Number.isFinite(entry.bytes) && entry.bytes > 0;
}

export function shouldRedownloadWatchCache(input: {
  entry?: WatchCacheEntry | null;
  fileExists: boolean;
}): boolean {
  if (!input.fileExists) return true;
  return !isValidWatchCacheEntry(input.entry);
}

export function countWatchFeedUpcoming(
  itemCount: number,
  activeIndex: number
): number {
  if (!Number.isFinite(itemCount) || itemCount <= 0) return 0;
  const index = Number.isFinite(activeIndex)
    ? Math.max(0, Math.trunc(activeIndex))
    : 0;
  return Math.max(0, Math.trunc(itemCount) - index - 1);
}

/**
 * Request the next real feed page before the loaded list can no longer
 * supply five upcoming identities. Does not change paging / swipe.
 */
export function shouldRequestWatchFeedForwardPage(input: {
  activeIndex: number;
  itemCount: number;
  hasMore: boolean;
  target?: number;
}): boolean {
  if (!input.hasMore) return false;
  if (input.itemCount <= 0) return false;
  const target = input.target ?? ANDROID_WATCH_FORWARD_READY_TARGET;
  return countWatchFeedUpcoming(input.itemCount, input.activeIndex) <= target;
}

/**
 * Evict leftovers that left the keep window only when the loaded feed is
 * complete enough to know they are not needed. Incomplete cold snapshots
 * must not delete valid forward files that the next page will keep.
 */
export function shouldEvictWatchRollingCacheEntry(input: {
  mediaId: string;
  keepIds: readonly string[];
  feedMediaIds: readonly string[];
  upcomingCount: number;
  target?: number;
}): boolean {
  if (input.keepIds.includes(input.mediaId)) return false;
  const target = input.target ?? ANDROID_WATCH_FORWARD_READY_TARGET;
  const inFeed = input.feedMediaIds.includes(input.mediaId);
  if (!inFeed && input.upcomingCount < target) return false;
  return true;
}

/** Cold remount: a valid on-disk file for a feed identity is a hit. */
export function shouldReuseWatchCacheOnRemount(input: {
  fileExists: boolean;
  bytes: number;
  mediaIdInFeed: boolean;
}): boolean {
  return input.fileExists && input.bytes > 0 && input.mediaIdInFeed;
}

export function countWatchCachePreviousReady(input: {
  videos: Array<{
    id: string;
    postId?: number | null;
    src?: string | null;
  }>;
  activeIndex: number;
  cachedIds: readonly string[];
  previousTarget?: number;
}): number {
  const previousTarget =
    input.previousTarget ?? ANDROID_WATCH_PREVIOUS_READY_TARGET;
  const activeIndex = Number.isFinite(input.activeIndex)
    ? Math.max(0, Math.trunc(input.activeIndex))
    : 0;
  const cached = new Set(input.cachedIds);
  let previous = 0;
  let ready = 0;
  const start = Math.max(0, activeIndex - previousTarget);
  for (let i = start; i < activeIndex; i += 1) {
    const mediaId = watchMediaIdentity(input.videos[i]);
    if (!mediaId) continue;
    previous += 1;
    if (cached.has(mediaId)) ready += 1;
  }
  return ready;
}

export function countWatchCacheUpcomingReady(input: {
  videos: Array<{
    id: string;
    postId?: number | null;
    src?: string | null;
  }>;
  activeIndex: number;
  cachedIds: readonly string[];
  target?: number;
}): number {
  const target = input.target ?? ANDROID_WATCH_FORWARD_READY_TARGET;
  const activeIndex = Number.isFinite(input.activeIndex)
    ? Math.max(0, Math.trunc(input.activeIndex))
    : 0;
  const cached = new Set(input.cachedIds);
  let upcoming = 0;
  let ready = 0;
  for (let i = activeIndex + 1; i < input.videos.length && upcoming < target; i += 1) {
    const mediaId = watchMediaIdentity(input.videos[i]);
    if (!mediaId) continue;
    upcoming += 1;
    if (cached.has(mediaId)) ready += 1;
  }
  return ready;
}

export function watchCacheDestUri(dir: string, mediaId: string): string {
  return `${dir}${ANDROID_WATCH_CACHE_DIR_NAME}${watchCacheFileName(mediaId)}`;
}

export function planAndroidWatchCacheWindow(input: {
  videos: Array<{
    id: string;
    postId?: number | null;
    src?: string | null;
  }>;
  activeIndex: number;
  manifest?: WatchCacheManifest;
  target?: number;
  previousTarget?: number;
}): WatchCacheWindowPlan {
  const target = input.target ?? ANDROID_WATCH_FORWARD_READY_TARGET;
  const previousTarget =
    input.previousTarget ?? ANDROID_WATCH_PREVIOUS_READY_TARGET;
  const activeIndex = Number.isFinite(input.activeIndex)
    ? Math.max(0, Math.trunc(input.activeIndex))
    : 0;
  const keep: WatchCachePlanItem[] = [];
  const seen = new Set<string>();
  const pushIndex = (index: number): boolean => {
    const video = input.videos[index];
    if (!video) return false;
    const mediaId = watchMediaIdentity(video);
    if (!mediaId || seen.has(mediaId)) return false;
    seen.add(mediaId);
    keep.push({
      mediaId,
      videoId: video.id,
      src: (video.src ?? "").trim(),
    });
    return true;
  };
  const previousStart = Math.max(0, activeIndex - previousTarget);
  let previous = 0;
  for (let i = previousStart; i < activeIndex; i += 1) {
    if (pushIndex(i)) previous += 1;
  }
  pushIndex(activeIndex);
  let upcoming = 0;
  for (let i = activeIndex + 1; i < input.videos.length && upcoming < target; i += 1) {
    if (pushIndex(i)) upcoming += 1;
  }

  const keepIds = keep.map((item) => item.mediaId);
  const keepSet = new Set(keepIds);
  const manifest = input.manifest ?? emptyWatchCacheManifest(target);
  const hits: string[] = [];
  const downloadIds: string[] = [];
  for (const item of keep) {
    const entry = manifest.entries.find((row) => row.mediaId === item.mediaId);
    if (isValidWatchCacheEntry(entry)) {
      hits.push(item.mediaId);
    } else {
      downloadIds.push(item.mediaId);
    }
  }
  const evictIds = manifest.entries
    .filter((entry) => !keepSet.has(entry.mediaId))
    .sort((a, b) => a.cachedAt - b.cachedAt)
    .map((entry) => entry.mediaId);

  return {
    target,
    previousTarget,
    keepIds,
    downloadIds,
    evictIds,
    hits,
    upcomingCount: upcoming,
    previousCount: previous,
  };
}

export function parseWatchCacheManifest(
  raw: string | null | undefined
): WatchCacheManifest {
  if (!raw) return emptyWatchCacheManifest();
  try {
    const parsed = JSON.parse(raw) as WatchCacheManifest;
    if (!parsed || !Array.isArray(parsed.entries)) {
      return emptyWatchCacheManifest();
    }
    return {
      target: ANDROID_WATCH_CACHE_TARGET,
      entries: parsed.entries.filter(isValidWatchCacheEntry),
    };
  } catch {
    return emptyWatchCacheManifest();
  }
}

const inflightDownloads = new Map<string, Promise<string | null>>();

export type WatchCacheHit = {
  videoId: string;
  mediaId: string;
  uri: string;
};

export type WatchCacheSyncResult = {
  target: number;
  cachedIds: string[];
  hits: string[];
  misses: string[];
  evicted: string[];
};

async function readManifest(
  port: WatchMediaCachePort
): Promise<{ dir: string; manifestUri: string; manifest: WatchCacheManifest }> {
  const dir = port.cacheDirectory();
  if (!dir) {
    return {
      dir: "",
      manifestUri: "",
      manifest: emptyWatchCacheManifest(),
    };
  }
  const manifestUri = `${dir}${ANDROID_WATCH_CACHE_MANIFEST_NAME}`;
  const raw = await port.readText(manifestUri);
  return {
    dir,
    manifestUri,
    manifest: parseWatchCacheManifest(raw),
  };
}

async function writeManifest(
  port: WatchMediaCachePort,
  manifestUri: string,
  manifest: WatchCacheManifest
): Promise<void> {
  if (!manifestUri) return;
  await port.writeText(manifestUri, JSON.stringify(manifest));
}

async function entryStillOnDisk(
  port: WatchMediaCachePort,
  entry: WatchCacheEntry
): Promise<boolean> {
  if (!isValidWatchCacheEntry(entry)) return false;
  const exists = await port.exists(entry.uri);
  if (!exists) return false;
  const size = await port.size(entry.uri);
  return size > 0;
}

export async function peekAndroidWatchCacheHits(input: {
  videos: WatchVideo[];
  port?: WatchMediaCachePort;
}): Promise<WatchCacheHit[]> {
  const port = resolvePort(input.port);
  if (!port) return [];
  const { dir, manifest } = await readManifest(port);
  const hits: WatchCacheHit[] = [];
  const staleMediaIds: string[] = [];
  for (const video of input.videos) {
    const mediaId = watchMediaIdentity(video);
    if (!mediaId) continue;
    const entry = manifest.entries.find((row) => row.mediaId === mediaId);
    const destUri = entry?.uri ?? (dir ? watchCacheDestUri(dir, mediaId) : "");
    if (!destUri) continue;
    const check = await inspectLocalWatchPlaybackFile(port, destUri);
    if (!check.usable) {
      if (entry) staleMediaIds.push(mediaId);
      continue;
    }
    if (
      !shouldApplyLocalWatchUriToVideo({
        video,
        candidateMediaId: mediaId,
        candidateUri: destUri,
        fileUsable: true,
      })
    ) {
      continue;
    }
    hits.push({ videoId: video.id, mediaId, uri: destUri });
  }
  if (staleMediaIds.length > 0) {
    await invalidateStaleAndroidWatchCacheEntries({
      mediaIds: staleMediaIds,
      port,
    });
  }
  return hits;
}

export async function invalidateStaleAndroidWatchCacheEntries(input: {
  mediaIds: string[];
  port?: WatchMediaCachePort;
}): Promise<WatchCacheManifest> {
  const port = resolvePort(input.port);
  if (!port || input.mediaIds.length === 0) {
    return emptyWatchCacheManifest();
  }
  const { manifestUri, manifest } = await readManifest(port);
  const drop = new Set(input.mediaIds);
  const next: WatchCacheManifest = {
    target: ANDROID_WATCH_CACHE_TARGET,
    entries: manifest.entries.filter((row) => !drop.has(row.mediaId)),
  };
  if (next.entries.length !== manifest.entries.length) {
    await writeManifest(port, manifestUri, next);
  }
  return next;
}

type WatchCacheSyncInput = {
  platform?: string | null;
  videos: WatchVideo[];
  activeIndex: number;
  accountId?: string | null;
  now?: number;
  port?: WatchMediaCachePort;
  onResolved?: (videoId: string, localUri: string) => void;
};

type WatchCacheSyncWaiter = {
  resolve: (result: WatchCacheSyncResult) => void;
  reject: (error: unknown) => void;
};

let syncRunning = false;
let latestSyncInput: WatchCacheSyncInput | null = null;
let syncWaiters: WatchCacheSyncWaiter[] = [];

export function __resetAndroidWatchCacheSyncForTests(): void {
  inflightDownloads.clear();
  syncRunning = false;
  latestSyncInput = null;
  syncWaiters = [];
}

export async function syncAndroidWatchRollingCache(
  input: WatchCacheSyncInput
): Promise<WatchCacheSyncResult> {
  return new Promise((resolve, reject) => {
    latestSyncInput = input;
    syncWaiters.push({ resolve, reject });
    void pumpAndroidWatchCacheSync();
  });
}

async function pumpAndroidWatchCacheSync(): Promise<void> {
  if (syncRunning) return;
  syncRunning = true;
  try {
    while (syncWaiters.length > 0) {
      const input = latestSyncInput;
      const waiters = syncWaiters;
      latestSyncInput = null;
      syncWaiters = [];
      if (!input) {
        for (const waiter of waiters) {
          waiter.resolve({
            target: ANDROID_WATCH_CACHE_TARGET,
            cachedIds: [],
            hits: [],
            misses: [],
            evicted: [],
          });
        }
        continue;
      }
      try {
        const result = await runAndroidWatchRollingCacheSync(input);
        for (const waiter of waiters) waiter.resolve(result);
      } catch (error) {
        for (const waiter of waiters) waiter.reject(error);
      }
    }
  } finally {
    syncRunning = false;
    if (syncWaiters.length > 0) {
      void pumpAndroidWatchCacheSync();
    }
  }
}

async function runAndroidWatchRollingCacheSync(
  input: WatchCacheSyncInput
): Promise<WatchCacheSyncResult> {
  const empty: WatchCacheSyncResult = {
    target: ANDROID_WATCH_CACHE_TARGET,
    cachedIds: [],
    hits: [],
    misses: [],
    evicted: [],
  };
  if (input.platform != null && input.platform !== "android" && !input.port) {
    return empty;
  }
  const port = resolvePort(input.port);
  if (!port) return empty;
  const { dir, manifestUri, manifest } = await readManifest(port);
  if (!dir) return empty;

  const plan = planAndroidWatchCacheWindow({
    videos: input.videos,
    activeIndex: input.activeIndex,
    manifest,
  });
  const feedMediaIds = input.videos
    .map((video) => watchMediaIdentity(video))
    .filter((mediaId): mediaId is string => Boolean(mediaId));
  const upcomingCount = countWatchFeedUpcoming(
    input.videos.length,
    input.activeIndex
  );

  const mediaDir = `${dir}${ANDROID_WATCH_CACHE_DIR_NAME}`;
  await port.ensureDir(mediaDir);

  const retainedMediaIds = new Set<string>();
  if (input.accountId) {
    const offline = await loadWatchOfflineManifest({
      accountId: input.accountId,
      port,
      verifyFiles: true,
    });
    for (const row of offline.entries) {
      retainedMediaIds.add(row.mediaId);
    }
  }

  const nextEntries: WatchCacheEntry[] = [];
  const hits: string[] = [];
  const misses: string[] = [];

  for (const entry of manifest.entries) {
    if (await entryStillOnDisk(port, entry)) {
      nextEntries.push(entry);
    }
  }

  const keepSet = new Set(plan.keepIds);
  const downloadJobs: Array<{
    video: WatchVideo;
    mediaId: string;
    src: string;
    destUri: string;
  }> = [];

  for (const video of input.videos) {
    const mediaId = watchMediaIdentity(video);
    if (!keepSet.has(mediaId)) continue;
    const existing = nextEntries.find((row) => row.mediaId === mediaId);
    const destUri = existing?.uri ?? watchCacheDestUri(dir, mediaId);
    if (existing) {
      hits.push(mediaId);
      const usable = await inspectLocalWatchPlaybackFile(port, existing.uri);
      if (
        usable.usable &&
        shouldApplyLocalWatchUriToVideo({
          video,
          candidateMediaId: existing.mediaId,
          candidateUri: existing.uri,
          fileUsable: true,
        }) &&
        !isLocalWatchPlaybackUri(video.src)
      ) {
        input.onResolved?.(video.id, existing.uri);
      }
      continue;
    }
    const destBytes = (await port.exists(destUri)) ? await port.size(destUri) : 0;
    if (
      shouldReuseWatchCacheOnRemount({
        fileExists: destBytes > 0,
        bytes: destBytes,
        mediaIdInFeed: true,
      })
    ) {
      const reused: WatchCacheEntry = {
        mediaId,
        videoId: video.id,
        uri: destUri,
        bytes: destBytes,
        cachedAt: Date.now(),
      };
      if (isValidWatchCacheEntry(reused)) {
        nextEntries.push(reused);
        hits.push(mediaId);
        if (
          shouldApplyLocalWatchUriToVideo({
            video,
            candidateMediaId: mediaId,
            candidateUri: destUri,
            fileUsable: true,
          }) &&
          !isLocalWatchPlaybackUri(video.src)
        ) {
          input.onResolved?.(video.id, destUri);
        }
        continue;
      }
    }
    const src = (video.src ?? "").trim();
    if (!src || isLocalWatchPlaybackUri(src)) {
      misses.push(mediaId);
      continue;
    }
    downloadJobs.push({ video, mediaId, src, destUri });
  }

  const downloaded = await Promise.all(
    downloadJobs.map(async (job) => ({
      job,
      uri: await downloadWatchCacheFile(port, job.mediaId, job.src, job.destUri),
    }))
  );
  for (const row of downloaded) {
    if (!row.uri) {
      misses.push(row.job.mediaId);
      continue;
    }
    const bytes = await port.size(row.uri);
    const entry: WatchCacheEntry = {
      mediaId: row.job.mediaId,
      videoId: row.job.video.id,
      uri: row.uri,
      bytes,
      cachedAt: Date.now(),
    };
    if (!isValidWatchCacheEntry(entry)) {
      try {
        await port.delete(row.uri);
      } catch {
        // Drop incomplete cache files so they cannot be served later.
      }
      misses.push(row.job.mediaId);
      continue;
    }
    if (
      !shouldApplyLocalWatchUriToVideo({
        video: row.job.video,
        candidateMediaId: entry.mediaId,
        candidateUri: entry.uri,
        fileUsable: true,
      })
    ) {
      misses.push(row.job.mediaId);
      continue;
    }
    nextEntries.push(entry);
    hits.push(row.job.mediaId);
    input.onResolved?.(row.job.video.id, row.uri);
  }

  const evicted: string[] = [];
  const retained: WatchCacheEntry[] = [];
  for (const entry of nextEntries) {
    const evict = shouldEvictWatchRollingCacheEntry({
      mediaId: entry.mediaId,
      keepIds: plan.keepIds,
      feedMediaIds,
      upcomingCount,
      target: plan.target,
    });
    if (!evict) {
      retained.push(entry);
      continue;
    }
    evicted.push(entry.mediaId);
    if (!retainedMediaIds.has(entry.mediaId)) {
      try {
        await port.delete(entry.uri);
      } catch {
        // Best-effort eviction.
      }
    }
  }

  const seen = new Set<string>();
  const keepOrdered: WatchCacheEntry[] = [];
  for (const mediaId of plan.keepIds) {
    const entry = retained.find((row) => row.mediaId === mediaId);
    if (!entry || seen.has(mediaId)) continue;
    seen.add(mediaId);
    keepOrdered.push(entry);
  }
  const held = retained.filter((entry) => !seen.has(entry.mediaId));
  const nextManifest: WatchCacheManifest = {
    target: ANDROID_WATCH_FORWARD_READY_TARGET,
    entries: [...keepOrdered, ...held],
  };
  await writeManifest(port, manifestUri, nextManifest);

  if (input.accountId) {
    const now = input.now ?? Date.now();
    const activeVideo = input.videos[input.activeIndex];
    const previousStart = Math.max(
      0,
      input.activeIndex - ANDROID_WATCH_PREVIOUS_READY_TARGET
    );
    const rememberVideos: WatchVideo[] = [];
    for (let i = previousStart; i <= input.activeIndex; i += 1) {
      const video = input.videos[i];
      if (video) rememberVideos.push(video);
    }
    const activeMediaId = activeVideo ? watchMediaIdentity(activeVideo) : null;
    for (const video of rememberVideos) {
      const mediaId = watchMediaIdentity(video);
      const cached = keepOrdered.find((row) => row.mediaId === mediaId);
      if (!cached) continue;
      const remoteUri = isLocalWatchPlaybackUri(video.src) ? undefined : video.src;
      await rememberWatchedOfflineVideo({
        accountId: input.accountId,
        video,
        localUri: cached.uri,
        remoteUri,
        now,
        touchWatched: mediaId === activeMediaId,
        port,
      });
    }
  }

  const result: WatchCacheSyncResult = {
    target: ANDROID_WATCH_CACHE_TARGET,
    cachedIds: keepOrdered.map((entry) => entry.mediaId),
    hits,
    misses,
    evicted,
  };
  markWatchCache(input.platform ?? "android", {
    target: result.target,
    cachedIds: result.cachedIds,
    hits: result.hits,
    misses: result.misses,
    evicted: result.evicted,
  });
  return result;
}

async function downloadWatchCacheFile(
  port: WatchMediaCachePort,
  mediaId: string,
  src: string,
  destUri: string
): Promise<string | null> {
  const existing = inflightDownloads.get(mediaId);
  if (existing) return existing;
  const pending = (async () => {
    try {
      if (await port.exists(destUri)) {
        const size = await port.size(destUri);
        if (size > 0) return destUri;
        try {
          await port.delete(destUri);
        } catch {
          // Replace a zero-byte leftover before writing.
        }
      }
      const downloaded = await port.download(src, destUri);
      if (downloaded.status < 200 || downloaded.status >= 300) {
        try {
          await port.delete(destUri);
        } catch {
          // Interrupted / failed download must not remain as a hit.
        }
        return null;
      }
      if (!isLocalWatchPlaybackUri(downloaded.uri)) return null;
      const size = await port.size(downloaded.uri);
      if (!(size > 0)) {
        try {
          await port.delete(downloaded.uri);
        } catch {
          // Zero-byte dest is not a cache hit.
        }
        return null;
      }
      return downloaded.uri;
    } catch {
      try {
        await port.delete(destUri);
      } catch {
        // Best-effort cleanup after an interrupted download.
      }
      return null;
    } finally {
      inflightDownloads.delete(mediaId);
    }
  })();
  inflightDownloads.set(mediaId, pending);
  return pending;
}

let defaultWatchMediaCachePort: WatchMediaCachePort | null = null;

export function createFileSystemWatchMediaCachePort(
  fileSystem?: ExpoWatchFileSystemLike
): WatchMediaCachePort {
  // Lazy so unit tests that inject a memory port never touch native FS.
  const FileSystem =
    fileSystem ??
    (require("expo-file-system/legacy") as ExpoWatchFileSystemLike);
  return {
    cacheDirectory: () => FileSystem.cacheDirectory,
    documentDirectory: () => FileSystem.documentDirectory,
    exists: async (uri) => {
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists === true;
    },
    size: async (uri) => {
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists && typeof info.size === "number" ? info.size : 0;
    },
    download: (sourceUrl, destUri) => FileSystem.downloadAsync(sourceUrl, destUri),
    delete: (uri) => FileSystem.deleteAsync(uri, { idempotent: true }),
    ensureDir: async (uri) => {
      try {
        await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
      } catch {
        // Directory may already exist.
      }
    },
    readText: async (uri) => {
      try {
        return await FileSystem.readAsStringAsync(uri);
      } catch {
        return null;
      }
    },
    writeText: (uri, text) => FileSystem.writeAsStringAsync(uri, text),
    move: (from, to) => FileSystem.moveAsync({ from, to }),
    copy: (from, to) => FileSystem.copyAsync({ from, to }),
  };
}

function resolvePort(port?: WatchMediaCachePort): WatchMediaCachePort | null {
  if (port) return port;
  if (!defaultWatchMediaCachePort) {
    try {
      defaultWatchMediaCachePort = createFileSystemWatchMediaCachePort();
    } catch {
      return null;
    }
  }
  return defaultWatchMediaCachePort;
}

export function resolveWatchMediaCachePort(
  port?: WatchMediaCachePort
): WatchMediaCachePort | null {
  return resolvePort(port);
}

export function __setWatchMediaCachePortForTests(
  port: WatchMediaCachePort | null
): void {
  defaultWatchMediaCachePort = port;
}

export function createMemoryWatchMediaCachePort(
  cacheRoot = "file:///cache/",
  documentRoot = "file:///documents/",
  options?: { beforeDownload?: (sourceUrl: string) => Promise<void> }
): WatchMediaCachePort & { files: Map<string, string>; downloads: string[] } {
  const files = new Map<string, string>();
  const downloads: string[] = [];
  return {
    files,
    downloads,
    cacheDirectory: () => cacheRoot,
    documentDirectory: () => documentRoot,
    exists: async (uri) => files.has(uri),
    size: async (uri) => files.get(uri)?.length ?? 0,
    download: async (sourceUrl, destUri) => {
      if (options?.beforeDownload) {
        await options.beforeDownload(sourceUrl);
      }
      downloads.push(sourceUrl);
      files.set(destUri, sourceUrl);
      return { uri: destUri, status: 200 };
    },
    delete: async (uri) => {
      files.delete(uri);
      if (!uri.endsWith("/")) return;
      for (const key of [...files.keys()]) {
        if (key.startsWith(uri)) files.delete(key);
      }
    },
    ensureDir: async () => undefined,
    readText: async (uri) => files.get(uri) ?? null,
    writeText: async (uri, text) => {
      files.set(uri, text);
    },
    move: async (from, to) => {
      const text = files.get(from);
      if (text == null) return;
      files.set(to, text);
      files.delete(from);
    },
    copy: async (from, to) => {
      const text = files.get(from);
      if (text == null) return;
      files.set(to, text);
    },
  };
}
