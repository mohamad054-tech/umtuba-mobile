import type { SupabaseClient } from "@supabase/supabase-js";

export const COMMENT_MAX_LENGTH = 500;
export const COMMENT_MIN_LENGTH = 1;
export const COMMENTS_PAGE_LIMIT = 40;
export const COMMENTS_HARD_LIMIT = 50;

export type CommentActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; message: string; requiresAuth?: boolean };

export type PostCommentDTO = {
  id: number;
  postId: number;
  body: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarInitial: string;
  };
  isMine: boolean;
};

type PostCommentRow = {
  id: number;
  post_id: number;
  user_id: string;
  body: string;
  created_at: string;
};

type ProfileSnippet = {
  id: string;
  username: string | null;
  display_name: string | null;
  full_name: string | null;
  avatar_initial: string | null;
};

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function validateCommentBody(
  body: string
): CommentActionResult<{ body: string }> {
  const trimmed = body.trim();
  if (trimmed.length < COMMENT_MIN_LENGTH) {
    return { ok: false, message: "Comment cannot be empty." };
  }
  if (trimmed.length > COMMENT_MAX_LENGTH) {
    return {
      ok: false,
      message: `Comment must be ${COMMENT_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, body: trimmed };
}

function mapCommentRow(
  row: PostCommentRow,
  profile: ProfileSnippet | undefined,
  currentUserId: string | null
): PostCommentDTO {
  const username = profile?.username?.trim() || "user";
  const displayName =
    profile?.display_name?.trim() ||
    profile?.full_name?.trim() ||
    username;
  const initial =
    profile?.avatar_initial?.trim()?.charAt(0)?.toUpperCase() ||
    displayName.charAt(0).toUpperCase() ||
    "?";
  return {
    id: row.id,
    postId: row.post_id,
    body: row.body,
    createdAt: row.created_at,
    author: {
      id: row.user_id,
      username,
      displayName,
      avatarInitial: initial,
    },
    isMine: Boolean(currentUserId && currentUserId === row.user_id),
  };
}

async function loadProfilesByIds(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, ProfileSnippet>> {
  const map = new Map<string, ProfileSnippet>();
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return map;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, full_name, avatar_initial")
    .in("id", unique);

  if (error) {
    console.error("Unable to load comment author profiles:", error);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.id, row);
  }
  return map;
}

export async function listPostComments(
  supabase: SupabaseClient,
  postId: number,
  currentUserId: string | null,
  limit = COMMENTS_PAGE_LIMIT
): Promise<CommentActionResult<{ comments: PostCommentDTO[] }>> {
  if (!Number.isInteger(postId) || postId <= 0) {
    return { ok: false, message: "Unable to load comments. Please try again." };
  }

  const safeLimit = Math.min(
    Math.max(Math.floor(limit), 1),
    COMMENTS_HARD_LIMIT
  );

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, user_id, body, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.error("listPostComments failed:", error);
    return {
      ok: false,
      message: "Unable to load comments. Please try again.",
    };
  }

  const rows = (data ?? []) as PostCommentRow[];
  const profiles = await loadProfilesByIds(
    supabase,
    rows.map((row) => row.user_id)
  );
  return {
    ok: true,
    comments: rows.map((row) =>
      mapCommentRow(row, profiles.get(row.user_id), currentUserId)
    ),
  };
}

export async function createPostComment(
  supabase: SupabaseClient,
  postId: number,
  userId: string,
  rawBody: string
): Promise<CommentActionResult<{ comment: PostCommentDTO; comments: number }>> {
  const validated = validateCommentBody(rawBody);
  if (!validated.ok) return validated;
  if (!userId) {
    return {
      ok: false,
      message: "Please sign in to comment.",
      requiresAuth: true,
    };
  }
  if (!Number.isInteger(postId) || postId <= 0) {
    return { ok: false, message: "Unable to post comment. Please try again." };
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id")
    .eq("id", postId)
    .maybeSingle();

  if (postError || !post) {
    return { ok: false, message: "Post not found." };
  }

  const { data, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: postId,
      user_id: userId,
      body: validated.body,
    })
    .select("id, post_id, user_id, body, created_at")
    .single();

  if (error || !data) {
    console.error("createPostComment failed:", error);
    return { ok: false, message: "Unable to post comment. Please try again." };
  }

  const [profiles, postResult] = await Promise.all([
    loadProfilesByIds(supabase, [userId]),
    supabase.from("posts").select("comments").eq("id", postId).maybeSingle(),
  ]);

  return {
    ok: true,
    comment: mapCommentRow(data as PostCommentRow, profiles.get(userId), userId),
    comments: asNumber(postResult.data?.comments, 1),
  };
}
