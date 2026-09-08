import { describe, expect, it } from "vitest";

import {
  planWatchEngineDiskWindow,
  WATCH_ENGINE_FORWARD_READY,
  WATCH_ENGINE_PREVIOUS_RETAINED,
} from "./cache";

const IDS = Array.from({ length: 20 }, (_, i) => `post-${i + 1}`);

describe("planWatchEngineDiskWindow", () => {
  it("keeps current + five forward + five previous", () => {
    const plan = planWatchEngineDiskWindow({
      mediaIds: IDS,
      settledIndex: 10,
      previouslyKept: IDS,
    });
    expect(plan.current).toBe("post-11");
    expect(plan.forward).toHaveLength(WATCH_ENGINE_FORWARD_READY);
    expect(plan.previous).toHaveLength(WATCH_ENGINE_PREVIOUS_RETAINED);
    expect(plan.keep).toHaveLength(11);
    expect(plan.olderHistory).toContain("post-1");
    expect(plan.evict).toContain("post-1");
    expect(plan.keep).not.toContain("post-1");
  });

  it("does not keep unlimited history", () => {
    const plan = planWatchEngineDiskWindow({
      mediaIds: IDS,
      settledIndex: 19,
    });
    expect(plan.keep.length).toBeLessThanOrEqual(11);
    expect(plan.olderHistory.length).toBeGreaterThan(0);
  });
});
