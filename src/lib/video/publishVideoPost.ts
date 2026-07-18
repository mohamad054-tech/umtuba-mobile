import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isOwnedVideoPath,
  POST_VIDEOS_BUCKET,
  validateCaption,
  validateVideoFile,
  VIDEO_SIGNED_URL_TTL_SECONDS,
} from "@/src/contracts/video";
import { getErrorMessage } from "@/src/contracts/validation";
import { createVideoSignedUrl } from "@/src/lib/feed/watchFeed";
import { deleteOwnedVideoObject } from "@/src/lib/video/deleteOwnedVideo";

export type PublishVideoMetadata = {
  durationMs?: number | null;
  width?: number | null;
  height?: number | null;
};

export type PublishVideoPostInput = {
  caption: string;
  videoPath: string;
  mimeType: string;
  byteSize: number;
  metadata?: PublishVideoMetadata | null;
  uploadStartedAt?: string | null;
};

export type PublishVideoPostResult =
  | { ok: true; postId: number }
  | {
      ok: false;
      message: string;
      code: "auth_required" | "publish_failed";
      videoPath?: string;
    };

type ProfileLite = {
  full_name: string;
  username: string;
  avatar_initial: string;
};

const READY_COLUMNS = "id";

function clampProcessingProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function computeAspectRatioLabel(
  width: number | null,
  height: number | null
): string | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  const ratio = width / height;
  if (Math.abs(ratio - 9 / 16) < 0.08) return "9:16";
  if (Math.abs(ratio - 16 / 9) < 0.08) return "16:9";
  if (Math.abs(ratio - 1) < 0.08) return "1:1";
  return `${width}:${height}`;
}

function buildMockThumbnailPath(userId: string, assetId: string): string {
  return `${userId}/thumbs/${assetId}.jpg`;
}

/**
 * Publish after authenticated upload. Verifies owned object via signed URL,
 * inserts queued → processing → ready. Deletes storage object on failure.
 * Client-side RLS path — never uses service-role.
 */
export async function publishVideoPost(
  supabase: SupabaseClient,
  userId: string,
  profile: ProfileLite,
  input: PublishVideoPostInput
): Promise<PublishVideoPostResult> {
  const videoPath = input.videoPath.trim();

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user || user.id !== userId) {
      return {
        ok: false,
        code: "auth_required",
        videoPath: videoPath || undefined,
        message: "Please sign in to publish a video.",
      };
    }

    const post = await insertVideoPostForUser(supabase, userId, profile, input);
    return { ok: true, postId: post.id };
  } catch (error) {
    console.error("publishVideoPost failed:", error);
    await deleteOwnedVideoObject(supabase, userId, videoPath);
    return {
      ok: false,
      code: "publish_failed",
      message: getErrorMessage(
        error,
        "Unable to create the video post. Please try again."
      ),
      videoPath,
    };
  }
}

