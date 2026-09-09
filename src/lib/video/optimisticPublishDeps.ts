import { watchSignedUrlCache } from "@/src/lib/feed/signedUrlCache";
import { getSupabase } from "@/src/lib/supabase/client";
import { deleteOwnedVideoObject } from "@/src/lib/video/deleteOwnedVideo";
import {
  clearPendingVideoUpload,
  queuePendingVideoUpload,
} from "@/src/lib/video/orphanUploads";
import type { OptimisticPublishDeps } from "@/src/lib/video/optimisticPublishPipeline";
import { publishVideoPost } from "@/src/lib/video/publishVideoPost";
import { uploadPostVideo } from "@/src/lib/video/uploadPostVideo";

export function createDefaultOptimisticPublishDeps(input: {
  userId: string;
  profile: {
    full_name: string;
    username: string;
    avatar_initial: string;
  };
}): OptimisticPublishDeps {
  return {
    expectedUserId: input.userId,
    getAccessToken: async () => {
      const { data, error } = await getSupabase().auth.getSession();
      if (error || !data.session?.access_token) return null;
      return data.session.access_token;
    },
    assertUserId: async () => {
      const { data } = await getSupabase().auth.getUser();
      return data.user?.id ?? null;
    },
    upload: (payload) => uploadPostVideo(payload),
    publish: (userId, record, uploaded, uploadStartedAt) =>
      publishVideoPost(getSupabase(), userId, input.profile, {
        caption: record.caption,
        videoPath: uploaded.path,
        mimeType: uploaded.mimeType,
        byteSize: uploaded.byteSize,
        uploadStartedAt,
        metadata: {
          durationMs: record.asset.durationMs,
          width: record.asset.width,
          height: record.asset.height,
        },
        soundId: record.soundId,
        soundMix: record.soundMix,
        mediaPipeline: record.mediaPipeline,
      }),
    peekSignedUrl: (path) => watchSignedUrlCache.peek(path),
    deleteOwnedObject: (userId, path) =>
      deleteOwnedVideoObject(getSupabase(), userId, path),
    queueOrphan: (path) => queuePendingVideoUpload(path),
    clearOrphan: (path) => clearPendingVideoUpload(path),
  };
}
