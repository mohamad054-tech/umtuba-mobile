import type { SupabaseClient } from "@supabase/supabase-js";

import {
  POST_VIDEOS_BUCKET,
  VIDEO_SIGNED_URL_TTL_SECONDS,
} from "@/src/contracts/video";
import {
  WATCH_FEED_PAGE_SIZE,
  type WatchFeedCursor,
  type WatchFeedPage,
  type WatchVideo,
} from "@/src/contracts/watch";
import { watchSignedUrlCache } from "@/src/lib/feed/signedUrlCache";
import {
  isLegacyHttpPlaybackUrl,
  normalizeVideoStoragePath,
} from "@/src/lib/feed/videoStoragePath";
import {
  loadViewerInteractionState,
  viewerLikedFromState,
} from "@/src/lib/social/interactions";
import { resolveAuthoritativePublishedAt } from "@/src/lib/time/publishedAt";

export type VideoPostRow = {
  id: number;
  user_id: string | null;
  content: string;
  post_type: string;
  author_name: string;
  author_username: string;
  author_avatar: string;
  image_url: string | null;
  video_url: string | null;
  video_path: string | null;
  likes: number;
  comments: number;
  shares: number;
  saves: number | null;
  views: number | null;
  created_at: string;
  media_pipeline?: unknown;
  media_duration_ms?: number | null;
};

const postColumns = `
  id,
  user_id,
  content,
  post_type,
  author_name,
  author_username,
  author_avatar,
  image_url,
  video_url,
  video_path,
  likes,
  comments,
  shares,
  saves,
  views,
  created_at,
  media_pipeline,
  media_duration_ms
`;

export type MappedPlaybackRow = {
  row: VideoPostRow;
  playbackUrl: string;
  likedByMe: boolean;
  savedByMe: boolean;
  videoPath?: string | null;
};

/** Pure mapper — unit-tested without Supabase. */
export function mapRowToWatchVideo(input: MappedPlaybackRow): WatchVideo {
  const { row, playbackUrl, likedByMe, savedByMe } = input;
  const username = row.author_username?.startsWith("@")
    ? row.author_username
    : `@${row.author_username || "user"}`;
  const caption = (row.content || "").trim();
  const normalizedPath = normalizeVideoStoragePath(
    input.videoPath ?? row.video_path
  );

  return {
    id: `post-${row.id}`,
    postId: row.id,
    videoPath: normalizedPath.ok ? normalizedPath.path : null,
    src: playbackUrl,
    poster: row.image_url ?? undefined,
    title: caption.slice(0, 80) || "UMTUBA",
    caption,
    location: { city: "", country: "" },
    music: "",
    aiSummary: "",
    translation: "",
    author: {
      id: row.user_id,
      name: row.author_name || username,
      username,
      avatar: row.author_avatar || "U",
    },
    stats: {
      likes: row.likes ?? 0,
      comments: row.comments ?? 0,
      shares: row.shares ?? 0,
      saves: row.saves ?? 0,
      views: row.views ?? 0,
    },
    likedByMe: viewerLikedFromState(likedByMe),
    savedByMe: savedByMe === true,
    source: "supabase",
    publishedAt: resolveAuthoritativePublishedAt({
      created_at: row.created_at,
    }),
    durationMs:
      typeof row.media_duration_ms === "number" && row.media_duration_ms >= 0
        ? row.media_duration_ms
        : null,
    mediaPipeline: row.media_pipeline ?? null,
  };
}

export async function createVideoSignedUrl(
  supabase: SupabaseClient,
  path: string
): Promise<string | null> {
  const normalized = normalizeVideoStoragePath(path);
  if (!normalized.ok) return null;

  const cached = watchSignedUrlCache.peek(normalized.path);
  if (cached) return cached;

  const signOnce = async () =>
    supabase.storage
      .from(POST_VIDEOS_BUCKET)
      .createSignedUrl(normalized.path, VIDEO_SIGNED_URL_TTL_SECONDS);

  let { data, error } = await signOnce();
  if (
    (!data?.signedUrl || error) &&
    isTransientStorageSignFailure(error)
  ) {
    ({ data, error } = await signOnce());
  }

  if (error || !data?.signedUrl) {
    console.error("Unable to sign video URL:", normalized.path, error);
    return null;
  }

  watchSignedUrlCache.set(normalized.path, data.signedUrl);
  return data.signedUrl;
}

function isTransientStorageSignFailure(error: unknown): boolean {
  if (!error) return false;
  const raw =
    typeof error === "string"
      ? error
      : typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status: unknown }).status)
      : null;
  return (
    status === 403 ||
    status === 401 ||
    /\b(403|401|forbidden|expired|signature|unauthorized)\b/i.test(raw)
  );
}

