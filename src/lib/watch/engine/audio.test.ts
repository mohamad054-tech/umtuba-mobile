import { describe, expect, it } from "vitest";

import {
  resolveWatchEngineAudioOwner,
  watchEngineAudioOwnerCount,
} from "./audio";

describe("resolveWatchEngineAudioOwner", () => {
  it("keeps exactly one owner after settle", () => {
    const next = resolveWatchEngineAudioOwner({
      settledMediaId: "post-2",
      incomingMediaId: "post-2",
      incomingFirstFrame: true,
      gesturePhase: "idle",
      mountedMediaIds: ["post-1", "post-2", "post-3"],
    });
    expect(next.owner).toBe("post-2");
    expect(watchEngineAudioOwnerCount(next)).toBe(1);
    expect(next.silence).toEqual(["post-1", "post-3"]);
  });

  it("silences outgoing before incoming becomes audible", () => {
    const settling = resolveWatchEngineAudioOwner({
      settledMediaId: "post-1",
      incomingMediaId: "post-2",
      incomingFirstFrame: false,
      gesturePhase: "settling",
      mountedMediaIds: ["post-1", "post-2"],
    });
    expect(settling.owner).toBeNull();
    expect(settling.silence).toEqual(["post-1", "post-2"]);

    const ready = resolveWatchEngineAudioOwner({
      settledMediaId: "post-1",
      incomingMediaId: "post-2",
      incomingFirstFrame: true,
      gesturePhase: "settling",
      mountedMediaIds: ["post-1", "post-2"],
    });
    expect(ready.owner).toBe("post-2");
    expect(ready.silence).toContain("post-1");
    expect(ready.silence).not.toContain("post-2");
  });
});
