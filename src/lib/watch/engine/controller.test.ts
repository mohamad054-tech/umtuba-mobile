import { describe, expect, it } from "vitest";

import { createWatchPlaybackController } from "./controller";
import { WATCH_ENGINE_COMMIT_FRACTION } from "./gesture";

const IDS = Array.from({ length: 20 }, (_, i) => `post-${i + 1}`);
const HEIGHT = 2000;

describe("WatchPlaybackController", () => {
  it("keeps one authoritative index writer: swipe -> one target -> one settle", () => {
    const controller = createWatchPlaybackController(IDS);
    controller.beginGesture(0);
    const released = controller.releaseGesture({
      fromIndex: 0,
      dragStartOffset: 0,
      currentOffset: HEIGHT * WATCH_ENGINE_COMMIT_FRACTION,
      itemHeight: HEIGHT,
    });
    expect(released.effects.snap).toEqual({ index: 1, generation: 1 });
    expect(released.state.gesturePhase).toBe("settling");
    expect(released.state.targetIndex).toBe(1);

    const settled = controller.nativeSettled({
      offset: HEIGHT,
      itemHeight: HEIGHT,
    });
    expect(settled.effects.snap).toBeNull();
    expect(settled.state.settledIndex).toBe(1);
    expect(settled.state.visibleIndex).toBe(1);
    expect(settled.state.targetIndex).toBe(1);
    expect(settled.state.gesturePhase).toBe("idle");
  });

  it("treats native settled page as authoritative even if it differs from target", () => {
    const controller = createWatchPlaybackController(IDS);
    controller.beginGesture(2);
    controller.releaseGesture({
      fromIndex: 2,
      dragStartOffset: 2 * HEIGHT,
      currentOffset: 2 * HEIGHT + HEIGHT * 0.3,
      itemHeight: HEIGHT,
    });
    const settled = controller.nativeSettled({
      offset: 2 * HEIGHT,
      itemHeight: HEIGHT,
    });
    expect(settled.effects.snap).toBeNull();
    expect(settled.state.settledIndex).toBe(2);
  });

  it("never emits a second snap after native settle", () => {
    const controller = createWatchPlaybackController(IDS);
    controller.beginGesture(0);
    const first = controller.releaseGesture({
      fromIndex: 0,
      dragStartOffset: 0,
      currentOffset: HEIGHT * 0.25,
      itemHeight: HEIGHT,
    });
    expect(first.effects.snap?.index).toBe(1);
    const again = controller.nativeSettled({
      offset: HEIGHT,
      itemHeight: HEIGHT,
    });
    expect(again.effects.snap).toBeNull();
    const third = controller.nativeSettled({
      offset: HEIGHT,
      itemHeight: HEIGHT,
    });
    expect(third.effects.snap).toBeNull();
  });

  it("holds on a short movement instead of committing", () => {
    const controller = createWatchPlaybackController(IDS);
    controller.beginGesture(0);
    const released = controller.releaseGesture({
      fromIndex: 0,
      dragStartOffset: 0,
      currentOffset: HEIGHT * 0.1,
      itemHeight: HEIGHT,
    });
    expect(released.state.targetIndex).toBe(0);
    expect(released.effects.snap?.index).toBe(0);
  });

  it("supports a deep backward target without growing local retention", () => {
    const controller = createWatchPlaybackController(IDS);
    controller.setMediaIds(IDS);
    controller.beginGesture(15);
    const released = controller.releaseGesture({
      fromIndex: 15,
      dragStartOffset: 15 * HEIGHT,
      currentOffset: 15 * HEIGHT - HEIGHT * 0.25,
      itemHeight: HEIGHT,
    });
    expect(released.state.targetIndex).toBe(14);
    const settled = controller.nativeSettled({
      offset: 14 * HEIGHT,
      itemHeight: HEIGHT,
    });
    const plan = controller.syncCachePlan();
    expect(plan.backwardCache).toHaveLength(5);
    expect(plan.backwardCache).not.toContain("post-1");
    expect(settled.state.settledIndex).toBe(14);
  });

  it("binds a playable source then surface before first frame", () => {
    const controller = createWatchPlaybackController(IDS);
    const unresolved = controller.resolveCurrentSource({
      remoteUrl: "",
    });
    expect(unresolved.kind).toBe("unresolved");
    controller.applyResolvedSource(unresolved);
    expect(controller.getState().playbackSource).toBeNull();

    const resolved = controller.resolveCurrentSource({
      remoteUrl: "https://cdn.example/post-1.mp4",
    });
    expect(resolved.kind).toBe("remote");
    controller.applyResolvedSource(resolved);
    expect(controller.getState().playbackSource?.uri).toBe(
      "https://cdn.example/post-1.mp4"
    );
    expect(controller.getState().surfaceReady).toBe(false);
    expect(controller.getState().firstFrameReady).toBe(false);

    controller.markSurfaceReady("post-1");
    expect(controller.getState().surfaceReady).toBe(true);
    controller.markFirstFrame("post-1");
    expect(controller.getState().firstFrameReady).toBe(true);
  });
});
