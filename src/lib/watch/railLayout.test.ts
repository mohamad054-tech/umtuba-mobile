import { describe, expect, it } from "vitest";

import {
  watchRailBottomOffset,
  watchRailFitsCell,
  watchRailHeight,
  WATCH_RAIL_ACTION_LABEL_MAX_WIDTH,
  WATCH_RAIL_ACTION_MIN_HEIGHT,
  WATCH_RAIL_BOTTOM_EXTRA,
  WATCH_TIMELINE_TRAILING_GUTTER,
} from "./railLayout";

describe("watchRailLayout", () => {
  it("keeps 44pt action targets", () => {
    expect(WATCH_RAIL_ACTION_MIN_HEIGHT).toBe(44);
    expect(watchRailHeight(5)).toBe(5 * 44 + 4 * 8);
    expect(watchRailHeight(6)).toBe(6 * 44 + 5 * 8);
  });

  it("fits owner Delete and other Report/Block on a 667pt cell (iPhone SE 3)", () => {
    // Volume sits left of the rail, so only the top chips reserve rail space.
    const se3 = {
      cellHeight: 667 - 83,
      bottomInset: 34,
      topReserved: 120,
    };
    expect(watchRailFitsCell({ ...se3, actionCount: 5 })).toBe(true);
    expect(watchRailFitsCell({ ...se3, actionCount: 6 })).toBe(true);
  });

  it("fits owner Delete on a 568pt cell after compacting the rail", () => {
    expect(
      watchRailFitsCell({
        cellHeight: 568 - 49,
        actionCount: 5,
        bottomInset: 0,
        topReserved: 120,
      })
    ).toBe(true);
  });

  it("lifts the rail above the timeline clock and keeps labels in-column", () => {
    expect(WATCH_RAIL_BOTTOM_EXTRA).toBeGreaterThanOrEqual(84);
    expect(watchRailBottomOffset(0)).toBe(12 + WATCH_RAIL_BOTTOM_EXTRA);
    expect(WATCH_RAIL_ACTION_LABEL_MAX_WIDTH).toBeLessThanOrEqual(72);
    expect(WATCH_TIMELINE_TRAILING_GUTTER).toBeGreaterThanOrEqual(56);
  });
});
