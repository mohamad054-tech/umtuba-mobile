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
export const WATCH_OFFLINE_DURABLE_ROOT = "umtuba-watch-retained/";
export const WATCH_OFFLINE_MANIFEST_FILE = "manifest.json";
export const WATCH_OFFLINE_VIDEOS_DIR = "videos/";
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

export function joinWatchFsUri(dir: string, ...segments: string[]): string {
  let out = dir.endsWith("/") ? dir : `${dir}/`;
  for (let i = 0; i < segments.length; i += 1) {
    const raw = segments[i].replace(/^\/+/, "");
    if (!raw) continue;
    const isLast = i === segments.length - 1;
    out += !isLast && !raw.endsWith("/") ? `${raw}/` : raw;
  }
  return out;
}

function fnv1a32(input: string, seed = 0x811c9dc5): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** Path-safe account folder id. Hashed so email/uid never appear in the path. */
export function hashWatchOfflineAccountId(accountId: string): string {
  const a = fnv1a32(accountId);
  const b = fnv1a32(accountId, 0x811c9dc5 ^ 0x00abcdef);
  return `${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`;
}

export function watchOfflineAccountDirName(
  accountId: string | null | undefined
): string | null {
  const safe = sanitizeWatchOfflineAccountId(accountId);
  if (!safe) return null;
  return `acct-${hashWatchOfflineAccountId(safe)}`;
}

export function watchOfflineManifestFileName(
  accountId: string | null | undefined
): string | null {
  if (!sanitizeWatchOfflineAccountId(accountId)) return null;
  return WATCH_OFFLINE_MANIFEST_FILE;
}

export function watchOfflineDurableAccountDirUri(
  documentDirectory: string | null | undefined,
  accountId: string | null | undefined
): string | null {
  if (!documentDirectory) return null;
  const folder = watchOfflineAccountDirName(accountId);
  if (!folder) return null;
  return joinWatchFsUri(documentDirectory, WATCH_OFFLINE_DURABLE_ROOT, folder);
}

export function watchOfflineDurableVideosDirUri(
  documentDirectory: string | null | undefined,
  accountId: string | null | undefined
): string | null {
  const accountDir = watchOfflineDurableAccountDirUri(
    documentDirectory,
    accountId
  );
  if (!accountDir) return null;
  return joinWatchFsUri(accountDir, WATCH_OFFLINE_VIDEOS_DIR);
}

export function watchOfflineDurableVideoUri(
  documentDirectory: string | null | undefined,
  accountId: string | null | undefined,
  mediaId: string
): string | null {
  const videosDir = watchOfflineDurableVideosDirUri(documentDirectory, accountId);
  if (!videosDir) return null;
  return joinWatchFsUri(videosDir, durableWatchVideoFileName(mediaId));
}

