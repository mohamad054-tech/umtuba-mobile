import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Share } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createVideoSignedUrl } from "@/src/lib/feed/watchFeed";
import { recordPostShare } from "@/src/lib/social/interactions";
import { getOrCreateDeviceViewerKey } from "@/src/lib/social/viewerKey";

export const PUBLIC_WEB_ORIGIN = "https://umtuba.com";

export const WATCH_SHARE_CHOICES = [
  { mode: "link", key: "watch.shareVideoLink" },
  { mode: "file", key: "watch.shareVideoFile" },
] as const;

export type WatchShareMode = (typeof WATCH_SHARE_CHOICES)[number]["mode"];

export type ShareAttempt = {
  attemptId: string;
  postId: number;
};

export type ShareWatchPostResult =
  | { ok: true; shared: boolean; shares: number; url: string; mode: WatchShareMode }
  | { ok: false; code: "media_unavailable" | "share_failed"; message: string };

export type ShareLinkPort = {
  share: (payload: {
    title: string;
    message: string;
    url: string;
  }) => Promise<{ dismissed: boolean }>;
};

export type ShareFilePort = {
  isAvailable: () => Promise<boolean>;
  shareFile: (payload: {
    fileUri: string;
    mimeType: string;
    dialogTitle: string;
  }) => Promise<{ dismissed: boolean }>;
};

export type ShareDownloadPort = {
  cacheDirectory: () => string | null;
  download: (
    sourceUrl: string,
    destUri: string
  ) => Promise<{ uri: string; status: number }>;
  delete: (uri: string) => Promise<void>;
};

const SIGNED_OR_SECRET_RE =
  /(?:[?&](?:token|signature|sig|X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token|apikey|api_key|service_role)=|\/storage\/v1\/object\/sign\/|service_role|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.)/i;

function newShareAttemptId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildMobilePostShareUrl(postId: number): string | null {
  if (!Number.isInteger(postId) || postId <= 0) return null;
  return `${PUBLIC_WEB_ORIGIN}/watch?post=${postId}`;
}

export function isCanonicalMobilePostShareUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== PUBLIC_WEB_ORIGIN) return false;
    if (parsed.pathname !== "/watch") return false;
    if (parsed.username || parsed.password) return false;
    const post = parsed.searchParams.get("post");
    if (!post || !/^\d+$/.test(post) || Number(post) <= 0) return false;
    for (const key of parsed.searchParams.keys()) {
      if (key !== "post") return false;
    }
    return !urlLeaksCredentialsOrSignedParams(url);
  } catch {
    return false;
  }
}

export function urlLeaksCredentialsOrSignedParams(url: string): boolean {
  return SIGNED_OR_SECRET_RE.test(url);
}

export function isLocalOrCreateAssetUri(uri: string): boolean {
  const value = uri.trim().toLowerCase();
  return (
    value.startsWith("file:") ||
    value.startsWith("content:") ||
    value.startsWith("ph://") ||
    value.startsWith("ph-upload://") ||
    value.startsWith("assets-library:") ||
    value.startsWith("blob:") ||
    value.startsWith("data:")
  );
}

