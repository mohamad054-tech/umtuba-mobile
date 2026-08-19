import { describe, expect, it } from "vitest";

import { createInitialEditState, serializeEditIntoMediaPipeline } from "./videoEditState";
import {
  resolveWatchTrimBounds,
  shouldEndAtTrim,
  shouldSeekToTrimStart,
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
    expect(shouldSeekToTrimStart(0, { startSec: 1, endSec: 4 })).toBe(true);
    expect(shouldEndAtTrim(4, { startSec: 1, endSec: 4 })).toBe(true);
  });

  it("treats a full-clip window as no trim", () => {
    const edit = createInitialEditState(8_000);
    expect(resolveWatchTrimBounds(edit, 8_000)).toBeNull();
    expect(watchEditAudioScale(edit)).toBe(1);
  });
});
