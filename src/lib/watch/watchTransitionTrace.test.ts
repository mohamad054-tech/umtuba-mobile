import { describe, expect, it } from "vitest";

import {
  markWatchAudioStartOnce,
  markWatchCache,
  markWatchCellBind,
  markWatchTransition,
} from "./watchTransitionTrace";

describe("markWatchTransition", () => {
  it("records Android marks and ignores iOS", () => {
    const android = markWatchTransition("android", "current_end", {
      index: 2,
    });
    expect(android?.phase).toBe("current_end");
    expect(android?.index).toBe(2);
    expect(typeof android?.t).toBe("number");
    expect(markWatchTransition("ios", "current_end")).toBeNull();
  });

  it("records compact Android bind and cache marks without URLs", () => {
    const bind = markWatchCellBind("android", {
      visibleIndex: 1,
      visibleMediaId: "post-2",
      activeIndex: 1,
      activeMediaId: "post-2",
      playerMediaId: "post-2",
      surfaceAttached: true,
      aligned: true,
    });
    expect(bind?.aligned).toBe(true);
    expect(markWatchCellBind("ios", {
      visibleIndex: 1,
      visibleMediaId: "post-2",
      activeIndex: 1,
      activeMediaId: "post-2",
      playerMediaId: "post-2",
      surfaceAttached: true,
      aligned: true,
    })).toBeNull();
    const cache = markWatchCache("android", {
      target: 5,
      cachedIds: ["post-1", "post-2"],
      hits: ["post-1"],
      misses: [],
      evicted: [],
    });
    expect(cache?.target).toBe(5);
    expect(JSON.stringify(cache)).not.toMatch(/https?:\/\//);
  });

  it("emits one audio_start per owner generation", () => {
    const first = markWatchAudioStartOnce("android", {
      index: 1,
      mediaId: "post-826",
      generation: 4,
      lastKey: null,
    });
    expect(first.marked).toBe(true);
    const repeat = markWatchAudioStartOnce("android", {
      index: 1,
      mediaId: "post-826",
      generation: 4,
      lastKey: first.key,
    });
    expect(repeat.marked).toBe(false);
    const next = markWatchAudioStartOnce("android", {
      index: 1,
      mediaId: "post-826",
      generation: 5,
      lastKey: first.key,
    });
    expect(next.marked).toBe(true);
  });
});
