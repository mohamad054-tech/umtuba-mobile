import { describe, expect, it } from "vitest";

import {
  editedAtFromMediaPipeline,
  formatTrimTimestamp,
  isFullSpanTrim,
  mergeMediaPipelineEdit,
  normalizeTrimRange,
  planMediaRevisionSwitch,
  playbackEditFromMediaPipeline,
  shouldRetainPreviousMedia,
  validateTrimRange,
} from "./videoTrim";

describe("video trim IN/OUT", () => {
  it("normalizes in/out inside the duration", () => {
    expect(normalizeTrimRange({ inMs: 1000, outMs: 4000 }, 5000)).toEqual({
      inMs: 1000,
      outMs: 4000,
    });
  });

  it("rejects a span that is too short", () => {
    expect(validateTrimRange({ inMs: 10, outMs: 20 }, 5000).ok).toBe(false);
  });

  it("reads playback points from media_pipeline without dropping overlays", () => {
    const merged = mergeMediaPipelineEdit(
      { overlays: { version: 1, elements: [] }, hls: null },
      {
        trim: { inMs: 500, outMs: 2500 },
        editedAt: "2026-08-29T00:00:00.000Z",
      }
    );
    expect(merged.overlays).toEqual({ version: 1, elements: [] });
    expect(merged.hls).toBeNull();
    expect(playbackEditFromMediaPipeline(merged)).toEqual({
      inMs: 500,
      outMs: 2500,
    });
    expect(editedAtFromMediaPipeline(merged)).toBe("2026-08-29T00:00:00.000Z");
    expect((merged.edit as { trimStartMs?: number }).trimStartMs).toBe(500);
    expect((merged.edit as { trimEndMs?: number }).trimEndMs).toBe(2500);
  });

  it("formats the timeline clock", () => {
    expect(formatTrimTimestamp(6500)).toBe("00:06.5");
  });

  it("treats a full-span trim as unchanged media", () => {
    expect(isFullSpanTrim({ inMs: 0, outMs: 5000 }, 5000)).toBe(true);
    expect(isFullSpanTrim({ inMs: 200, outMs: 5000 }, 5000)).toBe(false);
  });
});

describe("media revision switch", () => {
  const live = "owner/live.mp4";

  it("keeps the live path when the candidate is missing or identical", () => {
    expect(
      planMediaRevisionSwitch({
        livePath: live,
        candidatePath: null,
        validated: true,
      })
    ).toEqual({ action: "keep_live", livePath: live });
    expect(
      planMediaRevisionSwitch({
        livePath: live,
        candidatePath: live,
        validated: true,
      })
    ).toEqual({ action: "keep_live", livePath: live });
  });

  it("aborts an unvalidated candidate and leaves the live path", () => {
    const plan = planMediaRevisionSwitch({
      livePath: live,
      candidatePath: "owner/broken.mp4",
      validated: false,
    });
    expect(plan).toEqual({
      action: "abort",
      livePath: live,
      reason: "Edited media is not ready. The live post was not changed.",
    });
  });

  it("switches only after validation and retains the previous object", () => {
    expect(
      planMediaRevisionSwitch({
        livePath: live,
        candidatePath: "owner/rev2.mp4",
        validated: true,
      })
    ).toEqual({
      action: "switch",
      livePath: "owner/rev2.mp4",
      previousPath: live,
    });
    expect(shouldRetainPreviousMedia(live)).toBe(true);
  });
});
