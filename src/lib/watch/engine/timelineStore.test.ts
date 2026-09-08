import { describe, expect, it, vi } from "vitest";

import { createWatchEngineTimelineStore } from "./timelineStore";

describe("watch engine timeline store", () => {
  it("notifies only the matching media listener", () => {
    const store = createWatchEngineTimelineStore();
    const first = vi.fn();
    const second = vi.fn();
    store.subscribe("post-1", first);
    store.subscribe("post-2", second);
    store.set("post-1", { currentTime: 4, duration: 20, ratio: 0.2 });
    expect(store.get("post-1")?.currentTime).toBe(4);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it("ignores sub-200ms ticks so the list callback stays stable", () => {
    const store = createWatchEngineTimelineStore();
    const listener = vi.fn();
    store.subscribe("post-1", listener);
    store.set("post-1", { currentTime: 4, duration: 20, ratio: 0.2 });
    store.set("post-1", { currentTime: 4.1, duration: 20, ratio: 0.205 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
