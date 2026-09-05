/**
 * Physical LTR trim-timeline math. Finger-right always increases time.
 * Chrome may be RTL; gesture deltas are never sign-flipped.
 */

export const TIMELINE_HANDLE_HIT_PX = 48;
export const TIMELINE_MIN_SPAN_MS = 250;
export const TIMELINE_THUMB_COUNT = 10;

export function clampTimelineMs(
  value: number,
  min: number,
  max: number
): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function msFromTimelineX(input: {
  x: number;
  width: number;
  durationMs: number;
}): number {
  if (!Number.isFinite(input.width) || input.width <= 0) return 0;
  if (!Number.isFinite(input.durationMs) || input.durationMs <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, input.x / input.width));
  return Math.round(ratio * input.durationMs);
}

export function xFromTimelineMs(input: {
  ms: number;
  width: number;
  durationMs: number;
}): number {
  if (!Number.isFinite(input.width) || input.width <= 0) return 0;
  if (!Number.isFinite(input.durationMs) || input.durationMs <= 0) return 0;
  return (clampTimelineMs(input.ms, 0, input.durationMs) / input.durationMs) *
    input.width;
}

export function applyInHandleDrag(input: {
  proposedInMs: number;
  outMs: number;
  durationMs: number;
  minSpanMs?: number;
}): { inMs: number; outMs: number } {
  const minSpan = input.minSpanMs ?? TIMELINE_MIN_SPAN_MS;
  const duration = Math.max(minSpan, Math.round(input.durationMs) || 0);
  const outMs = clampTimelineMs(input.outMs, minSpan, duration);
  const inMs = clampTimelineMs(input.proposedInMs, 0, outMs - minSpan);
  return { inMs, outMs };
}

export function applyOutHandleDrag(input: {
  inMs: number;
  proposedOutMs: number;
  durationMs: number;
  minSpanMs?: number;
}): { inMs: number; outMs: number } {
  const minSpan = input.minSpanMs ?? TIMELINE_MIN_SPAN_MS;
  const duration = Math.max(minSpan, Math.round(input.durationMs) || 0);
  const inMs = clampTimelineMs(input.inMs, 0, Math.max(0, duration - minSpan));
  const outMs = clampTimelineMs(input.proposedOutMs, inMs + minSpan, duration);
  return { inMs, outMs };
}

export function applyPlayheadDrag(input: {
  proposedMs: number;
  durationMs: number;
}): number {
  return clampTimelineMs(input.proposedMs, 0, Math.max(0, input.durationMs));
}

export function selectedRangeStyle(input: {
  inMs: number;
  outMs: number;
  durationMs: number;
  width: number;
}): { left: number; width: number } {
  const left = xFromTimelineMs({
    ms: input.inMs,
    width: input.width,
    durationMs: input.durationMs,
  });
  const right = xFromTimelineMs({
    ms: input.outMs,
    width: input.width,
    durationMs: input.durationMs,
  });
  return { left, width: Math.max(8, right - left) };
}

export function timelineThumbStarts(durationMs: number, count = TIMELINE_THUMB_COUNT): number[] {
  const n = Math.max(2, Math.round(count));
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return Array.from({ length: n }, () => 0);
  }
  return Array.from({ length: n }, (_, i) =>
    Math.round((i / n) * durationMs)
  );
}

export function hitTestTimelineHandle(input: {
  x: number;
  inX: number;
  outX: number;
  hitPx?: number;
}): "in" | "out" | "playhead" | null {
  const hit = input.hitPx ?? TIMELINE_HANDLE_HIT_PX;
  const distIn = Math.abs(input.x - input.inX);
  const distOut = Math.abs(input.x - input.outX);
  if (distIn <= hit && distIn <= distOut) return "in";
  if (distOut <= hit) return "out";
  return "playhead";
}
