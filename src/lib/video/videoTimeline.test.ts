import { describe, expect, it } from "vitest";

import {
  applyInHandleDrag,
  applyOutHandleDrag,
  applyPlayheadDrag,
  hitTestTimelineHandle,
  msFromTimelineX,
  selectedRangeStyle,
  TIMELINE_MIN_SPAN_MS,
  xFromTimelineMs,
} from "./videoTimeline";

describe("video timeline handles", () => {
  it("maps physical LTR x to time without flipping", () => {
    expect(msFromTimelineX({ x: 100, width: 200, durationMs: 10_000 })).toBe(
      5000
    );
    expect(xFromTimelineMs({ ms: 2500, width: 200, durationMs: 10_000 })).toBe(
      50
    );
  });

  it("keeps IN before OUT and honors the minimum duration", () => {
    expect(
      applyInHandleDrag({
        proposedInMs: 3900,
        outMs: 4000,
        durationMs: 8000,
      })
    ).toEqual({ inMs: 4000 - TIMELINE_MIN_SPAN_MS, outMs: 4000 });
    expect(
      applyOutHandleDrag({
        inMs: 1000,
        proposedOutMs: 1100,
        durationMs: 8000,
      })
    ).toEqual({ inMs: 1000, outMs: 1000 + TIMELINE_MIN_SPAN_MS });
  });

  it("clamps the playhead and selected range", () => {
    expect(applyPlayheadDrag({ proposedMs: -20, durationMs: 5000 })).toBe(0);
    expect(applyPlayheadDrag({ proposedMs: 9000, durationMs: 5000 })).toBe(5000);
    const range = selectedRangeStyle({
      inMs: 1000,
      outMs: 3000,
      durationMs: 4000,
      width: 200,
    });
    expect(range.left).toBe(50);
    expect(range.width).toBe(100);
  });

  it("prefers the nearer handle inside the hit target", () => {
    expect(
      hitTestTimelineHandle({ x: 12, inX: 10, outX: 180, hitPx: 48 })
    ).toBe("in");
    expect(
      hitTestTimelineHandle({ x: 178, inX: 10, outX: 180, hitPx: 48 })
    ).toBe("out");
  });
});
