import { describe, expect, it } from "vitest";

import { resolveWatchEngineAudioOwner, watchEngineAudioOwnerCount } from "./audio";
import {
  planWatchEngineDiskWindow,
  WATCH_ENGINE_FORWARD_READY,
  WATCH_ENGINE_PREVIOUS_RETAINED,
} from "./cache";
import { createWatchPlaybackController } from "./controller";
import { shouldRequestWatchEngineFeedTail } from "./feedTail";
import {
  resolveWatchEngineReleaseTarget,
  WATCH_ENGINE_COMMIT_FRACTION,
  WATCH_ENGINE_FLICK_PAGES_PER_SEC,
} from "./gesture";
import { planWatchEnginePlayerSlots, watchEnginePlayerCount } from "./players";
import { resolveWatchEngineSource } from "./sourceResolver";
import {
  createWatchEngineStartupMarks,
  markWatchEngineStartup,
} from "./startup";
import {
  resolveWatchEngineReadiness,
  resolveWatchEngineWantsPlay,
  shouldRecreateWatchEnginePlayer,
  shouldStartWatchEnginePlayback,
} from "./readiness";
import { resolveWatchEngineVisualLayer } from "./visual";

const HEIGHT = 2000;
const IDS = Array.from({ length: 140 }, (_, i) => `post-${i + 1}`);

function commitSwipe(
  controller: ReturnType<typeof createWatchPlaybackController>,
  from: number,
  direction: "forward" | "backward"
) {
  controller.beginGesture(from);
  const delta =
    direction === "forward"
      ? HEIGHT * WATCH_ENGINE_COMMIT_FRACTION
      : -HEIGHT * WATCH_ENGINE_COMMIT_FRACTION;
  const released = controller.releaseGesture({
    fromIndex: from,
    dragStartOffset: from * HEIGHT,
    currentOffset: from * HEIGHT + delta,
    itemHeight: HEIGHT,
  });
  expect(released.effects.snap).not.toBeNull();
  expect(released.state.gesturePhase).toBe("settling");
  const target = released.state.targetIndex;
  const settled = controller.nativeSettled({
    offset: target * HEIGHT,
    itemHeight: HEIGHT,
  });
  expect(settled.effects.snap).toBeNull();
  expect(settled.state.settledIndex).toBe(target);
  expect(settled.state.visibleIndex).toBe(target);
  expect(settled.state.targetIndex).toBe(target);
  expect(settled.state.gesturePhase).toBe("idle");
  return settled.state;
}

