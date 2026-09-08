import { describe, expect, it } from "vitest";

import {
  createWatchEngineStartupMarks,
  markWatchEngineStartup,
  watchEngineStartupDurations,
} from "./startup";

describe("watch engine startup marks", () => {
  it("records mount through usable without resetting earlier marks", () => {
    let marks = createWatchEngineStartupMarks(1000);
    marks = markWatchEngineStartup(marks, "watchMountMs", 1100);
    marks = markWatchEngineStartup(marks, "sourceResolvedMs", 1200);
    marks = markWatchEngineStartup(marks, "surfaceAttachedMs", 1300);
    marks = markWatchEngineStartup(marks, "firstFrameMs", 1400);
    const again = markWatchEngineStartup(marks, "firstFrameMs", 1800);
    expect(again.firstFrameMs).toBe(1400);
    expect(again.usableMs).toBe(1400);
    expect(watchEngineStartupDurations(again).usableMs).toBe(400);
  });
});
