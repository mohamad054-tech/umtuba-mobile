import type { WatchEngineStartupMarks } from "./types";

export function createWatchEngineStartupMarks(
  processStartMs = Date.now()
): WatchEngineStartupMarks {
  return {
    processStartMs,
    watchMountMs: null,
    sourceResolvedMs: null,
    surfaceAttachedMs: null,
    firstFrameMs: null,
    firstAudioMs: null,
    usableMs: null,
  };
}

export function markWatchEngineStartup(
  marks: WatchEngineStartupMarks,
  key: Exclude<keyof WatchEngineStartupMarks, "processStartMs">,
  now = Date.now()
): WatchEngineStartupMarks {
  if (marks[key] != null) return marks;
  const next = { ...marks, [key]: now };
  if (
    next.sourceResolvedMs != null &&
    next.surfaceAttachedMs != null &&
    next.firstFrameMs != null &&
    next.usableMs == null
  ) {
    next.usableMs = now;
  }
  return next;
}

export function watchEngineStartupDurations(marks: WatchEngineStartupMarks): {
  mountMs: number | null;
  sourceMs: number | null;
  surfaceMs: number | null;
  firstFrameMs: number | null;
  firstAudioMs: number | null;
  usableMs: number | null;
} {
  const origin = marks.processStartMs;
  const rel = (value: number | null): number | null =>
    origin == null || value == null ? null : value - origin;
  return {
    mountMs: rel(marks.watchMountMs),
    sourceMs: rel(marks.sourceResolvedMs),
    surfaceMs: rel(marks.surfaceAttachedMs),
    firstFrameMs: rel(marks.firstFrameMs),
    firstAudioMs: rel(marks.firstAudioMs),
    usableMs: rel(marks.usableMs),
  };
}