function initialPlaybackSrc(row: VideoPostRow): {
  path: string | null;
  src: string;
  include: boolean;
} {
  const normalized = normalizeVideoStoragePath(row.video_path);
  if (normalized.ok) {
    return {
      path: normalized.path,
      src: watchSignedUrlCache.peek(normalized.path) ?? "",
      include: true,
    };
  }
  const legacy = row.video_url?.trim() ?? "";
  if (isLegacyHttpPlaybackUrl(legacy)) {
    return { path: null, src: legacy, include: true };
  }
  return { path: null, src: "", include: false };
}

export type FetchWatchFeedInput = {
  cursor?: WatchFeedCursor | null;
  focusPostId?: number | null;
  limit?: number;
};

/** Put the focused post first so Watch `activeIndex` 0 surfaces it. */
export function promoteFocusedWatchRow<T extends { id: number }>(
  rows: T[],
  focused: T | null | undefined,
  focusPostId: number | null | undefined
): T[] {
  if (
    focusPostId == null ||
    !Number.isInteger(focusPostId) ||
    focusPostId <= 0
  ) {
    return rows;
  }
  const target = focused ?? rows.find((row) => row.id === focusPostId);
  if (!target || target.id !== focusPostId) return rows;
  return [target, ...rows.filter((row) => row.id !== focusPostId)];
}

export async function fetchWatchFeedPage(
  supabase: SupabaseClient,
  input: FetchWatchFeedInput = {}
): Promise<WatchFeedPage> {
  const limit = Math.min(
    Math.max(input.limit ?? WATCH_FEED_PAGE_SIZE, 1),
    30
  );
  const cursor = input.cursor ?? null;

  let query = supabase
    .from("posts")
    .select(postColumns)
    .eq("post_type", "video")
    .eq("media_status", "ready")
    .not("video_path", "is", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.or(
      `and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id}),created_at.lt.${cursor.createdAt}`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("Unable to load watch videos:", error);
    throw new Error("Unable to load the Watch feed. Please try again.");
  }

  let rows = (data ?? []) as VideoPostRow[];

  if (!cursor && input.focusPostId && input.focusPostId > 0) {
    const focusedInPage =
      rows.find((row) => row.id === input.focusPostId) ?? null;
    let focused = focusedInPage;
    if (!focused) {
      const { data: fetched } = await supabase
        .from("posts")
        .select(postColumns)
        .eq("id", input.focusPostId)
        .eq("post_type", "video")
        .eq("media_status", "ready")
        .not("video_path", "is", null)
        .maybeSingle();
      focused = (fetched as VideoPostRow | null) ?? null;
    }
    rows = promoteFocusedWatchRow(rows, focused, input.focusPostId);
  }

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const viewerState = await loadViewerInteractionState(
    supabase,
    user?.id,
    pageRows.map((row) => row.id)
  );

  const videos: WatchVideo[] = [];

  for (const row of pageRows) {
    const initial = initialPlaybackSrc(row);
    if (!initial.include) continue;
    const state = viewerState.get(row.id);
    videos.push(
      mapRowToWatchVideo({
        row,
        playbackUrl: initial.src,
        videoPath: initial.path,
        likedByMe: viewerLikedFromState(state?.likedByMe),
        savedByMe: state?.savedByMe === true,
      })
    );
  }

  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor: WatchFeedCursor | null =
    hasMore && lastRow
      ? { createdAt: lastRow.created_at, id: lastRow.id }
      : null;

  return {
    videos,
    nextCursor,
    usedDemoFallback: false,
  };
}

export async function refreshPlaybackUrl(
  supabase: SupabaseClient,
  postId: number
): Promise<{ ok: true; src: string } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("posts")
    .select("id, video_path, video_url, post_type")
    .eq("id", postId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: "Unable to refresh playback." };
  }

  const path =
    typeof data.video_path === "string" ? data.video_path.trim() : "";
  if (path) {
    const normalized = normalizeVideoStoragePath(path);
    if (normalized.ok) {
      watchSignedUrlCache.invalidate(normalized.path);
    }
    const signed = await createVideoSignedUrl(supabase, path);
    if (!signed) {
      return { ok: false, message: "Playback link expired. Try again." };
    }
    return { ok: true, src: signed };
  }

  const legacy =
    typeof data.video_url === "string" ? data.video_url.trim() : "";
  if (legacy.startsWith("http://") || legacy.startsWith("https://")) {
    return { ok: true, src: legacy };
  }

  return { ok: false, message: "No playback URL available." };
}
