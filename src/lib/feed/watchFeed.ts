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
import { loadViewerInteractionState } from "@/src/lib/social/interactions";

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
  created_at
`;

export type MappedPlaybackRow = {
  row: VideoPostRow;
  playbackUrl: string;
  likedByMe: boolean;
  savedByMe: boolean;
};

/** Pure mapper — unit-tested without Supabase. */
export function mapRowToWatchVideo(input: MappedPlaybackRow): WatchVideo {
  const { row, playbackUrl, likedByMe, savedByMe } = input;
  const username = row.author_username?.startsWith("@")
    ? row.author_username
    : `@${row.author_username || "user"}`;
  const caption = (row.content || "").trim();

  return {
    id: `post-${row.id}`,
    postId: row.id,
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
    likedByMe,
    savedByMe,
    source: "supabase",
  };
}

export async function createVideoSignedUrl(
  supabase: SupabaseClient,
  path: string
): Promise<string | null> {
  const trimmed = path.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase.storage
    .from(POST_VIDEOS_BUCKET)
    .createSignedUrl(trimmed, VIDEO_SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error("Unable to sign video URL:", trimmed, error);
    return null;
  }

  return data.signedUrl;
}

async function resolvePlaybackUrl(
  supabase: SupabaseClient,
  row: VideoPostRow
): Promise<string | null> {
  const path = row.video_path?.trim();
  if (path) {
    return createVideoSignedUrl(supabase, path);
  }

  const legacy = row.video_url?.trim();
  if (legacy?.startsWith("http://") || legacy?.startsWith("https://")) {
    return legacy;
  }

  return null;
}

export type FetchWatchFeedInput = {
  cursor?: WatchFeedCursor | null;
  focusPostId?: number | null;
  limit?: number;
};

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
    const focusedInPage = rows.some((row) => row.id === input.focusPostId);
    if (!focusedInPage) {
      const { data: focused } = await supabase
        .from("posts")
        .select(postColumns)
        .eq("id", input.focusPostId)
        .eq("post_type", "video")
        .eq("media_status", "ready")
        .not("video_path", "is", null)
        .maybeSingle();
      if (focused) {
        rows = [focused as VideoPostRow, ...rows];
      }
    }
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
    const playbackUrl = await resolvePlaybackUrl(supabase, row);
    if (!playbackUrl) continue;
    const state = viewerState.get(row.id);
    videos.push(
      mapRowToWatchVideo({
        row,
        playbackUrl,
        likedByMe: state?.likedByMe ?? false,
        savedByMe: state?.savedByMe ?? false,
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
