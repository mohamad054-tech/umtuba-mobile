/**
 * Owner edit of an existing post (draft or published).
 * Same Post ID. Engagement counters are never written.
 * Media path switches only after a validated revision. RLS/owner filter remains.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isOwnedVideoPath,
  MAX_CAPTION_LENGTH,
  validateCaption,
  validateVideoFile,
} from "@/src/contracts/video";
import { createVideoSignedUrl } from "@/src/lib/feed/watchFeed";
import {
  mergeMediaPipelineEdit,
  normalizeTrimRange,
  planMediaRevisionSwitch,
  type VideoTrimRange,
} from "@/src/lib/media/videoTrim";
import { isUuid } from "@/src/lib/social/deleteOwnedPostShared";
import { deleteOwnedVideoObject } from "@/src/lib/video/deleteOwnedVideo";

export const OWN_CONTENT_EDIT_ERRORS = {
  authRequired: "Please sign in to edit this post.",
  forbidden: "You can only edit your own posts.",
  invalid: "This post could not be edited.",
  notFound: "This post could not be found.",
  mediaFailed: "Edited media is not ready. The live post was not changed.",
} as const;

export type EditOwnedPostCode =
  | "auth_required"
  | "forbidden"
  | "invalid"
  | "not_found"
  | "media_failed"
  | "ok";

export type EditOwnedPostResult =
  | {
      ok: true;
      postId: number;
      publicUrl: string;
      mediaSwitched: boolean;
    }
  | {
      ok: false;
      code: Exclude<EditOwnedPostCode, "ok">;
      message: string;
      livePreserved: true;
    };

export type LoadedOwnedPost = {
  id: number;
  user_id: string | null;
  post_type: string | null;
  content: string;
  image_url: string | null;
  video_path: string | null;
  video_mime_type: string | null;
  video_byte_size: number | null;
  thumbnail_path: string | null;
  article_id: string | null;
  media_status: string | null;
  media_duration_ms: number | null;
  media_pipeline: Record<string, unknown> | null;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views: number;
  created_at: string;
};

export type MediaRevisionInput = {
  kind: "none" | "replace_video" | "replace_image" | "add_image" | "remove_image";
  candidatePath?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  imageUrl?: string | null;
  validated?: boolean;
};

export type EditOwnedPostInput = {
  content?: string;
  hashtags?: string[];
  articleTitle?: string | null;
  articleBody?: string | null;
  removeArticle?: boolean;
  trim?: VideoTrimRange | null;
  coverUrl?: string | null;
  clearCover?: boolean;
  media?: MediaRevisionInput;
};

const LOAD_COLUMNS =
  "id, user_id, post_type, content, image_url, video_path, video_mime_type, video_byte_size, thumbnail_path, article_id, media_status, media_duration_ms, media_pipeline, likes, comments, shares, saves, views, created_at";

const ENGAGEMENT_KEYS = ["likes", "comments", "shares", "saves", "views"] as const;

export function viewerMayEditPost(
  viewerId: string | null | undefined,
  ownerUserId: string | null | undefined
): boolean {
  return Boolean(
    viewerId &&
      ownerUserId &&
      isUuid(viewerId) &&
      isUuid(ownerUserId) &&
      viewerId === ownerUserId
  );
}

export const viewerMaySeeEditControl = viewerMayEditPost;

export function authorizePostEdit(
  actorId: string | null | undefined,
  ownerId: string | null | undefined
): { ok: true } | { ok: false; code: "auth_required" | "forbidden" } {
  if (!actorId || !isUuid(actorId)) {
    return { ok: false, code: "auth_required" };
  }
  if (!ownerId || ownerId !== actorId) {
    return { ok: false, code: "forbidden" };
  }
  return { ok: true };
}

export function composeCaptionWithHashtags(
  content: string,
  hashtags: string[] | undefined
): string {
  const base = content.trim();
  if (!hashtags || hashtags.length === 0) {
    return base;
  }
  const existing = new Set(
    (base.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((tag) => tag.toLowerCase())
  );
  const extra: string[] = [];
  for (const raw of hashtags) {
    const tag = raw.trim().replace(/^#+/, "");
    if (!tag || !/^[\p{L}\p{N}_]{1,47}$/u.test(tag)) continue;
    const token = `#${tag}`;
    if (existing.has(token.toLowerCase())) continue;
    extra.push(token);
    if (extra.length >= 8) break;
  }
  if (extra.length === 0) return base;
  const joined = base ? `${base} ${extra.join(" ")}` : extra.join(" ");
  return joined.slice(0, MAX_CAPTION_LENGTH);
}

export function publicPostUrl(postId: number): string {
  return `/watch?post=${postId}`;
}

export function engagementSnapshot(post: LoadedOwnedPost): {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views: number;
} {
  return {
    likes: post.likes,
    comments: post.comments,
    shares: post.shares,
    saves: post.saves,
    views: post.views,
  };
}

/** Update payload must never include identity or engagement columns. */
export function assertSafeUpdatePatch(patch: Record<string, unknown>): void {
  if ("id" in patch || "user_id" in patch || "created_at" in patch) {
    throw new Error("Refusing to rewrite post identity.");
  }
  for (const key of ENGAGEMENT_KEYS) {
    if (key in patch) {
      throw new Error("Refusing to reset engagement counters.");
    }
  }
}

