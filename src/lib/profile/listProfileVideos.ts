import type { SupabaseClient } from "@supabase/supabase-js";

import { createVideoSignedUrl } from "@/src/lib/feed/watchFeed";

export const PROFILE_VIDEO_PAGE_SIZE = 24;

export type ProfileVideoItem = {
  postId: number;
  title: string;
  likes: number;
  views: number;
  posterUrl: string | null;
  previewUrl: string | null;
  videoPath: string | null;
  createdAt: string;
  articleId: string | null;
};

const PROFILE_VIDEO_COLUMNS =
  "id, content, likes, views, image_url, video_path, created_at, article_id";
const PROFILE_VIDEO_COLUMNS_BASE =
  "id, content, likes, views, image_url, video_path, created_at";

function parseNonNegInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function cleanHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? trimmed : null;
  } catch {
    return null;
  }
}

function cleanArticleId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    trimmed
  )
    ? trimmed
    : null;
}

export function mapProfileVideoRow(row: {
  id: unknown;
  content?: unknown;
  likes?: unknown;
  views?: unknown;
  image_url?: unknown;
  video_path?: unknown;
  created_at?: unknown;
  article_id?: unknown;
}): ProfileVideoItem | null {
  const postId = parseNonNegInt(row.id);
  if (!Number.isInteger(postId) || postId <= 0) return null;
  const title =
    typeof row.content === "string" && row.content.trim()
      ? row.content.trim()
      : "UMTUBA";
  const videoPath =
    typeof row.video_path === "string" && row.video_path.trim()
      ? row.video_path.trim()
      : null;
  return {
    postId,
    title,
    likes: parseNonNegInt(row.likes),
    views: parseNonNegInt(row.views),
    posterUrl: cleanHttpUrl(row.image_url),
    previewUrl: null,
    videoPath,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    articleId: cleanArticleId(row.article_id),
  };
}

export async function fetchProfileArticle(
  supabase: SupabaseClient,
  articleId: string
): Promise<{ title: string; body: string } | null> {
  if (!cleanArticleId(articleId)) return null;
  const { data, error } = await supabase
    .from("articles")
    .select("title, body")
    .eq("id", articleId)
    .maybeSingle();
  if (error || !data) return null;
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const body = typeof data.body === "string" ? data.body.trim() : "";
  if (!body) return null;
  return { title, body };
}

export async function attachProfileVideoPreviews(
  supabase: SupabaseClient,
  videos: ProfileVideoItem[]
): Promise<ProfileVideoItem[]> {
  return Promise.all(
    videos.map(async (video) => {
      if (video.posterUrl || !video.videoPath) return video;
      try {
        const previewUrl = await createVideoSignedUrl(supabase, video.videoPath);
        return previewUrl ? { ...video, previewUrl } : video;
      } catch {
        return video;
      }
    })
  );
}

/** Keep the video the viewer was watching at the front of this profile. */
export function placeProfileVideoFirst(
  videos: readonly ProfileVideoItem[],
  postId: number | null
): ProfileVideoItem[] {
  if (postId == null || !Number.isInteger(postId) || postId <= 0) {
    return [...videos];
  }
  const index = videos.findIndex((video) => video.postId === postId);
  if (index <= 0) return [...videos];
  const next = videos.slice();
  const [hit] = next.splice(index, 1);
  if (!hit) return [...videos];
  next.unshift(hit);
  return next;
}

export async function fetchProfileVideoById(
  supabase: SupabaseClient,
  userId: string,
  postId: number
): Promise<ProfileVideoItem | null> {
  if (!userId || !Number.isInteger(postId) || postId <= 0) return null;
  const load = (columns: string) =>
    supabase
      .from("posts")
      .select(columns)
      .eq("id", postId)
      .eq("user_id", userId)
      .eq("post_type", "video")
      .eq("media_status", "ready")
      .not("video_path", "is", null)
      .maybeSingle();
  let { data, error } = await load(PROFILE_VIDEO_COLUMNS);
  if (error && /article_id/i.test(error.message ?? "")) {
    ({ data, error } = await load(PROFILE_VIDEO_COLUMNS_BASE));
  }
  if (error || !data) return null;
  const mapped = mapProfileVideoRow(data);
  if (!mapped) return null;
  const [withPreview] = await attachProfileVideoPreviews(supabase, [mapped]);
  return withPreview ?? mapped;
}

/** Published ready videos owned by this profile. Honest empty when none. */
export async function listProfileVideos(
  supabase: SupabaseClient,
  userId: string,
  options?: { limit?: number }
): Promise<{ videos: ProfileVideoItem[]; failed?: boolean }> {
  if (!userId) {
    return { videos: [], failed: true };
  }
  const pageSize = Math.min(
    Math.max(options?.limit ?? PROFILE_VIDEO_PAGE_SIZE, 1),
    PROFILE_VIDEO_PAGE_SIZE
  );
  const mapped: ProfileVideoItem[] = [];
  let from = 0;
  let columns = PROFILE_VIDEO_COLUMNS;
  while (mapped.length < 200) {
    const run = (selected: string) =>
      supabase
        .from("posts")
        .select(selected)
        .eq("user_id", userId)
        .eq("post_type", "video")
        .eq("media_status", "ready")
        .not("video_path", "is", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + pageSize - 1);
    let { data, error } = await run(columns);
    if (
      error &&
      columns !== PROFILE_VIDEO_COLUMNS_BASE &&
      /article_id/i.test(error.message ?? "")
    ) {
      columns = PROFILE_VIDEO_COLUMNS_BASE;
      ({ data, error } = await run(columns));
    }

    if (error) {
      console.error("listProfileVideos failed:", error);
      return { videos: [], failed: true };
    }
    const page = (data ?? [])
      .map((row) => mapProfileVideoRow(row))
      .filter((row): row is ProfileVideoItem => row != null);
    mapped.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  const videos = await attachProfileVideoPreviews(supabase, mapped);

  return { videos };
}
