/**
 * Non-destructive keep-segments on the original timeline.
 * Expo Video cannot remux/export a physical cut; Watch plays these ranges
 * in order against the original uploaded file.
 */

import { TIMELINE_MIN_SPAN_MS } from "./videoTimeline";

export type VideoKeepSegment = {
  startMs: number;
  endMs: number;
};

export const MAX_KEEP_SEGMENTS = 8;

function clampSeg(startMs: number, endMs: number, durationMs: number): VideoKeepSegment | null {
  if (!Number.isFinite(durationMs) || durationMs < TIMELINE_MIN_SPAN_MS) {
    return null;
  }
  const start = Math.max(0, Math.min(durationMs - TIMELINE_MIN_SPAN_MS, Math.round(startMs)));
  const end = Math.max(start + TIMELINE_MIN_SPAN_MS, Math.min(durationMs, Math.round(endMs)));
  if (end - start < TIMELINE_MIN_SPAN_MS) return null;
  return { startMs: start, endMs: end };
}

export function defaultKeepSegments(durationMs: number): VideoKeepSegment[] {
  const one = clampSeg(0, durationMs, durationMs);
  return one ? [one] : [];
}

export function normalizeKeepSegments(
  raw: unknown,
  durationMs: number
): VideoKeepSegment[] {
  if (!Array.isArray(raw)) {
    return defaultKeepSegments(durationMs);
  }
  const next: VideoKeepSegment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const start =
      typeof rec.startMs === "number" ? rec.startMs : Number(rec.start_ms);
    const end = typeof rec.endMs === "number" ? rec.endMs : Number(rec.end_ms);
    const seg = clampSeg(start, end, durationMs);
    if (!seg) continue;
    const last = next[next.length - 1];
    if (last && seg.startMs < last.endMs) {
      if (seg.endMs <= last.endMs) continue;
      last.endMs = seg.endMs;
      continue;
    }
    next.push(seg);
    if (next.length >= MAX_KEEP_SEGMENTS) break;
  }
  return next.length > 0 ? next : defaultKeepSegments(durationMs);
}

export function selectedKeepDurationMs(segments: readonly VideoKeepSegment[]): number {
  return segments.reduce((sum, seg) => sum + Math.max(0, seg.endMs - seg.startMs), 0);
}

export function envelopeFromSegments(segments: readonly VideoKeepSegment[]): {
  trimStartMs: number;
  trimEndMs: number;
} {
  if (segments.length === 0) return { trimStartMs: 0, trimEndMs: 0 };
  return {
    trimStartMs: segments[0]!.startMs,
    trimEndMs: segments[segments.length - 1]!.endMs,
  };
}

export function segmentsFromTrim(
  trimStartMs: number,
  trimEndMs: number,
  durationMs: number
): VideoKeepSegment[] {
  const one = clampSeg(trimStartMs, trimEndMs, durationMs);
  return one ? [one] : defaultKeepSegments(durationMs);
}

export function applyEnvelopeToSegments(
  segments: readonly VideoKeepSegment[],
  inMs: number,
  outMs: number,
  durationMs: number
): VideoKeepSegment[] {
  const envelope = clampSeg(inMs, outMs, durationMs);
  if (!envelope) return normalizeKeepSegments(segments, durationMs);
  const clipped = segments
    .map((seg) =>
      clampSeg(
        Math.max(seg.startMs, envelope.startMs),
        Math.min(seg.endMs, envelope.endMs),
        durationMs
      )
    )
    .filter((seg): seg is VideoKeepSegment => seg != null);
  return clipped.length > 0 ? clipped : [envelope];
}

export function splitKeepSegmentAt(
  segments: readonly VideoKeepSegment[],
  playheadMs: number,
  durationMs: number
): VideoKeepSegment[] | null {
  const index = segments.findIndex(
    (seg) => playheadMs > seg.startMs + 80 && playheadMs < seg.endMs - 80
  );
  if (index < 0) return null;
  if (segments.length >= MAX_KEEP_SEGMENTS) return null;
  const target = segments[index]!;
  const left = clampSeg(target.startMs, playheadMs, durationMs);
  const right = clampSeg(playheadMs, target.endMs, durationMs);
  if (!left || !right) return null;
  return [...segments.slice(0, index), left, right, ...segments.slice(index + 1)];
}

export function deleteKeepSegment(
  segments: readonly VideoKeepSegment[],
  index: number
): VideoKeepSegment[] | null {
  if (segments.length <= 1) return null;
  if (!Number.isInteger(index) || index < 0 || index >= segments.length) {
    return null;
  }
  return segments.filter((_, i) => i !== index);
}

export function pushEditUndo<T>(history: readonly T[], current: T, limit = 20): T[] {
  return [...history, current].slice(-limit);
}

export function popEditUndo<T>(history: readonly T[]): {
  previous: T | null;
  nextHistory: T[];
} {
  if (history.length === 0) {
    return { previous: null, nextHistory: [] };
  }
  const nextHistory = history.slice(0, -1);
  return {
    previous: history[history.length - 1] ?? null,
    nextHistory,
  };
}
