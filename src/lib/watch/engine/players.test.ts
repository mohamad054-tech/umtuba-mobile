import { describe, expect, it } from "vitest";

import {
  planWatchEnginePlayerSlots,
  shouldMountWatchEnginePlayer,
  WATCH_ENGINE_MAX_PLAYERS,
  watchEnginePlayerCount,
} from "./players";

describe("planWatchEnginePlayerSlots", () => {
  it("keeps at most current + next + previous", () => {
    const slots = planWatchEnginePlayerSlots({
      settledIndex: 10,
      itemCount: 30,
      direction: "forward",
    });
    expect(watchEnginePlayerCount(slots)).toBeLessThanOrEqual(
      WATCH_ENGINE_MAX_PLAYERS
    );
    expect(slots.current).toBe(10);
    expect(slots.next).toBe(11);
    expect(slots.previous).toBeNull();
  });

  it("prepares previous only when direction requires it", () => {
    const back = planWatchEnginePlayerSlots({
      settledIndex: 10,
      itemCount: 30,
      direction: "backward",
    });
    expect(back.previous).toBe(9);
    expect(watchEnginePlayerCount(back)).toBe(3);
  });

  it("does not mount a player per cached disk file", () => {
    const slots = planWatchEnginePlayerSlots({
      settledIndex: 8,
      itemCount: 40,
    });
    expect(watchEnginePlayerCount(slots)).toBeLessThanOrEqual(3);
    expect(shouldMountWatchEnginePlayer({ index: 3, slots })).toBe(false);
    expect(shouldMountWatchEnginePlayer({ index: 20, slots })).toBe(false);
  });
});
