import { setVideoCacheSizeAsync } from "expo-video";

import type { WatchVideo } from "@/src/contracts/watch";
import { isLocalWatchPlaybackUri } from "@/src/lib/feed/videoStoragePath";

import { watchMediaIdentity } from "./watchCellBinding";
import { markWatchCache } from "./watchTransitionTrace";

/** Bounded Media3 disk cache for Android Watch. LRU, not a gallery download. */
export const ANDROID_WATCH_VIDEO_CACHE_BYTES = 192 * 1024 * 1024;

export const ANDROID_WATCH_FORWARD_BUFFER_SECONDS = 8;
export const ANDROID_WATCH_MIN_BUFFER_SECONDS = 1;
export const ANDROID_WATCH_MAX_BUFFER_BYTES = 12 * 1024 * 1024;

/** Rolling on-device Watch window. Identity is post/media id, not list index. */
export const ANDROID_WATCH_CACHE_TARGET = 5;
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
};

export type WatchCachePlanItem = {
  mediaId: string;
  videoId: string;
  src: string;
};

export type WatchCacheWindowPlan = {
  target: number;
  keepIds: string[];
  downloadIds: string[];
  evictIds: string[];
  hits: string[];
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

export function planAndroidWatchCacheWindow(input: {
  videos: Array<{
    id: string;
    postId?: number | null;
    src?: string | null;
  }>;
  activeIndex: number;
  manifest?: WatchCacheManifest;
  target?: number;
}): WatchCacheWindowPlan {
  const target = input.target ?? ANDROID_WATCH_CACHE_TARGET;
  const activeIndex = Number.isFinite(input.activeIndex)
    ? Math.max(0, Math.trunc(input.activeIndex))
    : 0;
  const start = activeIndex > 0 ? Math.max(0, activeIndex - 1) : 0;
  const keep: WatchCachePlanItem[] = [];
  const seen = new Set<string>();
  for (let i = start; i < input.videos.length && keep.length < target; i += 1) {
    const video = input.videos[i];
    if (!video) continue;
    const mediaId = watchMediaIdentity(video);
    if (seen.has(mediaId)) continue;
    seen.add(mediaId);
    keep.push({
      mediaId,
      videoId: video.id,
      src: (video.src ?? "").trim(),
    });
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

  return { target, keepIds, downloadIds, evictIds, hits };
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
  const { manifest } = await readManifest(port);
  const hits: WatchCacheHit[] = [];
  for (const video of input.videos) {
    const mediaId = watchMediaIdentity(video);
    const entry = manifest.entries.find((row) => row.mediaId === mediaId);
    if (!entry || !(await entryStillOnDisk(port, entry))) continue;
    hits.push({ videoId: video.id, mediaId, uri: entry.uri });
  }
  return hits;
}

export async function syncAndroidWatchRollingCache(input: {
  platform?: string | null;
  videos: WatchVideo[];
  activeIndex: number;
  port?: WatchMediaCachePort;
  onResolved?: (videoId: string, localUri: string) => void;
}): Promise<WatchCacheSyncResult> {
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

  const mediaDir = `${dir}${ANDROID_WATCH_CACHE_DIR_NAME}`;
  await port.ensureDir(mediaDir);

  const nextEntries: WatchCacheEntry[] = [];
  const hits: string[] = [];
  const misses: string[] = [];
  const evicted: string[] = [];

  for (const entry of manifest.entries) {
    if (plan.evictIds.includes(entry.mediaId)) {
      evicted.push(entry.mediaId);
      try {
        await port.delete(entry.uri);
      } catch {
        // Best-effort eviction.
      }
      continue;
    }
    if (await entryStillOnDisk(port, entry)) {
      nextEntries.push(entry);
    }
  }

  const keepSet = new Set(plan.keepIds);
  for (const video of input.videos) {
    const mediaId = watchMediaIdentity(video);
    if (!keepSet.has(mediaId)) continue;
    const existing = nextEntries.find((row) => row.mediaId === mediaId);
    if (existing) {
      hits.push(mediaId);
      if (!isLocalWatchPlaybackUri(video.src)) {
        input.onResolved?.(video.id, existing.uri);
      }
      continue;
    }
    const src = (video.src ?? "").trim();
    if (!src || isLocalWatchPlaybackUri(src)) {
      misses.push(mediaId);
      continue;
    }
    const destUri = `${mediaDir}${watchCacheFileName(mediaId)}`;
    const downloaded = await downloadWatchCacheFile(port, mediaId, src, destUri);
    if (!downloaded) {
      misses.push(mediaId);
      continue;
    }
    const bytes = await port.size(downloaded);
    const entry: WatchCacheEntry = {
      mediaId,
      videoId: video.id,
      uri: downloaded,
      bytes,
      cachedAt: Date.now(),
    };
    if (!isValidWatchCacheEntry(entry)) {
      misses.push(mediaId);
      continue;
    }
    nextEntries.push(entry);
    hits.push(mediaId);
    input.onResolved?.(video.id, downloaded);
  }

  const nextManifest: WatchCacheManifest = {
    target: ANDROID_WATCH_CACHE_TARGET,
    entries: nextEntries.slice(0, ANDROID_WATCH_CACHE_TARGET),
  };
  await writeManifest(port, manifestUri, nextManifest);

  const result: WatchCacheSyncResult = {
    target: ANDROID_WATCH_CACHE_TARGET,
    cachedIds: nextManifest.entries.map((entry) => entry.mediaId),
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
      }
      const downloaded = await port.download(src, destUri);
      if (downloaded.status < 200 || downloaded.status >= 300) return null;
      if (!isLocalWatchPlaybackUri(downloaded.uri)) return null;
      return downloaded.uri;
    } catch {
      return null;
    } finally {
      inflightDownloads.delete(mediaId);
    }
  })();
  inflightDownloads.set(mediaId, pending);
  return pending;
}