export function failPreservingLive(
  code: Exclude<EditOwnedPostCode, "ok">,
  message: string
): Extract<EditOwnedPostResult, { ok: false }> {
  return { ok: false, code, message, livePreserved: true };
}

export async function loadOwnedPost(
  supabase: SupabaseClient,
  userId: string,
  postId: number
): Promise<LoadedOwnedPost | null> {
  const { data, error } = await supabase
    .from("posts")
    .select(LOAD_COLUMNS)
    .eq("id", postId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as LoadedOwnedPost;
  const authz = authorizePostEdit(userId, row.user_id);
  if (!authz.ok) {
    return null;
  }
  return row;
}

async function applyArticleEdit(
  supabase: SupabaseClient,
  userId: string,
  post: LoadedOwnedPost,
  input: EditOwnedPostInput
): Promise<{ articleId: string | null } | { error: string }> {
  const title = input.articleTitle?.trim() ?? "";
  const body = input.articleBody?.trim() ?? "";
  const wantsArticle = Boolean(title || body);

  if (input.removeArticle) {
    return { articleId: null };
  }

  if (!wantsArticle && !post.article_id) {
    return { articleId: post.article_id };
  }

  if (title && (title.length < 1 || title.length > 200)) {
    return { error: "Article title must be 1–200 characters." };
  }
  if (body && (body.length < 1 || body.length > 50000)) {
    return { error: "Article body must be 1–50000 characters." };
  }

  if (post.article_id && (title || body)) {
    const patch: Record<string, string> = {};
    if (title) patch.title = title;
    if (body) patch.body = body;
    const { error } = await supabase
      .from("articles")
      .update(patch)
      .eq("id", post.article_id)
      .eq("user_id", userId);
    if (error) {
      return { error: "Unable to update the article." };
    }
    return { articleId: post.article_id };
  }

  if (!post.article_id && title && body) {
    const { data, error } = await supabase
      .from("articles")
      .insert({
        user_id: userId,
        title,
        body,
        status: post.media_status === "draft" ? "draft" : "published",
        published_at:
          post.media_status === "draft" ? null : new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !data?.id) {
      return { error: "Unable to add the article." };
    }
    return { articleId: String(data.id) };
  }

  return { articleId: post.article_id };
}

async function resolveVideoRevision(
  supabase: SupabaseClient,
  userId: string,
  post: LoadedOwnedPost,
  media: MediaRevisionInput | undefined
): Promise<
  | {
      ok: true;
      videoPath: string | null;
      mimeType: string | null;
      byteSize: number | null;
      switched: boolean;
      previousPath: string | null;
    }
  | { ok: false; message: string }
> {
  const livePath = post.video_path?.trim() || "";
  if (
    !media ||
    media.kind === "none" ||
    media.kind === "replace_image" ||
    media.kind === "add_image" ||
    media.kind === "remove_image"
  ) {
    return {
      ok: true,
      videoPath: livePath || null,
      mimeType: post.video_mime_type,
      byteSize: post.video_byte_size,
      switched: false,
      previousPath: null,
    };
  }

  if (media.kind !== "replace_video") {
    return {
      ok: true,
      videoPath: livePath || null,
      mimeType: post.video_mime_type,
      byteSize: post.video_byte_size,
      switched: false,
      previousPath: null,
    };
  }

  const candidate = media.candidatePath?.trim() || "";
  const plan = planMediaRevisionSwitch({
    livePath,
    candidatePath: candidate,
    validated: media.validated === true,
  });

  if (plan.action === "abort") {
    if (candidate && isOwnedVideoPath(userId, candidate) && candidate !== livePath) {
      await deleteOwnedVideoObject(supabase, userId, candidate);
    }
    return { ok: false, message: plan.reason };
  }

  if (plan.action === "keep_live") {
    return {
      ok: true,
      videoPath: livePath || null,
      mimeType: post.video_mime_type,
      byteSize: post.video_byte_size,
      switched: false,
      previousPath: null,
    };
  }

  if (!isOwnedVideoPath(userId, plan.livePath)) {
    return { ok: false, message: OWN_CONTENT_EDIT_ERRORS.mediaFailed };
  }

  const fileCheck = validateVideoFile({
    mimeType: media.mimeType ?? "",
    byteSize: media.byteSize ?? 0,
    fileName: plan.livePath.split("/").pop() ?? null,
  });
  if (!fileCheck.ok) {
    await deleteOwnedVideoObject(supabase, userId, plan.livePath);
    return { ok: false, message: OWN_CONTENT_EDIT_ERRORS.mediaFailed };
  }

  const signed = await createVideoSignedUrl(supabase, plan.livePath);
  if (!signed) {
    await deleteOwnedVideoObject(supabase, userId, plan.livePath);
    return { ok: false, message: OWN_CONTENT_EDIT_ERRORS.mediaFailed };
  }

  return {
    ok: true,
    videoPath: plan.livePath,
    mimeType: fileCheck.mimeType,
    byteSize: media.byteSize ?? post.video_byte_size,
    switched: true,
    previousPath: plan.previousPath || null,
  };
}

function playbackKept(post: LoadedOwnedPost): VideoTrimRange | null {
  const playback = post.media_pipeline?.playback;
  if (!playback || typeof playback !== "object") return null;
  const rec = playback as Record<string, unknown>;
  return normalizeTrimRange(
    { inMs: rec.inMs, outMs: rec.outMs },
    post.media_duration_ms ?? 0
  );
}

export async function updatePostForOwner(
  supabase: SupabaseClient,
  userId: string,
  postId: number,
  input: EditOwnedPostInput
): Promise<EditOwnedPostResult> {
  if (!isUuid(userId)) {
    return failPreservingLive("auth_required", OWN_CONTENT_EDIT_ERRORS.authRequired);
  }
  if (!Number.isInteger(postId) || postId <= 0) {
    return failPreservingLive("invalid", OWN_CONTENT_EDIT_ERRORS.invalid);
  }

  const post = await loadOwnedPost(supabase, userId, postId);
  if (!post) {
    const { data } = await supabase
      .from("posts")
      .select("id, user_id")
      .eq("id", postId)
      .maybeSingle();
    if (data && data.user_id && data.user_id !== userId) {
      return failPreservingLive("forbidden", OWN_CONTENT_EDIT_ERRORS.forbidden);
    }
    return failPreservingLive("not_found", OWN_CONTENT_EDIT_ERRORS.notFound);
  }

  const authz = authorizePostEdit(userId, post.user_id);
  if (!authz.ok) {
    return failPreservingLive(
      authz.code,
      authz.code === "auth_required"
        ? OWN_CONTENT_EDIT_ERRORS.authRequired
        : OWN_CONTENT_EDIT_ERRORS.forbidden
    );
  }

  const nextContent = composeCaptionWithHashtags(
    typeof input.content === "string" ? input.content : post.content,
    input.hashtags
  );
  const captionCheck = validateCaption(nextContent);
  if (!captionCheck.ok && post.post_type === "video") {
    return failPreservingLive("invalid", captionCheck.message);
  }
  if (
    !nextContent &&
    post.post_type !== "image" &&
    post.post_type !== "video" &&
    !input.media
  ) {
    return failPreservingLive("invalid", "The post must contain text or media.");
  }

  const videoRevision = await resolveVideoRevision(supabase, userId, post, input.media);
  if (!videoRevision.ok) {
    return failPreservingLive("media_failed", videoRevision.message);
  }

  let nextImageUrl = post.image_url;
  let nextPostType = post.post_type ?? "text";
  const mediaKind = input.media?.kind ?? "none";

  if (mediaKind === "remove_image") {
    nextImageUrl = null;
    if (nextPostType === "image") {
      nextPostType = "text";
    }
  } else if (
    (mediaKind === "add_image" || mediaKind === "replace_image") &&
    input.media?.imageUrl &&
    input.media.validated === true
  ) {
    nextImageUrl = input.media.imageUrl;
    if (nextPostType !== "video") {
      nextPostType = "image";
    }
  } else if (
    (mediaKind === "add_image" || mediaKind === "replace_image") &&
    input.media?.validated !== true &&
    (input.media?.imageUrl || input.media?.candidatePath)
  ) {
    return failPreservingLive("media_failed", OWN_CONTENT_EDIT_ERRORS.mediaFailed);
  }

  if (videoRevision.switched) {
    nextPostType = "video";
  }

  const durationMs = post.media_duration_ms ?? 0;
  const trim =
    input.trim && durationMs > 0
      ? normalizeTrimRange(input.trim, durationMs)
      : input.trim
        ? normalizeTrimRange(input.trim, input.trim.outMs || 0)
        : playbackKept(post);

  const article = await applyArticleEdit(supabase, userId, post, input);
  if ("error" in article) {
    if (videoRevision.switched && videoRevision.videoPath) {
      await deleteOwnedVideoObject(supabase, userId, videoRevision.videoPath);
    }
    return failPreservingLive("invalid", article.error);
  }

  const editedAt = new Date().toISOString();
  const mediaPipeline = mergeMediaPipelineEdit(post.media_pipeline, {
    trim,
    editedAt,
    previousVideoPath: videoRevision.previousPath,
    coverUrl: input.coverUrl ?? undefined,
    clearCover: input.clearCover,
  });

  if (post.media_pipeline?.overlays) {
    mediaPipeline.overlays = post.media_pipeline.overlays;
  }

  const patch: Record<string, unknown> = {
    content: nextContent,
    post_type: nextPostType,
    image_url: nextImageUrl,
    article_id: article.articleId,
    media_pipeline: mediaPipeline,
  };

  if (nextPostType === "video") {
    patch.video_path = videoRevision.videoPath;
    patch.video_mime_type = videoRevision.mimeType;
    patch.video_byte_size = videoRevision.byteSize;
    if (videoRevision.switched) {
      patch.media_status = "ready";
      patch.processing_error = null;
      patch.processing_progress = 100;
    }
  }

  assertSafeUpdatePatch(patch);

  const { data, error } = await supabase
    .from("posts")
    .update(patch)
    .eq("id", post.id)
    .eq("user_id", userId)
    .select("id")
    .single();

  if (error || !data) {
    if (videoRevision.switched && videoRevision.videoPath) {
      await deleteOwnedVideoObject(supabase, userId, videoRevision.videoPath);
    }
    console.error("updatePostForOwner failed:", error);
    return failPreservingLive("invalid", OWN_CONTENT_EDIT_ERRORS.invalid);
  }

  return {
    ok: true,
    postId: post.id,
    publicUrl: publicPostUrl(post.id),
    mediaSwitched:
      videoRevision.switched ||
      mediaKind === "replace_image" ||
      mediaKind === "add_image" ||
      mediaKind === "remove_image",
  };
}
