import type { SupabaseClient } from "@supabase/supabase-js";

export const PROFILE_POST_PAGE_SIZE = 24;

export type ProfilePostItem = {
  postId: number;
  postType: "text" | "image";
  content: string;
  imageUrl: string | null;
  createdAt: string;
};

function parsePositiveInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:"
      ? trimmed
      : null;
  } catch {
    return null;
  }
}

export function mapProfilePostRow(row: {
  id: unknown;
  post_type?: unknown;
  content?: unknown;
  image_url?: unknown;
  created_at?: unknown;
}): ProfilePostItem | null {
  const postId = parsePositiveInt(row.id);
  if (postId == null) return null;
  const rawType = cleanText(row.post_type);
  const postType: "text" | "image" =
    rawType === "image" || Boolean(cleanHttpUrl(row.image_url))
      ? "image"
      : "text";
  if (rawType && rawType !== "text" && rawType !== "image") {
    return null;
  }
  return {
    postId,
    postType,
    content: cleanText(row.content),
    imageUrl: cleanHttpUrl(row.image_url),
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
  };
}

/** Text / image posts owned by the profile. Honest empty when none. */
export async function listProfilePosts(
  supabase: SupabaseClient,
  userId: string,
  options?: { limit?: number }
): Promise<{ posts: ProfilePostItem[]; failed?: boolean }> {
  if (!userId) {
    return { posts: [], failed: true };
  }
  const limit = Math.min(
    Math.max(options?.limit ?? PROFILE_POST_PAGE_SIZE, 1),
    48
  );

  const { data, error } = await supabase
    .from("posts")
    .select("id, post_type, content, image_url, created_at")
    .eq("user_id", userId)
    .in("post_type", ["text", "image"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("listProfilePosts failed:", error);
    return { posts: [], failed: true };
  }

  const posts = (data ?? [])
    .map((row) => mapProfilePostRow(row))
    .filter((row): row is ProfilePostItem => row != null);

  return { posts };
}