let defaultWatchMediaCachePort: WatchMediaCachePort | null = null;

export function createFileSystemWatchMediaCachePort(): WatchMediaCachePort {
  // Lazy so unit tests that inject a memory port never touch native FS.
  const FileSystem = require("expo-file-system/legacy") as {
    cacheDirectory: string | null;
    getInfoAsync: (
      uri: string
    ) => Promise<{ exists: boolean; size?: number }>;
    downloadAsync: (
      sourceUrl: string,
      destUri: string
    ) => Promise<{ uri: string; status: number }>;
    deleteAsync: (uri: string, options?: { idempotent?: boolean }) => Promise<void>;
    makeDirectoryAsync: (
      uri: string,
      options?: { intermediates?: boolean }
    ) => Promise<void>;
    readAsStringAsync: (uri: string) => Promise<string>;
    writeAsStringAsync: (uri: string, text: string) => Promise<void>;
  };
  return {
    cacheDirectory: () => FileSystem.cacheDirectory,
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

export function __setWatchMediaCachePortForTests(
  port: WatchMediaCachePort | null
): void {
  defaultWatchMediaCachePort = port;
}

export function createMemoryWatchMediaCachePort(
  root = "file:///cache/"
): WatchMediaCachePort & { files: Map<string, string>; downloads: string[] } {
  const files = new Map<string, string>();
  const downloads: string[] = [];
  return {
    files,
    downloads,
    cacheDirectory: () => root,
    exists: async (uri) => files.has(uri),
    size: async (uri) => files.get(uri)?.length ?? 0,
    download: async (sourceUrl, destUri) => {
      downloads.push(sourceUrl);
      files.set(destUri, sourceUrl);
      return { uri: destUri, status: 200 };
    },
    delete: async (uri) => {
      files.delete(uri);
    },
    ensureDir: async () => undefined,
    readText: async (uri) => files.get(uri) ?? null,
    writeText: async (uri, text) => {
      files.set(uri, text);
    },
  };
}
