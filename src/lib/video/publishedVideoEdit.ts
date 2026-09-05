/**
 * Owner published-video edit session helpers.
 * Cancel never writes. Save only persists media_pipeline edit instructions.
 */

import type { WatchVideo } from "@/src/contracts/watch";
import {
  parseEditFromMediaPipeline,
  serializeEditIntoMediaPipeline,
  type VideoEditState,
} from "@/src/lib/video/videoEditState";

export function loadPublishedEditorDraft(
  mediaPipeline: unknown,
  durationMs: number | null
): VideoEditState {
  return parseEditFromMediaPipeline(mediaPipeline, durationMs);
}

/** Cancel must not call saveOwnedVideoEditState. */
export function shouldPersistPublishedEditOnCancel(): false {
  return false;
}

export function applySavedPipelineToWatchVideo(
  video: WatchVideo,
  pipeline: Record<string, unknown>
): WatchVideo {
  return { ...video, mediaPipeline: pipeline };
}

export function publishedEditKeepsOriginalSrc(video: WatchVideo): boolean {
  return Boolean(video.videoPath || video.src);
}

export function buildPublishedSavePipeline(
  existing: unknown,
  draft: VideoEditState
): Record<string, unknown> {
  const current =
    existing && typeof existing === "object"
      ? (existing as Record<string, unknown>)
      : null;
  return serializeEditIntoMediaPipeline(current, draft);
}
