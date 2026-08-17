import type { SupabaseClient } from "@supabase/supabase-js";

export const PROFILE_VIDEO_PAGE_SIZE = 24;

export type ProfileVideoItem = {
  postId: number;
  title: string;
  likes: number;
  views: number;
  posterUrl: string | null;
  createdAt: string;
};

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

export function mapProfileVideoRow(row: {
  id: unknown;
  content?: unknown;
  likes?: unknown;
  views?: unknown;
  image_url?: unknown;
  created_at?: unknown;
}): ProfileVideoItem | null {
  const postId = parseNonNegInt(row.id);
  if (!Number.isInteger(postId) || postId <= 0) return null;
  const title =
    typeof row.content === "string" && row.content.trim()
      ? row.content.trim()
      : "UMTUBA";
  return {
    postId,
    title,
    likes: parseNonNegInt(row.likes),
    views: parseNonNegInt(row.views),
    posterUrl: cleanHttpUrl(row.image_url),
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
  };
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
  const limit = Math.min(
    Math.max(options?.limit ?? PROFILE_VIDEO_PAGE_SIZE, 1),
    48
  );

  const { data, error } = await supabase
    .from("posts")
    .select("id, content, likes, views, image_url, created_at")
    .eq("user_id", userId)
    .eq("post_type", "video")
    .eq("media_status", "ready")
    .not("video_path", "is", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("listProfileVideos failed:", error);
    return { videos: [], failed: true };
  }

  const videos = (data ?? [])
    .map((row) => mapProfileVideoRow(row))
    .filter((row): row is ProfileVideoItem => row != null);

  return { videos };
}
