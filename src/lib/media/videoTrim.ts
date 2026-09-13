/**
 * Video IN/OUT trim — playback metadata + derived-revision helpers.
 *
 * Architecture:
 *   A) Playback in/out stored on posts.media_pipeline.playback (no remux).
 *   B) Optional new processed/uploaded asset, then atomic video_path switch.
 *
 * Spatial crop is not invented here. Existing overlay composition is preserved.
 */

export const VIDEO_TRIM_VERSION = 1 as const;

export type VideoTrimRange = {
  inMs: number;
  outMs: number;
};

export type VideoPlaybackEdit = VideoTrimRange & {
  version: typeof VIDEO_TRIM_VERSION;
};

const MAX_DURATION_MS = 30 * 60 * 1000;
const MIN_SPAN_MS = 250;

export function clampMs(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function normalizeTrimRange(
  input: { inMs?: unknown; outMs?: unknown },
  durationMs: number
): VideoTrimRange | null {
  if (!Number.isFinite(durationMs) || durationMs < MIN_SPAN_MS) {
    return null;
  }
  const max = Math.min(MAX_DURATION_MS, Math.round(durationMs));
  const rawIn =
    typeof input.inMs === "number" && Number.isFinite(input.inMs)
      ? input.inMs
      : 0;
  const rawOut =
    typeof input.outMs === "number" && Number.isFinite(input.outMs)
      ? input.outMs
      : max;
  const inMs = clampMs(rawIn, 0, Math.max(0, max - MIN_SPAN_MS));
  const outMs = clampMs(rawOut, inMs + MIN_SPAN_MS, max);
  if (outMs - inMs < MIN_SPAN_MS) {
    return null;
  }
  return { inMs, outMs };
}

export function isFullSpanTrim(
  range: VideoTrimRange,
  durationMs: number
): boolean {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return true;
  return range.inMs <= 0 && range.outMs >= durationMs - 20;
}

export function validateTrimRange(
  range: VideoTrimRange | null,
  durationMs: number
): { ok: true; range: VideoTrimRange } | { ok: false; message: string } {
  if (
    !range ||
    !Number.isFinite(range.inMs) ||
    !Number.isFinite(range.outMs) ||
    range.outMs - range.inMs < MIN_SPAN_MS
  ) {
    return { ok: false, message: "Set a valid in and out point." };
  }
  const normalized = normalizeTrimRange(range, durationMs);
  if (!normalized) {
    return { ok: false, message: "Set a valid in and out point." };
  }
  return { ok: true, range: normalized };
}

export function serializePlaybackEdit(range: VideoTrimRange): VideoPlaybackEdit {
  return {
    version: VIDEO_TRIM_VERSION,
    inMs: range.inMs,
    outMs: range.outMs,
  };
}

export function playbackEditFromMediaPipeline(
  mediaPipeline: unknown
): VideoTrimRange | null {
  if (!mediaPipeline || typeof mediaPipeline !== "object") {
    return null;
  }
  const blob = mediaPipeline as Record<string, unknown>;
  const playback = blob.playback;
  if (!playback || typeof playback !== "object") {
    return null;
  }
  const rec = playback as Record<string, unknown>;
  return normalizeTrimRange(
    { inMs: rec.inMs, outMs: rec.outMs },
    typeof rec.outMs === "number" && Number.isFinite(rec.outMs)
      ? Math.max(
          rec.outMs,
          typeof rec.inMs === "number" ? rec.inMs + MIN_SPAN_MS : MIN_SPAN_MS
        )
      : MAX_DURATION_MS
  );
}

export function editedAtFromMediaPipeline(
  mediaPipeline: unknown
): string | null {
  if (!mediaPipeline || typeof mediaPipeline !== "object") {
    return null;
  }
  const edit = (mediaPipeline as Record<string, unknown>).edit;
  if (!edit || typeof edit !== "object") {
    return null;
  }
  const editedAt = (edit as Record<string, unknown>).editedAt;
  return typeof editedAt === "string" && editedAt.trim() ? editedAt.trim() : null;
}

export function coverUrlFromMediaPipeline(
  mediaPipeline: unknown
): string | null {
  if (!mediaPipeline || typeof mediaPipeline !== "object") {
    return null;
  }
  const cover = (mediaPipeline as Record<string, unknown>).coverUrl;
  return typeof cover === "string" && /^https?:\/\//i.test(cover.trim())
    ? cover.trim()
    : null;
}

/**
 * Merge trim / edit stamp / cover into the existing media_pipeline blob.
 * Preserves overlays and future HLS/DASH keys. Never drops identity fields.
 * Writes both web playback.inMs/outMs and Android edit.trimStartMs/trimEndMs.
 */
export function mergeMediaPipelineEdit(
  existing: Record<string, unknown> | null | undefined,
  patch: {
    trim?: VideoTrimRange | null;
    editedAt?: string | null;
    previousVideoPath?: string | null;
    coverUrl?: string | null;
    clearCover?: boolean;
  }
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...(existing && typeof existing === "object" ? existing : {}),
  };

  if (patch.trim) {
    next.playback = serializePlaybackEdit(patch.trim);
  }

  if (patch.coverUrl) {
    next.coverUrl = patch.coverUrl;
  } else if (patch.clearCover) {
    delete next.coverUrl;
  }

  const priorEdit =
    next.edit && typeof next.edit === "object"
      ? (next.edit as Record<string, unknown>)
      : {};

  if (patch.trim || patch.editedAt) {
    next.edit = {
      ...priorEdit,
      ...(patch.trim
        ? {
            trimStartMs: patch.trim.inMs,
            trimEndMs: patch.trim.outMs,
          }
        : {}),
      ...(patch.editedAt ? { editedAt: patch.editedAt } : {}),
      ...(patch.previousVideoPath
        ? { previousVideoPath: patch.previousVideoPath }
        : {}),
    };
  }

  return next;
}

export function formatTrimTimestamp(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const totalSec = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const tenths = Math.floor((safe % 1000) / 100);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

/**
 * Revision gate: never point the live post at an unvalidated candidate.
 * On failure the caller must leave livePath untouched.
 */
export function planMediaRevisionSwitch(input: {
  livePath: string;
  candidatePath: string | null | undefined;
  validated: boolean;
}):
  | { action: "keep_live"; livePath: string }
  | { action: "switch"; livePath: string; previousPath: string }
  | { action: "abort"; livePath: string; reason: string } {
  const live = input.livePath.trim();
  const candidate = input.candidatePath?.trim() ?? "";

  if (!candidate || candidate === live) {
    return { action: "keep_live", livePath: live };
  }

  if (!input.validated) {
    return {
      action: "abort",
      livePath: live,
      reason: "Edited media is not ready. The live post was not changed.",
    };
  }

  return { action: "switch", livePath: candidate, previousPath: live };
}

export function shouldRetainPreviousMedia(
  previousPath: string | null | undefined
): boolean {
  return Boolean(previousPath && previousPath.trim());
}
