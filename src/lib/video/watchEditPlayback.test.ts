import { describe, expect, it } from "vitest";

import { createInitialEditState, serializeEditIntoMediaPipeline } from "./videoEditState";
import {
  resolveWatchTrimBounds,
  shouldEndAtTrim,
  shouldSeekToTrimStart,
  watchAddedSoundScale,
  watchEditAudioScale,
  watchEditFromPipeline,
} from "./watchEditPlayback";

describe("watch edit playback composite", () => {
  it("reads overlays and trim from media_pipeline for every player", () => {
    const state = {
      ...createInitialEditState(8_000),
      trimStartMs: 1_000,
      trimEndMs: 4_000,
      originalAudioVolume: 0.4,
      mix: {
        originalAudioEnabled: true,
        originalAudioVolume: 0.4,
        addedSoundVolume: 1,
        soundStartOffsetMs: 0,
      },
    };
    const pipeline = serializeEditIntoMediaPipeline(null, state);
    const edit = watchEditFromPipeline(pipeline, 8_000);
    expect(edit.trimStartMs).toBe(1_000);
    expect(resolveWatchTrimBounds(edit, 8_000)).toEqual({
      startSec: 1,
      endSec: 4,
    });
    expect(watchEditAudioScale(edit)).toBe(0.4);
    expect(watchAddedSoundScale(edit)).toBe(0);
    expect(shouldSeekToTrimStart(0, { startSec: 1, endSec: 4 })).toBe(true);
    expect(shouldEndAtTrim(4, { startSec: 1, endSec: 4 })).toBe(true);
  });

  it("treats a full-clip window as no trim", () => {
    const edit = createInitialEditState(8_000);
    expect(resolveWatchTrimBounds(edit, 8_000)).toBeNull();
    expect(watchEditAudioScale(edit)).toBe(1);
    expect(watchAddedSoundScale(edit)).toBe(0);
  });

  it("PUBLISH_AUDIO_PATH: Watch scales selected sound from pipeline mix", () => {
    const state = {
      ...createInitialEditState(8_000),
      soundId: "11111111-1111-4111-8111-111111111111",
      originalAudioVolume: 0.5,
      mix: {
        originalAudioEnabled: true,
        originalAudioVolume: 0.5,
        addedSoundVolume: 1,
        soundStartOffsetMs: 0,
      },
    };
    const pipeline = serializeEditIntoMediaPipeline(null, state);
    const edit = watchEditFromPipeline(pipeline, 8_000);
    expect(edit.soundId).toBe("11111111-1111-4111-8111-111111111111");
    expect(watchEditAudioScale(edit)).toBe(0.5);
    expect(watchAddedSoundScale(edit)).toBe(1);
  });

  it("reads pipeline-level sound_id when edit wrapper is missing", () => {
    const edit = watchEditFromPipeline(
      {
        sound_id: "11111111-1111-4111-8111-111111111111",
        sound_mix: {
          originalAudioEnabled: false,
          originalAudioVolume: 0,
          addedSoundVolume: 1,
          soundStartOffsetMs: 0,
        },
      },
      8_000
    );
    expect(edit.soundId).toBe("11111111-1111-4111-8111-111111111111");
    expect(watchEditAudioScale(edit)).toBe(0);
    expect(watchAddedSoundScale(edit)).toBe(1);
  });
});
