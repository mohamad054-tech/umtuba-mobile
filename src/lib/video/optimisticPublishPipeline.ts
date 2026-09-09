import { getErrorMessage } from "@/src/contracts/validation";
import {
  applyOptimisticUploadProgress,
  beginOptimisticRetry,
  getOptimisticWatchRecord,
  logWatchPublishTx,
  markOptimisticFailed,
  markOptimisticPublishing,
  patchOptimisticWatchRecord,
  reconcileOptimisticWithServer,
  replaceOptimisticWatchRecord,
  type OptimisticWatchRecord,
} from "@/src/lib/feed/optimisticWatchPublish";
import type { PublishVideoPostResult } from "@/src/lib/video/publishVideoPost";
import type {
  UploadPostVideoInput,
  UploadPostVideoResult,
} from "@/src/lib/video/uploadPostVideo";

export type OptimisticPublishDeps = {
  now?: () => number;
  expectedUserId: string;
  getAccessToken: () => Promise<string | null>;
  assertUserId: () => Promise<string | null>;
  upload: (input: UploadPostVideoInput) => Promise<UploadPostVideoResult>;
  publish: (
    userId: string,
    record: OptimisticWatchRecord,
    uploaded: UploadPostVideoResult,
    uploadStartedAt: string
  ) => Promise<PublishVideoPostResult>;
  peekSignedUrl?: (path: string) => string | null;
  deleteOwnedObject: (userId: string, path: string) => Promise<void>;
  queueOrphan: (path: string) => Promise<void>;
  clearOrphan: (path: string) => Promise<void>;
};

export async function runOptimisticPublishPipeline(
  clientId: string,
  deps: OptimisticPublishDeps
): Promise<OptimisticWatchRecord | null> {
  const record = getOptimisticWatchRecord(clientId);
  if (!record) return null;
  if (
    record.inFlight &&
    (record.phase === "uploading" || record.phase === "publishing")
  ) {
    return record;
  }

  patchOptimisticWatchRecord(clientId, (current) => ({
    ...current,
    inFlight: true,
    phase: current.phase === "failed" ? "uploading" : current.phase,
    error: null,
  }));

  const now = deps.now ?? Date.now;
  let uploadedPath: string | null = null;

  try {
    const accessToken = await deps.getAccessToken();
    if (!accessToken) {
      markOptimisticFailed(clientId, "Please sign in to upload a video.");
      return getOptimisticWatchRecord(clientId);
    }

    const t2 = now();
    patchOptimisticWatchRecord(clientId, (current) => {
      logWatchPublishTx("T2", clientId, { at: t2 });
      return {
        ...current,
        phase: "uploading",
        timestamps: { ...current.timestamps, t2 },
      };
    });

    const uploaded = await deps.upload({
      uri: record.asset.uri,
      fileName: record.asset.fileName,
      mimeType: record.asset.mimeType,
      byteSize: record.asset.byteSize,
      userId: deps.expectedUserId,
      accessToken,
      onProgress: (progress) => {
        applyOptimisticUploadProgress(clientId, progress.percent);
      },
    });
    uploadedPath = uploaded.path;

    const liveUserId = await deps.assertUserId();
    if (!liveUserId || liveUserId !== deps.expectedUserId) {
      await deps.queueOrphan(uploaded.path);
      throw Object.assign(new Error("Please sign in to publish a video."), {
        code: "auth_required",
      });
    }

    markOptimisticPublishing(clientId, {
      videoPath: uploaded.path,
      now: now(),
    });

    const uploadStartedAt = new Date(record.timestamps.t0 ?? now()).toISOString();
    const published = await deps.publish(
      deps.expectedUserId,
      record,
      uploaded,
      uploadStartedAt
    );

    if (!published.ok) {
      if (published.code === "auth_required" && published.videoPath) {
        await deps.queueOrphan(published.videoPath);
      } else if (published.videoPath) {
        await deps.deleteOwnedObject(deps.expectedUserId, published.videoPath);
        await deps.clearOrphan(published.videoPath);
      }
      markOptimisticFailed(clientId, published.message);
      return getOptimisticWatchRecord(clientId);
    }

    await deps.clearOrphan(uploaded.path);
    const remoteSrc = deps.peekSignedUrl?.(uploaded.path) ?? null;
    const reconciled = reconcileOptimisticWithServer(
      getOptimisticWatchRecord(clientId) ?? record,
      {
        postId: published.postId,
        videoPath: uploaded.path,
        remoteSrc,
        now: now(),
      }
    );
    replaceOptimisticWatchRecord(reconciled);
    return reconciled;
  } catch (error) {
    const message = getErrorMessage(error, "Unable to upload video. Please try again.");
    const authLost =
      error instanceof Error &&
      ((error as { code?: string }).code === "auth_required" ||
        /sign in/i.test(error.message));
    if (uploadedPath && authLost) {
      await deps.queueOrphan(uploadedPath);
    } else if (uploadedPath) {
      await deps.deleteOwnedObject(deps.expectedUserId, uploadedPath);
      await deps.clearOrphan(uploadedPath);
    }
    markOptimisticFailed(clientId, message);
    return getOptimisticWatchRecord(clientId);
  }
}

export async function retryOptimisticPublish(
  clientId: string,
  deps: OptimisticPublishDeps
): Promise<OptimisticWatchRecord | null> {
  const current = getOptimisticWatchRecord(clientId);
  if (!current || current.phase !== "failed" || current.inFlight) {
    return current;
  }
  beginOptimisticRetry(clientId, (deps.now ?? Date.now)());
  return runOptimisticPublishPipeline(clientId, deps);
}
