import { describe, expect, it } from "vitest";

import { createTextOverlay, removeOverlay } from "./videoOverlays";
import {
  applyTrimEnvelope,
  clampTrimWindow,
  clearAddedSound,
  createInitialEditState,
  editedDurationMs,
  hasEdits,
  parseEditFromMediaPipeline,
  sanitizeVideoEditState,
  serializeEditIntoMediaPipeline,
} from "./videoEditState";

describe("VIDEO_EDIT_STATE", () => {
  it("starts with a full-clip trim and no overlays", () => {
    const state = createInitialEditState(10_000);
    expect(state.trimStartMs).toBe(0);
    expect(state.trimEndMs).toBe(10_000);
    expect(state.overlays).toEqual([]);
    expect(state.soundId).toBeNull();
    expect(hasEdits(state, 10_000)).toBe(false);
  });

  it("clamps a single start/end window without multi-cut", () => {
    expect(clampTrimWindow(-100, 9_000, 8_000)).toEqual({
      trimStartMs: 0,
      trimEndMs: 8000,
    });
    expect(editedDurationMs(
      { ...createInitialEditState(8_000), trimStartMs: 1_000, trimEndMs: 4_000 },
      8_000
    )).toBe(3000);
  });

  it("keeps overlay + trim metadata non-destructive for publish", () => {
    const overlay = createTextOverlay({ text: "مرحبا Hello" });
    const state = sanitizeVideoEditState(
      {
        trimStartMs: 500,
        trimEndMs: 4_000,
        overlays: [overlay],
        soundId: "11111111-1111-4111-8111-111111111111",
      },
      5_000
    );
    expect(state.overlays[0]?.text).toBe("مرحبا Hello");
    expect(hasEdits(state, 5_000)).toBe(true);
    const pipeline = serializeEditIntoMediaPipeline({ hls: null }, state);
    expect(pipeline.overlays).toMatchObject({ version: 1 });
    expect((pipeline.edit as { soundId: string | null }).soundId).toBe(
      "11111111-1111-4111-8111-111111111111"
    );
  });

  it("reads snake_case sound_id from media_pipeline for Watch", () => {
    const state = sanitizeVideoEditState(
      {
        sound_id: "11111111-1111-4111-8111-111111111111",
        sound_mix: {
          originalAudioEnabled: true,
          originalAudioVolume: 0.25,
          addedSoundVolume: 1,
          soundStartOffsetMs: 0,
        },
      },
      5_000
    );
    expect(state.soundId).toBe("11111111-1111-4111-8111-111111111111");
    expect(state.mix.originalAudioVolume).toBe(0.25);
    expect(state.mix.addedSoundVolume).toBe(1);
  });

  it("deletes an overlay and removes added sound without dropping the original file", () => {
    const overlay = createTextOverlay({ text: "bye" });
    const withSound = {
      ...createInitialEditState(5_000),
      overlays: [overlay],
      soundId: "11111111-1111-4111-8111-111111111111",
    };
    expect(removeOverlay(withSound.overlays, overlay.id)).toEqual([]);
    expect(clearAddedSound(withSound).soundId).toBeNull();
    const trimmed = applyTrimEnvelope(withSound, 1000, 4000, 5000);
    expect(trimmed.trimStartMs).toBe(1000);
    expect(trimmed.trimEndMs).toBe(4000);
  });

  it("loads existing edit metadata and keeps playback working when absent", () => {
    const overlay = createTextOverlay({ text: "kept" });
    const pipeline = serializeEditIntoMediaPipeline(
      { hls: null },
      {
        ...createInitialEditState(8000),
        trimStartMs: 250,
        trimEndMs: 6000,
        segments: [{ startMs: 250, endMs: 6000 }],
        overlays: [overlay],
      }
    );
    const loaded = parseEditFromMediaPipeline(pipeline, 8000);
    expect(loaded.trimStartMs).toBe(250);
    expect(loaded.overlays[0]?.text).toBe("kept");
    const absent = parseEditFromMediaPipeline(null, 8000);
    expect(absent.trimStartMs).toBe(0);
    expect(absent.trimEndMs).toBe(8000);
    expect(absent.overlays).toEqual([]);
  });
});