async function insertVideoPostForUser(
  supabase: SupabaseClient,
  userId: string,
  profile: ProfileLite,
  input: PublishVideoPostInput
): Promise<{ id: number }> {
  const caption = input.caption.trim();
  const videoPath = input.videoPath.trim();
  const now = new Date().toISOString();
  const uploadStartedAt =
    typeof input.uploadStartedAt === "string" && input.uploadStartedAt.trim()
      ? input.uploadStartedAt.trim()
      : now;

  const width =
    typeof input.metadata?.width === "number" && input.metadata.width > 0
      ? Math.round(input.metadata.width)
      : null;
  const height =
    typeof input.metadata?.height === "number" && input.metadata.height > 0
      ? Math.round(input.metadata.height)
      : null;
  const durationMs =
    typeof input.metadata?.durationMs === "number" &&
    input.metadata.durationMs >= 0
      ? Math.round(input.metadata.durationMs)
      : null;

  async function failAndCleanup(message: string): Promise<never> {
    await deleteOwnedVideoObject(supabase, userId, videoPath);
    throw new Error(message);
  }

  if (!isOwnedVideoPath(userId, videoPath)) {
    await failAndCleanup("Invalid video upload path.");
  }

  const captionCheck = validateCaption(caption);
  if (!captionCheck.ok) {
    await failAndCleanup(captionCheck.message);
  }

  const fileCheck = validateVideoFile({
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    fileName: videoPath.split("/").pop() ?? null,
  });
  if (!fileCheck.ok) {
    await failAndCleanup(fileCheck.message);
  }
  const resolvedMimeType = fileCheck.ok
    ? fileCheck.mimeType
    : input.mimeType;

  const signedUrl = await createVideoSignedUrl(supabase, videoPath);
  if (!signedUrl) {
    await failAndCleanup(
      "The uploaded video could not be verified. Please try again."
    );
  }

  const authorUsername = profile.username.startsWith("@")
    ? profile.username
    : `@${profile.username}`;

  const thumbAssetId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `t-${Date.now()}`;
  const thumbnailPath = buildMockThumbnailPath(userId, thumbAssetId);

  const { data: queued, error: insertError } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      content: caption,
      post_type: "video",
      author_name: profile.full_name,
      author_username: authorUsername,
      author_avatar: profile.avatar_initial,
      image_url: null,
      video_url: null,
      video_path: videoPath,
      video_mime_type: resolvedMimeType,
      video_byte_size: input.byteSize,
      media_status: "queued",
      upload_started_at: uploadStartedAt,
      upload_completed_at: now,
      processing_started_at: null,
      processing_completed_at: null,
      processing_error: null,
      processing_progress: 0,
      media_duration_ms: durationMs,
      media_width: width,
      media_height: height,
      media_fps: null,
      media_codec: null,
      media_bitrate: null,
      media_file_size: input.byteSize > 0 ? input.byteSize : null,
      media_aspect_ratio: computeAspectRatioLabel(width, height),
      thumbnail_path: thumbnailPath,
      media_pipeline: {
        hls: null,
        dash: null,
        abr: null,
        ai_enhancement: null,
        ai_translation: null,
        ai_dubbing: null,
      },
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      views: 0,
    })
    .select(READY_COLUMNS)
    .single();

  if (insertError || !queued) {
    console.error("Unable to create video post row:", insertError);
    const message = (insertError?.message || "").toLowerCase();
    if (
      message.includes("media_status") ||
      message.includes("schema cache") ||
      (insertError as { code?: string } | null)?.code === "PGRST204"
    ) {
      return insertVideoPostLegacy(
        supabase,
        userId,
        profile,
        input,
        failAndCleanup
      );
    }
    await failAndCleanup("Unable to create the video post. Please try again.");
  }

  const queuedId = (queued as { id: number }).id;

  const processingStarted = new Date().toISOString();
  await supabase
    .from("posts")
    .update({
      media_status: "processing",
      processing_started_at: processingStarted,
      processing_progress: clampProcessingProgress(35),
    })
    .eq("id", queuedId)
    .eq("user_id", userId);

  const processingCompleted = new Date().toISOString();
  const { data: ready, error: readyError } = await supabase
    .from("posts")
    .update({
      media_status: "ready",
      processing_progress: 100,
      processing_completed_at: processingCompleted,
      processing_error: null,
      thumbnail_path: thumbnailPath,
    })
    .eq("id", queuedId)
    .eq("user_id", userId)
    .select(READY_COLUMNS)
    .single();

  if (readyError || !ready) {
    console.error("Unable to finalize video ready state:", readyError);
    await supabase
      .from("posts")
      .delete()
      .eq("id", queuedId)
      .eq("user_id", userId);
    await failAndCleanup(
      "Unable to finish processing the video. Please try again."
    );
  }

  return { id: (ready as { id: number }).id };
}

async function insertVideoPostLegacy(
  supabase: SupabaseClient,
  userId: string,
  profile: ProfileLite,
  input: PublishVideoPostInput,
  failAndCleanup: (message: string) => Promise<never>
): Promise<{ id: number }> {
  const caption = input.caption.trim();
  const videoPath = input.videoPath.trim();
  const authorUsername = profile.username.startsWith("@")
    ? profile.username
    : `@${profile.username}`;

  const { data, error } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      content: caption,
      post_type: "video",
      author_name: profile.full_name,
      author_username: authorUsername,
      author_avatar: profile.avatar_initial,
      image_url: null,
      video_url: null,
      video_path: videoPath,
      video_mime_type: input.mimeType,
      video_byte_size: input.byteSize,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      views: 0,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Unable to create video post row (legacy):", error);
    await failAndCleanup("Unable to create the video post. Please try again.");
  }

  return { id: (data as { id: number }).id };
}

/** Test helper — ownership + bucket constant for signed refresh contracts. */
export function signedPlaybackRefreshContract() {
  return {
    bucket: POST_VIDEOS_BUCKET,
    ttlSeconds: VIDEO_SIGNED_URL_TTL_SECONDS,
  };
}