function durableWatchVideoFileName(mediaId: string): string {
  const safe = mediaId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${safe}.mp4`;
}

export function watchOfflineManifestUri(
  documentDirectory: string | null | undefined,
  accountId: string | null | undefined
): string | null {
  const accountDir = watchOfflineDurableAccountDirUri(
    documentDirectory,
    accountId
  );
  if (!accountDir) return null;
  return joinWatchFsUri(accountDir, WATCH_OFFLINE_MANIFEST_FILE);
}

export function watchOfflineManifestBackupUri(
  documentDirectory: string | null | undefined,
  accountId: string | null | undefined
): string | null {
  const dest = watchOfflineManifestUri(documentDirectory, accountId);
  return dest ? `${dest}.bak` : null;
}

export function watchOfflineManifestTempUri(
  documentDirectory: string | null | undefined,
  accountId: string | null | undefined
): string | null {
  const dest = watchOfflineManifestUri(documentDirectory, accountId);
  return dest ? `${dest}.tmp` : null;
}

export function isWatchOfflineDurableUri(
  uri: string | null | undefined,
  documentDirectory: string | null | undefined
): boolean {
  if (!uri || !documentDirectory) return false;
  const root = joinWatchFsUri(documentDirectory, WATCH_OFFLINE_DURABLE_ROOT);
  return uri.startsWith(root);
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

export function tryParseWatchOfflineManifest(
  raw: string | null | undefined,
  expectedAccountId?: string | null
): WatchOfflineManifest | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WatchOfflineManifest;
    if (!parsed || !Array.isArray(parsed.entries)) return null;
    const accountId = (parsed.accountId ?? "").trim();
    if (!accountId) return null;
    if (
      expectedAccountId &&
      sanitizeWatchOfflineAccountId(accountId) !==
        sanitizeWatchOfflineAccountId(expectedAccountId)
    ) {
      return null;
    }
    return {
      version: WATCH_OFFLINE_MANIFEST_VERSION,
      accountId,
      target: WATCH_OFFLINE_MANIFEST_TARGET,
      entries: parsed.entries.filter(isValidWatchOfflineManifestEntry),
    };
  } catch {
    return null;
  }
}

export function parseWatchOfflineManifest(
  raw: string | null | undefined,
  expectedAccountId?: string | null
): WatchOfflineManifest {
  return (
    tryParseWatchOfflineManifest(raw, expectedAccountId) ??
    emptyWatchOfflineManifest(expectedAccountId ?? "")
  );
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

async function existsWithSize(
  port: WatchMediaCachePort,
  uri: string
): Promise<boolean> {
  try {
    if (!(await port.exists(uri))) return false;
    return (await port.size(uri)) > 0;
  } catch {
    return false;
  }
}

async function deleteQuietly(
  port: WatchMediaCachePort,
  uri: string | null | undefined
): Promise<void> {
  if (!uri) return;
  try {
    await port.delete(uri);
  } catch {
    // Best-effort cleanup.
  }
}

export async function copyWatchVideoToDurableStore(input: {
  accountId: string;
  sourceUri: string;
  mediaId: string;
  port: WatchMediaCachePort;
}): Promise<string | null> {
  const documentDirectory = input.port.documentDirectory();
  const dest = watchOfflineDurableVideoUri(
    documentDirectory,
    input.accountId,
    input.mediaId
  );
  const videosDir = watchOfflineDurableVideosDirUri(
    documentDirectory,
    input.accountId
  );
  if (!dest || !videosDir) return null;
  await input.port.ensureDir(videosDir);
  if (await existsWithSize(input.port, dest)) return dest;
  if (!(await existsWithSize(input.port, input.sourceUri))) return null;
  if (input.sourceUri === dest) return dest;
  const temp = `${dest}.tmp`;
  await deleteQuietly(input.port, temp);
  await input.port.copy(input.sourceUri, temp);
  if (!(await existsWithSize(input.port, temp))) {
    await deleteQuietly(input.port, temp);
    return null;
  }
  await deleteQuietly(input.port, dest);
  await input.port.move(temp, dest);
  if (!(await existsWithSize(input.port, dest))) return null;
  return dest;
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
  const documentDirectory = port.documentDirectory();
  const dest = watchOfflineManifestUri(documentDirectory, accountId);
  const temp = watchOfflineManifestTempUri(documentDirectory, accountId);
  const backup = watchOfflineManifestBackupUri(documentDirectory, accountId);
  const accountDir = watchOfflineDurableAccountDirUri(
    documentDirectory,
    accountId
  );
  if (!dest || !temp || !backup || !accountDir) return false;
  await port.ensureDir(accountDir);
  const payload = JSON.stringify({
    ...input.manifest,
    version: WATCH_OFFLINE_MANIFEST_VERSION,
    accountId,
    target: WATCH_OFFLINE_MANIFEST_TARGET,
  });
  await port.writeText(temp, payload);
  if (!(await existsWithSize(port, temp))) return false;
  if (await port.exists(dest)) {
    await deleteQuietly(port, backup);
    await port.move(dest, backup);
  }
  await port.move(temp, dest);
  const verified = tryParseWatchOfflineManifest(
    await port.readText(dest),
    accountId
  );
  if (!verified) {
    if (await existsWithSize(port, backup)) {
      await deleteQuietly(port, dest);
      await port.move(backup, dest);
    }
    return false;
  }
  await deleteQuietly(port, backup);
  await deleteQuietly(port, temp);
  return true;
}

async function readRecoverableManifest(
  port: WatchMediaCachePort,
  accountId: string
): Promise<WatchOfflineManifest | null> {
  const documentDirectory = port.documentDirectory();
  const dest = watchOfflineManifestUri(documentDirectory, accountId);
  const backup = watchOfflineManifestBackupUri(documentDirectory, accountId);
  const temp = watchOfflineManifestTempUri(documentDirectory, accountId);
  if (!dest || !backup || !temp) return null;

  const primary = tryParseWatchOfflineManifest(
    await port.readText(dest),
    accountId
  );
  if (primary) return primary;

  const fromBackup = tryParseWatchOfflineManifest(
    await port.readText(backup),
    accountId
  );
  if (fromBackup) {
    await persistWatchOfflineManifest({
      accountId,
      manifest: fromBackup,
      port,
    });
    return fromBackup;
  }

  const fromTemp = tryParseWatchOfflineManifest(
    await port.readText(temp),
    accountId
  );
  if (fromTemp) {
    await persistWatchOfflineManifest({
      accountId,
      manifest: fromTemp,
      port,
    });
    return fromTemp;
  }
  return null;
}

async function reconcileDurableManifestEntries(input: {
  accountId: string;
  port: WatchMediaCachePort;
  manifest: WatchOfflineManifest;
}): Promise<{ manifest: WatchOfflineManifest; changed: boolean }> {
  const kept: WatchOfflineManifestEntry[] = [];
  let changed = false;
  for (const entry of input.manifest.entries) {
    if (!isValidWatchOfflineManifestEntry(entry)) {
      changed = true;
      continue;
    }
    const durable = watchOfflineDurableVideoUri(
      input.port.documentDirectory(),
      input.accountId,
      entry.mediaId
    );
    if (durable && (await existsWithSize(input.port, durable))) {
      if (entry.localUri !== durable) {
        kept.push({ ...entry, localUri: durable });
        changed = true;
      } else {
        kept.push(entry);
      }
      continue;
    }
    const copied = await copyWatchVideoToDurableStore({
      accountId: input.accountId,
      sourceUri: entry.localUri,
      mediaId: entry.mediaId,
      port: input.port,
    });
    if (copied) {
      kept.push({ ...entry, localUri: copied });
      changed = true;
      continue;
    }
    changed = true;
  }
  return {
    manifest: {
      ...input.manifest,
      accountId: input.accountId,
      entries: kept,
    },
    changed,
  };
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
  const parsed = (await readRecoverableManifest(port, accountId)) ?? empty;
  if (input.verifyFiles === false) return parsed;

  const reconciled = await reconcileDurableManifestEntries({
    accountId,
    port,
    manifest: parsed,
  });
  if (reconciled.changed) {
    await persistWatchOfflineManifest({
      accountId,
      manifest: reconciled.manifest,
      port,
    });
  }
  return reconciled.manifest;
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
  const durableUri = await copyWatchVideoToDurableStore({
    accountId,
    sourceUri: input.localUri,
    mediaId: watchMediaIdentity(input.video),
    port,
  });
  if (!durableUri) return { manifest: current, evicted: [] };
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
    localUri: durableUri,
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
    const durableGone = watchOfflineDurableVideoUri(
      port.documentDirectory(),
      accountId,
      gone.mediaId
    );
    await deleteQuietly(port, durableGone ?? gone.localUri);
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
    await deleteQuietly(port, entry.localUri);
    await deleteQuietly(
      port,
      watchOfflineDurableVideoUri(
        port.documentDirectory(),
        accountId,
        entry.mediaId
      )
    );
  }
  const documentDirectory = port.documentDirectory();
  await deleteQuietly(
    port,
    watchOfflineManifestUri(documentDirectory, accountId)
  );
  await deleteQuietly(
    port,
    watchOfflineManifestBackupUri(documentDirectory, accountId)
  );
  await deleteQuietly(
    port,
    watchOfflineManifestTempUri(documentDirectory, accountId)
  );
  const accountDir = watchOfflineDurableAccountDirUri(
    documentDirectory,
    accountId
  );
  if (accountDir) {
    await deleteQuietly(
      port,
      accountDir.endsWith("/") ? accountDir : `${accountDir}/`
    );
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