export function isHttpSignedOrStorageUrl(url: string): boolean {
  const value = url.trim();
  if (!/^https?:\/\//i.test(value)) return false;
  return (
    urlLeaksCredentialsOrSignedParams(value) ||
    /\/storage\/v1\/object\//i.test(value)
  );
}

export function isSafeShareFileUri(uri: string): boolean {
  const value = uri.trim();
  if (!value) return false;
  if (isHttpSignedOrStorageUrl(value)) return false;
  if (urlLeaksCredentialsOrSignedParams(value)) return false;
  return value.startsWith("file:") || value.startsWith("content:");
}

export function createShareAttempt(postId: number): ShareAttempt | null {
  if (!Number.isInteger(postId) || postId <= 0) return null;
  return { attemptId: newShareAttemptId(), postId };
}

/** Frozen identity: Watch swipe must not retarget a pending share. */
export function resolveBoundSharePostId(
  attempt: ShareAttempt,
  visiblePostId?: number | null
): number {
  void visiblePostId;
  return attempt.postId;
}

export function shareIdentitySwitched(
  attempt: ShareAttempt,
  usedPostId: number
): boolean {
  return usedPostId !== attempt.postId;
}

export function readOptimizedPlaybackPath(pipeline: unknown): string | null {
  if (!pipeline || typeof pipeline !== "object" || Array.isArray(pipeline)) {
    return null;
  }
  const raw = (pipeline as { ugc_transcode?: unknown }).ugc_transcode;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const path = (raw as { optimized_path?: unknown }).optimized_path;
  return typeof path === "string" && path.trim() ? path.trim() : null;
}

function isSafeStoragePath(path: string): boolean {
  const value = path.trim();
  if (!value) return false;
  if (/^https?:\/\//i.test(value)) return false;
  if (isLocalOrCreateAssetUri(value)) return false;
  if (value.includes("..") || value.includes("\\")) return false;
  return true;
}

export function resolveShareableStoragePath(input: {
  videoPath?: string | null;
  videoUrl?: string | null;
  mediaPipeline?: unknown;
  localUri?: string | null;
}):
  | { ok: true; storagePath: string; preferred: "optimized" | "original" }
  | { ok: false } {
  if (input.localUri && isLocalOrCreateAssetUri(input.localUri)) {
    // Create/upload leftovers are never a share source.
  }
  const optimized = readOptimizedPlaybackPath(input.mediaPipeline);
  if (optimized && isSafeStoragePath(optimized)) {
    return { ok: true, storagePath: optimized, preferred: "optimized" };
  }
  const path = (input.videoPath || "").trim();
  if (path && isSafeStoragePath(path)) {
    return { ok: true, storagePath: path, preferred: "original" };
  }
  return { ok: false };
}

export function extensionForSharePath(path: string): string {
  const cleaned = path.split("?")[0]?.toLowerCase() || "";
  if (cleaned.endsWith(".webm")) return "webm";
  if (cleaned.endsWith(".mov")) return "mov";
  if (cleaned.endsWith(".m4v")) return "m4v";
  return "mp4";
}

export function mimeTypeForSharePath(path: string): string {
  switch (extensionForSharePath(path)) {
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
    default:
      return "video/mp4";
  }
}

export function tempShareFileName(attemptId: string, path: string): string {
  const safeId = attemptId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 36) || "share";
  return `umtuba-share-${safeId}.${extensionForSharePath(path)}`;
}

function defaultShareFailed(message?: string): ShareWatchPostResult {
  return {
    ok: false,
    code: "share_failed",
    message: message || "Share failed",
  };
}

function isUserCancel(message: string): boolean {
  return /user.?cancel|dismiss|aborted/i.test(message);
}

export const defaultShareLinkPort: ShareLinkPort = {
  async share(payload) {
    const result = await Share.share(
      {
        title: payload.title,
        message: payload.message,
        url: payload.url,
      },
      { dialogTitle: payload.title, subject: payload.title }
    );
    const dismissed =
      "dismissedAction" in Share && result.action === Share.dismissedAction;
    return { dismissed };
  },
};

export const defaultShareFilePort: ShareFilePort = {
  isAvailable: () => Sharing.isAvailableAsync(),
  async shareFile(payload) {
    await Sharing.shareAsync(payload.fileUri, {
      mimeType: payload.mimeType,
      UTI: "public.movie",
      dialogTitle: payload.dialogTitle,
    });
    return { dismissed: false };
  },
};

export const defaultShareDownloadPort: ShareDownloadPort = {
  cacheDirectory: () => FileSystem.cacheDirectory,
  download: (sourceUrl, destUri) => FileSystem.downloadAsync(sourceUrl, destUri),
  delete: (uri) => FileSystem.deleteAsync(uri, { idempotent: true }),
};

type ShareLabels = {
  mediaUnavailable?: string;
  shareFailed?: string;
};

async function recordShareIfNeeded(
  supabase: SupabaseClient,
  postId: number,
  url: string,
  mode: WatchShareMode
): Promise<ShareWatchPostResult> {
  const viewerKey = await getOrCreateDeviceViewerKey();
  const recorded = await recordPostShare(supabase, postId, viewerKey);
  if (!recorded.ok) {
    return { ok: true, shared: true, shares: 0, url, mode };
  }
  return { ok: true, shared: true, shares: recorded.shares, url, mode };
}

export async function shareWatchPostLink(
  supabase: SupabaseClient,
  input: {
    attempt: ShareAttempt;
    title?: string;
    text?: string;
    visiblePostId?: number | null;
    labels?: ShareLabels;
    linkPort?: ShareLinkPort;
  }
): Promise<ShareWatchPostResult> {
  const postId = resolveBoundSharePostId(input.attempt, input.visiblePostId);
  if (shareIdentitySwitched(input.attempt, postId)) {
    return defaultShareFailed(input.labels?.shareFailed);
  }
  const url = buildMobilePostShareUrl(postId);
  if (!url || !isCanonicalMobilePostShareUrl(url)) {
    return defaultShareFailed(input.labels?.shareFailed);
  }

  const title = input.title?.trim() || "UMTUBA";
  const text = input.text?.trim() || "Check out this post on UMTUBA";
  const message = `${text}\n${url}`;
  const port = input.linkPort ?? defaultShareLinkPort;

  try {
    const result = await port.share({ title, message, url });
    if (result.dismissed) {
      return { ok: true, shared: false, shares: 0, url, mode: "link" };
    }
  } catch (err) {
    const messageText =
      err instanceof Error ? err.message : input.labels?.shareFailed || "Share failed";
    if (isUserCancel(messageText)) {
      return { ok: true, shared: false, shares: 0, url, mode: "link" };
    }
    return defaultShareFailed(messageText);
  }

  return recordShareIfNeeded(supabase, postId, url, "link");
}

type ShareablePostRow = {
  id: number;
  post_type: string | null;
  media_status: string | null;
  video_path: string | null;
  video_url: string | null;
  media_pipeline: unknown;
};

async function loadShareablePost(
  supabase: SupabaseClient,
  postId: number
): Promise<ShareablePostRow | null> {
  const full = await supabase
    .from("posts")
    .select("id, post_type, media_status, video_path, video_url, media_pipeline")
    .eq("id", postId)
    .maybeSingle();

  if (!full.error && full.data) {
    return full.data as ShareablePostRow;
  }

  const missingColumn =
    (full.error as { code?: string } | null)?.code === "PGRST204" ||
    /media_pipeline|schema cache/i.test(full.error?.message || "");
  if (!missingColumn) return null;

  const legacy = await supabase
    .from("posts")
    .select("id, post_type, media_status, video_path, video_url")
    .eq("id", postId)
    .maybeSingle();
  if (legacy.error || !legacy.data) return null;
  return { ...(legacy.data as Omit<ShareablePostRow, "media_pipeline">), media_pipeline: null };
}

function postIsShareable(row: ShareablePostRow): boolean {
  return row.post_type === "video" && row.media_status === "ready";
}

export async function shareWatchPostFile(
  supabase: SupabaseClient,
  input: {
    attempt: ShareAttempt;
    title?: string;
    visiblePostId?: number | null;
    localUri?: string | null;
    labels?: ShareLabels;
    filePort?: ShareFilePort;
    downloadPort?: ShareDownloadPort;
  }
): Promise<ShareWatchPostResult> {
  const postId = resolveBoundSharePostId(input.attempt, input.visiblePostId);
  const url = buildMobilePostShareUrl(postId);
  const unavailable = {
    ok: false as const,
    code: "media_unavailable" as const,
    message: input.labels?.mediaUnavailable || "Media unavailable",
  };
  const failed = (message?: string): ShareWatchPostResult => ({
    ok: false,
    code: "share_failed",
    message: message || input.labels?.shareFailed || "Share failed",
  });

  if (!url || shareIdentitySwitched(input.attempt, postId)) {
    return failed();
  }

  const row = await loadShareablePost(supabase, postId);
  if (!row || !postIsShareable(row)) {
    return unavailable;
  }

  const resolved = resolveShareableStoragePath({
    videoPath: row.video_path,
    videoUrl: row.video_url,
    mediaPipeline: row.media_pipeline,
    localUri: input.localUri,
  });
  if (!resolved.ok) {
    return unavailable;
  }

  const signed = await createVideoSignedUrl(supabase, resolved.storagePath);
  if (!signed) {
    return unavailable;
  }

  const filePort = input.filePort ?? defaultShareFilePort;
  const downloadPort = input.downloadPort ?? defaultShareDownloadPort;
  if (!(await filePort.isAvailable())) {
    return failed();
  }

  const cacheDir = downloadPort.cacheDirectory();
  if (!cacheDir) {
    return failed();
  }

  const destUri = `${cacheDir}${tempShareFileName(input.attempt.attemptId, resolved.storagePath)}`;
  let downloadedUri: string | null = null;

  try {
    const downloaded = await downloadPort.download(signed, destUri);
    downloadedUri = downloaded.uri;
    if (downloaded.status < 200 || downloaded.status >= 300) {
      return failed();
    }
    if (!isSafeShareFileUri(downloaded.uri) || downloaded.uri === signed) {
      return failed();
    }

    try {
      const result = await filePort.shareFile({
        fileUri: downloaded.uri,
        mimeType: mimeTypeForSharePath(resolved.storagePath),
        dialogTitle: input.title?.trim() || "UMTUBA",
      });
      if (result.dismissed) {
        return { ok: true, shared: false, shares: 0, url, mode: "file" };
      }
    } catch (err) {
      const messageText =
        err instanceof Error ? err.message : input.labels?.shareFailed || "Share failed";
      if (isUserCancel(messageText)) {
        return { ok: true, shared: false, shares: 0, url, mode: "file" };
      }
      return failed(messageText);
    }

    return recordShareIfNeeded(supabase, postId, url, "file");
  } finally {
    if (downloadedUri) {
      try {
        await downloadPort.delete(downloadedUri);
      } catch {
        // Temp cleanup is best-effort; never leave credentials in the share payload.
      }
    }
  }
}

/** Link-only entry used by older callers. Watch now chooses a mode first. */
export async function shareWatchPost(
  supabase: SupabaseClient,
  input: { postId: number; title?: string; text?: string }
): Promise<ShareWatchPostResult> {
  const attempt = createShareAttempt(input.postId);
  if (!attempt) {
    return defaultShareFailed("Unable to share this post.");
  }
  return shareWatchPostLink(supabase, {
    attempt,
    title: input.title,
    text: input.text,
  });
}
