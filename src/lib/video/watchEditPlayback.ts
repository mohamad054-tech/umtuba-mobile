import {
  clampTrimWindow,
  parseEditFromMediaPipeline,
  type VideoEditState,
} from "@/src/lib/video/videoEditState";

export type WatchTrimBounds = {
  startSec: number;
  endSec: number;
};

export function watchEditFromPipeline(
  mediaPipeline: unknown,
  durationMs: number | null
): VideoEditState {
  return parseEditFromMediaPipeline(mediaPipeline, durationMs);
}

export function resolveWatchTrimBounds(
  edit: VideoEditState | null | undefined,
  durationMs: number | null
): WatchTrimBounds | null {
  if (!edit || durationMs == null || durationMs <= 0) return null;
  const { trimStartMs, trimEndMs } = clampTrimWindow(
    edit.trimStartMs,
    edit.trimEndMs,
    durationMs
  );
  if (trimStartMs <= 0 && trimEndMs >= durationMs - 20) return null;
  if (trimEndMs - trimStartMs < 250) return null;
  return { startSec: trimStartMs / 1000, endSec: trimEndMs / 1000 };
}

export function resolveWatchPlaybackSegments(
  edit: VideoEditState | null | undefined,
  durationMs: number | null
): WatchTrimBounds[] {
  if (!edit || durationMs == null || durationMs <= 0) return [];
  if (edit.segments.length > 1) {
    return edit.segments.map((seg) => ({
      startSec: seg.startMs / 1000,
      endSec: seg.endMs / 1000,
    }));
  }
  const window = resolveWatchTrimBounds(edit, durationMs);
  return window ? [window] : [];
}

export function nextWatchSegmentIndex(
  currentIndex: number,
  segmentCount: number
): number | null {
  if (segmentCount <= 0) return null;
  const next = currentIndex + 1;
  return next < segmentCount ? next : null;
}

export function watchEditAudioScale(edit: VideoEditState | null | undefined): number {
  if (!edit) return 1;
  if (edit.mix.originalAudioEnabled === false) return 0;
  return edit.originalAudioVolume;
}

export function watchAddedSoundScale(edit: VideoEditState | null | undefined): number {
  if (!edit || !edit.soundId) return 0;
  return edit.mix.addedSoundVolume;
}

export function shouldSeekToTrimStart(
  currentTime: number,
  bounds: WatchTrimBounds
): boolean {
  return Number.isFinite(currentTime) && currentTime + 0.04 < bounds.startSec;
}

export function shouldEndAtTrim(
  currentTime: number,
  bounds: WatchTrimBounds
): boolean {
  return Number.isFinite(currentTime) && currentTime + 0.05 >= bounds.endSec;
}
