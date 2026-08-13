/**
 * Owner-only delete for published Watch posts.
 * Same posts table + ownership filter as web UAF-12. No new backend.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { deleteOwnedVideoObject } from "@/src/lib/video/deleteOwnedVideo";
import {
  OWN_CONTENT_DELETE_ERRORS,
  isUuid,
  type DeleteOwnedPostResult,
} from "@/src/lib/social/deleteOwnedPostShared";

export {
  applySuccessfulDeleteToList,
  OWN_CONTENT_DELETE_ERRORS,
  viewerMaySeeDeleteControl,
  type DeleteOwnedPostCode,
  type DeleteOwnedPostResult,
} from "@/src/lib/social/deleteOwnedPostShared";

type LoadedPost = {
  id: number;
  user_id: string | null;
  post_type: string | null;
  video_path: string | null;
  thumbnail_path: string | null;
};

export async function deletePostForOwner(
  supabase: SupabaseClient,
  userId: string,
  postId: number
): Promise<DeleteOwnedPostResult> {
  if (!isUuid(userId)) {
    return {
      ok: false,
      code: "auth_required",
      message: OWN_CONTENT_DELETE_ERRORS.authRequired,
    };
  }

  if (!Number.isInteger(postId) || postId <= 0) {
    return {
      ok: false,
      code: "invalid",
      message: OWN_CONTENT_DELETE_ERRORS.invalid,
    };
  }

  const { data: existing, error: loadError } = await supabase
    .from("posts")
    .select("id, user_id, post_type, video_path, thumbnail_path")
    .eq("id", postId)
    .maybeSingle();

  if (loadError) {
    console.error("deletePostForOwner load error:", loadError.message);
    return {
      ok: false,
      code: "delete_failed",
      message: OWN_CONTENT_DELETE_ERRORS.deleteFailed,
    };
  }

  if (!existing) {
    return {
      ok: false,
      code: "not_found",
      message: OWN_CONTENT_DELETE_ERRORS.notFound,
    };
  }

  const post = existing as LoadedPost;

  if (post.user_id !== userId) {
    return {
      ok: false,
      code: "not_owner",
      message: OWN_CONTENT_DELETE_ERRORS.notOwner,
    };
  }

  const { data: removed, error: deleteError } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", userId)
    .select("id");

  if (deleteError) {
    console.error("deletePostForOwner delete error:", deleteError.message);
    return {
      ok: false,
      code: "delete_failed",
      message: OWN_CONTENT_DELETE_ERRORS.deleteFailed,
    };
  }

  if (!Array.isArray(removed) || removed.length === 0) {
    return {
      ok: false,
      code: "delete_failed",
      message: OWN_CONTENT_DELETE_ERRORS.deleteFailed,
    };
  }

  const videoPath = post.video_path?.trim() || "";
  if (videoPath) {
    await deleteOwnedVideoObject(supabase, userId, videoPath);
  }
  const thumbnailPath = post.thumbnail_path?.trim() || "";
  if (thumbnailPath && thumbnailPath !== videoPath) {
    await deleteOwnedVideoObject(supabase, userId, thumbnailPath);
  }

  return {
    ok: true,
    postId,
    postType: (post.post_type || "text").trim() || "text",
  };
}