describe("watch engine local gate", () => {
  it("commits 100 sequential forward transitions with one settle each", () => {
    const controller = createWatchPlaybackController(IDS);
    for (let i = 0; i < 100; i += 1) {
      const state = commitSwipe(controller, i, "forward");
      expect(state.settledIndex).toBe(i + 1);
      expect(state.currentMediaId).toBe(`post-${i + 2}`);
      expect(state.audioOwner === state.currentMediaId || state.audioOwner == null).toBe(
        true
      );
    }
    expect(controller.getState().settledIndex).toBe(100);
  });

  it("walks 20 back, 20 forward, and repeated reversals", () => {
    const controller = createWatchPlaybackController(IDS);
    for (let i = 0; i < 40; i += 1) {
      commitSwipe(controller, i, "forward");
    }
    for (let i = 0; i < 20; i += 1) {
      commitSwipe(controller, 40 - i, "backward");
    }
    expect(controller.getState().settledIndex).toBe(20);
    for (let i = 0; i < 20; i += 1) {
      commitSwipe(controller, 20 + i, "forward");
    }
    expect(controller.getState().settledIndex).toBe(40);
    commitSwipe(controller, 40, "backward");
    commitSwipe(controller, 39, "forward");
    commitSwipe(controller, 40, "backward");
    expect(controller.getState().settledIndex).toBe(39);
  });

  it("commits a 20% swipe and a flick, and holds short travel", () => {
    expect(
      resolveWatchEngineReleaseTarget({
        fromIndex: 3,
        dragStartOffset: 3 * HEIGHT,
        currentOffset: 3 * HEIGHT + HEIGHT * WATCH_ENGINE_COMMIT_FRACTION,
        itemHeight: HEIGHT,
        itemCount: IDS.length,
      })?.reason
    ).toBe("commit");
    expect(
      resolveWatchEngineReleaseTarget({
        fromIndex: 3,
        dragStartOffset: 3 * HEIGHT,
        currentOffset: 3 * HEIGHT + HEIGHT * 0.08,
        itemHeight: HEIGHT,
        itemCount: IDS.length,
        velocityY: HEIGHT * WATCH_ENGINE_FLICK_PAGES_PER_SEC,
      })?.reason
    ).toBe("flick");
    expect(
      resolveWatchEngineReleaseTarget({
        fromIndex: 3,
        dragStartOffset: 3 * HEIGHT,
        currentOffset: 3 * HEIGHT + HEIGHT * 0.05,
        itemHeight: HEIGHT,
        itemCount: IDS.length,
      })?.reason
    ).toBe("hold");
  });

  it("keeps exactly one audio owner and silences outgoing first", () => {
    const settling = resolveWatchEngineAudioOwner({
      settledMediaId: "post-1",
      incomingMediaId: "post-2",
      incomingFirstFrame: false,
      gesturePhase: "settling",
      mountedMediaIds: ["post-1", "post-2"],
    });
    expect(settling.owner).toBeNull();
    const ready = resolveWatchEngineAudioOwner({
      settledMediaId: "post-1",
      incomingMediaId: "post-2",
      incomingFirstFrame: true,
      gesturePhase: "settling",
      mountedMediaIds: ["post-1", "post-2"],
    });
    expect(watchEngineAudioOwnerCount(ready)).toBe(1);
    expect(ready.owner).toBe("post-2");
    expect(ready.silence).toContain("post-1");
  });

  it("keeps the outgoing visual until the target first frame is ready", () => {
    expect(
      resolveWatchEngineVisualLayer({
        targetIndex: 4,
        settledIndex: 3,
        incomingFirstFrame: false,
        incomingSurfaceReady: false,
      })
    ).toBe("outgoing");
    expect(
      resolveWatchEngineVisualLayer({
        targetIndex: 4,
        settledIndex: 3,
        incomingFirstFrame: true,
        incomingSurfaceReady: true,
      })
    ).toBe("incoming");
  });

  it("replenishes forward five and retains previous five", () => {
    const plan = planWatchEngineDiskWindow({
      mediaIds: IDS,
      settledIndex: 40,
      previouslyKept: IDS.slice(0, 50),
    });
    expect(plan.forward).toHaveLength(WATCH_ENGINE_FORWARD_READY);
    expect(plan.previous).toHaveLength(WATCH_ENGINE_PREVIOUS_RETAINED);
    expect(plan.keep).toHaveLength(11);
    expect(plan.olderHistory).toContain("post-1");
    expect(plan.evict).toContain("post-1");
  });

  it("evicts older-than-five local files and falls back to remote", () => {
    const remote = resolveWatchEngineSource({
      mediaId: "post-1",
      retained: {
        uri: "file:///cache/post-1.mp4",
        exists: false,
        bytes: 0,
        complete: false,
      },
      remoteUrl: "https://cdn.example/post-1.mp4",
    });
    expect(remote.kind).toBe("remote");
    expect(remote.uri.startsWith("https://")).toBe(true);
  });

  it("refreshes an expired remote instead of keeping a stale URL", () => {
    const expired = resolveWatchEngineSource({
      mediaId: "post-9",
      remoteUrl: "https://cdn.example/expired.mp4",
      remoteExpired: true,
    });
    expect(expired.needsRefresh).toBe(true);
    expect(expired.uri).toBe("");
    expect(expired.kind).toBe("unresolved");
  });

  it("requests feed-tail append near the end", () => {
    expect(
      shouldRequestWatchEngineFeedTail({
        settledIndex: 16,
        itemCount: 20,
        hasMore: true,
      })
    ).toBe(true);
    const controller = createWatchPlaybackController(IDS.slice(0, 20));
    controller.setMediaIds([...IDS.slice(0, 20), ...IDS.slice(20, 32)]);
    expect(controller.getState().feedLength).toBe(32);
    expect(controller.getState().settledIndex).toBe(0);
  });

  it("cold and warm restore keep a bounded cache window", () => {
    const cold = createWatchPlaybackController(IDS);
    const coldPlan = cold.syncCachePlan();
    expect(coldPlan.forwardCache.length).toBeLessThanOrEqual(5);
    const warm = createWatchPlaybackController(IDS);
    for (let i = 0; i < 8; i += 1) {
      commitSwipe(warm, i, "forward");
    }
    const before = warm.getState().settledIndex;
    warm.setMediaIds(IDS);
    expect(warm.getState().settledIndex).toBe(before);
    const marks = markWatchEngineStartup(
      markWatchEngineStartup(
        markWatchEngineStartup(
          markWatchEngineStartup(
            createWatchEngineStartupMarks(1),
            "watchMountMs",
            2
          ),
          "sourceResolvedMs",
          3
        ),
        "surfaceAttachedMs",
        4
      ),
      "firstFrameMs",
      5
    );
    expect(marks.usableMs).toBe(5);
  });

  it("does not play and stays blocked until the active surface is bound", () => {
    expect(
      shouldStartWatchEnginePlayback({
        wantsPlay: true,
        sourcePlayable: true,
        surfaceAttached: false,
      })
    ).toBe(false);
    expect(
      resolveWatchEngineReadiness({
        sourcePlayable: true,
        surfaceAttached: false,
        firstFrameReady: false,
      })
    ).toBe("blocked");
    expect(
      resolveWatchEngineReadiness({
        sourcePlayable: true,
        surfaceAttached: true,
        firstFrameReady: false,
      })
    ).toBe("ready-buffered");
    expect(
      resolveWatchEngineReadiness({
        sourcePlayable: true,
        surfaceAttached: true,
        firstFrameReady: true,
      })
    ).toBe("ready-to-render");
  });

  it("keeps a user pause after first-frame readiness and does not recreate", () => {
    const wantsPlay = resolveWatchEngineWantsPlay({
      isCurrent: true,
      screenFocused: true,
      userPaused: true,
    });
    expect(wantsPlay).toBe(false);
    expect(
      shouldStartWatchEnginePlayback({
        wantsPlay,
        sourcePlayable: true,
        surfaceAttached: true,
      })
    ).toBe(false);
    expect(
      resolveWatchEngineReadiness({
        sourcePlayable: true,
        surfaceAttached: true,
        firstFrameReady: true,
      })
    ).toBe("ready-to-render");
    expect(
      shouldRecreateWatchEnginePlayer({
        previousMediaId: "post-1",
        nextMediaId: "post-1",
        previousSrc: "https://cdn.example/a.mp4",
        nextSrc: "https://cdn.example/a.mp4",
      })
    ).toBe(false);
  });

  it("never mounts more than three players", () => {
    expect(
      watchEnginePlayerCount(
        planWatchEnginePlayerSlots({
          settledIndex: 50,
          itemCount: 140,
          direction: "backward",
        })
      )
    ).toBeLessThanOrEqual(3);
  });
});
