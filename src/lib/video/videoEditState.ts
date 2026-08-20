/**
 * Non-destructive VIDEO_EDIT_STATE. Preview and Watch composite this
 * state; the source file is not rewritten on every overlay drag.
 */

import {
  DEFAULT_VIDEO_SOUND_MIX,
  sanitizeVideoSoundMix,
  type VideoSoundMix,
} from "@/src/lib/sounds/socialSounds";
import {
  parseOverlays,
  sanitizeOverlayElements,
  serializeOverlays,
  type VideoOverlayElement,
} from "@/src/lib/video/videoOverlays";

export const VIDEO_EDIT_STATE_VERSION = 1 as const;

export type VideoEditState = {
  version: typeof VIDEO_EDIT_STATE_VERSION;
  trimStartMs: number;
  trimEndMs: number;
  overlays: VideoOverlayElement[];
  originalAudioVolume: number;
  soundId: string | null;
  soundTrack: null;
  soundStartMs: number;
  soundVolume: number;
  mix: VideoSoundMix;
};

export function createInitialEditState(durationMs: number | null): VideoEditState {
  const end = durationMs != null && durationMs > 0 ? Math.round(durationMs) : 0;
  return {
    version: VIDEO_EDIT_STATE_VERSION,
    trimStartMs: 0,
    trimEndMs: end,
    overlays: [],
    originalAudioVolume: 1,
    soundId: null,
    soundTrack: null,
    soundStartMs: 0,
    soundVolume: 1,
    mix: { ...DEFAULT_VIDEO_SOUND_MIX },
  };
}

export function clampTrimWindow(
  startMs: number,
  endMs: number,
  durationMs: number | null
): { trimStartMs: number; trimEndMs: number } {
  const duration = durationMs != null && durationMs > 0 ? Math.round(durationMs) : 0;
  if (duration <= 0) {
    return { trimStartMs: 0, trimEndMs: 0 };
  }
  const start = Math.max(0, Math.min(duration - 250, Math.round(startMs) || 0));
  const end = Math.max(start + 250, Math.min(duration, Math.round(endMs) || duration));
  return { trimStartMs: start, trimEndMs: end };
}

export function editedDurationMs(state: VideoEditState, durationMs: number | null): number | null {
  if (durationMs == null || durationMs <= 0) return durationMs;
  const { trimStartMs, trimEndMs } = clampTrimWindow(
    state.trimStartMs,
    state.trimEndMs,
    durationMs
  );
  return Math.max(0, trimEndMs - trimStartMs);
}

export function hasEdits(state: VideoEditState, durationMs: number | null): boolean {
  const initial = createInitialEditState(durationMs);
  return (
    state.trimStartMs !== initial.trimStartMs ||
    state.trimEndMs !== initial.trimEndMs ||
    state.overlays.length > 0 ||
    state.originalAudioVolume !== 1 ||
    state.mix.originalAudioEnabled === false ||
    state.soundId != null
  );
}

export function sanitizeVideoEditState(
  input: unknown,
  durationMs: number | null
): VideoEditState {
  const fallback = createInitialEditState(durationMs);
  if (!input || typeof input !== "object") {
    return fallback;
  }
  const raw = input as Record<string, unknown>;
  const trim = clampTrimWindow(
    Number(raw.trimStartMs),
    Number(raw.trimEndMs) || fallback.trimEndMs,
    durationMs
  );
  const mix = sanitizeVideoSoundMix(raw.mix ?? raw.sound_mix ?? raw);
  const soundId =
    typeof raw.soundId === "string" && raw.soundId
      ? raw.soundId
      : typeof raw.sound_id === "string" && raw.sound_id
        ? raw.sound_id
        : null;
  return {
    version: VIDEO_EDIT_STATE_VERSION,
    trimStartMs: trim.trimStartMs,
    trimEndMs: trim.trimEndMs,
    overlays: sanitizeOverlayElements(raw.overlays),
    originalAudioVolume: mix.originalAudioVolume,
    soundId,
    soundTrack: null,
    soundStartMs: mix.soundStartOffsetMs,
    soundVolume: mix.addedSoundVolume,
    mix,
  };
}

export function serializeEditIntoMediaPipeline(
  existing: Record<string, unknown> | null | undefined,
  state: VideoEditState
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    hls: existing?.hls ?? null,
    dash: existing?.dash ?? null,
    abr: existing?.abr ?? null,
    overlays: serializeOverlays(state.overlays),
    edit: {
      version: VIDEO_EDIT_STATE_VERSION,
      trimStartMs: state.trimStartMs,
      trimEndMs: state.trimEndMs,
      originalAudioVolume: state.originalAudioVolume,
      soundId: state.soundId,
      soundTrack: null,
      soundStartMs: state.soundStartMs,
      soundVolume: state.soundVolume,
      mix: state.mix,
    },
  };
}

export function parseEditFromMediaPipeline(
  mediaPipeline: unknown,
  durationMs: number | null
): VideoEditState {
  if (!mediaPipeline || typeof mediaPipeline !== "object") {
    return createInitialEditState(durationMs);
  }
  const raw = mediaPipeline as Record<string, unknown>;
  const overlays = parseOverlays(raw.overlays);
  const edit = raw.edit && typeof raw.edit === "object" ? raw.edit : raw;
  return sanitizeVideoEditState(
    {
      sound_id: raw.sound_id,
      sound_mix: raw.sound_mix,
      ...(edit as object),
      overlays,
    },
    durationMs
  );
}
