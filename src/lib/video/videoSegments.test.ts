import { describe, expect, it } from "vitest";

import { createInitialEditState, serializeEditIntoMediaPipeline } from "./videoEditState";
import {
  deleteKeepSegment,
  normalizeKeepSegments,
  popEditUndo,
  pushEditUndo,
  selectedKeepDurationMs,
  splitKeepSegmentAt,
} from "./videoSegments";

describe("split / delete keep segments", () => {
  it("splits at the playhead into two kept ranges", () => {
    const split = splitKeepSegmentAt([{ startMs: 0, endMs: 10_000 }], 4000, 10_000);
    expect(split).toEqual([
      { startMs: 0, endMs: 4000 },
      { startMs: 4000, endMs: 10_000 },
    ]);
  });

  it("deletes a middle segment and keeps the original file representation", () => {
    const afterDelete = deleteKeepSegment(
      [
        { startMs: 0, endMs: 3000 },
        { startMs: 3000, endMs: 7000 },
        { startMs: 7000, endMs: 10_000 },
      ],
      1
    );
    expect(afterDelete).toEqual([
      { startMs: 0, endMs: 3000 },
      { startMs: 7000, endMs: 10_000 },
    ]);
    expect(selectedKeepDurationMs(afterDelete ?? [])).toBe(6000);
    expect(deleteKeepSegment([{ startMs: 0, endMs: 5000 }], 0)).toBeNull();
  });

  it("undo restores the previous segments", () => {
    const current = [{ startMs: 0, endMs: 10_000 }];
    const history = pushEditUndo([], current);
    const split = splitKeepSegmentAt(current, 4000, 10_000);
    expect(split).not.toBeNull();
    const undo = popEditUndo(history);
    expect(undo.previous).toEqual(current);
  });

  it("loads segments from pipeline and ignores a missing edit as full clip", () => {
    const empty = createInitialEditState(8000);
    expect(empty.segments).toEqual([{ startMs: 0, endMs: 8000 }]);
    const pipeline = serializeEditIntoMediaPipeline(null, {
      ...empty,
      segments: [
        { startMs: 0, endMs: 2000 },
        { startMs: 5000, endMs: 8000 },
      ],
    });
    expect(
      normalizeKeepSegments(
        (pipeline.edit as { segments?: unknown }).segments,
        8000
      )
    ).toEqual([
      { startMs: 0, endMs: 2000 },
      { startMs: 5000, endMs: 8000 },
    ]);
  });
});
