import { describe, expect, it } from "vitest";

import { applyPlaybackIntent, createPlayerSession } from "./playerSession";
import {
  resolveGatedWatchPlaybackIntent,
  shouldHonorWatchStatusEvent,
  shouldRecreateWatchPlayer,
  shouldStartPlaybackAfterAsset,
  shouldUnmuteWatchAfterFirstFrame,
} from "./playerLifecycle";

const GATE_BASE = {
  nativeReady: true,
  jsReady: true,
  isActive: true,
  shouldPlay: true,
  playerAlive: true,
  ownerGeneration: 2,
  commandGeneration: 2,
  playerMediaId: "post-2",
  visibleMediaId: "post-2",
  playerEpoch: 4,
  visibleEpoch: 4,
  playerPostId: 2,
  visiblePostId: 2,
  platform: "android" as const,
  muted: false,
  volume: 1,
  loop: false,
};

describe("1 readyToPlay cannot start without the visible surface", () => {
  it("blocks play when surfaceAttached is false", () => {
    expect(
      shouldStartPlaybackAfterAsset({
        ...GATE_BASE,
        surfaceAttached: false,
      })
    ).toBe(false);
    const intent = resolveGatedWatchPlaybackIntent({
      ...GATE_BASE,
      surfaceAttached: false,
      firstFrameConfirmed: false,
    });
    expect(intent).toBeNull();
  });
});

describe("2 active surface attached starts under the gate", () => {
  it("starts muted on Android until the first frame", () => {
    const intent = resolveGatedWatchPlaybackIntent({
      ...GATE_BASE,
      surfaceAttached: true,
      firstFrameConfirmed: false,
    });
    expect(intent).toEqual({
      shouldPlay: true,
      muted: true,
      volume: 0,
      loop: false,
      resetPosition: false,
    });
    const session = createPlayerSession();
    applyPlaybackIntent(session.player, intent!);
    expect(session.calls).toContain("play");
    expect(session.player.muted).toBe(true);
    expect(session.player.volume).toBe(0);
    expect(
      shouldRecreateWatchPlayer(
        {
          postKey: "post-2",
          src: "https://cdn.example/2.mp4",
          instanceGeneration: 4,
        },
        {
          postKey: "post-2",
          src: "https://cdn.example/2.mp4",
          instanceGeneration: 4,
        }
      )
    ).toBe(false);
  });
});

describe("3 first frame unmutes", () => {
  it("unmutes only after first-frame confirmation on the active surface", () => {
    expect(
      shouldUnmuteWatchAfterFirstFrame({
        firstFrameConfirmed: false,
        isActive: true,
        shouldPlay: true,
        userMuted: false,
        surfaceAttached: true,
        playerMediaId: "post-2",
        visibleMediaId: "post-2",
      })
    ).toBe(false);
    expect(
      shouldUnmuteWatchAfterFirstFrame({
        firstFrameConfirmed: true,
        isActive: true,
        shouldPlay: true,
        userMuted: false,
        surfaceAttached: true,
        playerMediaId: "post-2",
        visibleMediaId: "post-2",
      })
    ).toBe(true);
    const afterFrame = resolveGatedWatchPlaybackIntent({
      ...GATE_BASE,
      surfaceAttached: true,
      firstFrameConfirmed: true,
    });
    expect(afterFrame?.muted).toBe(false);
    expect(afterFrame?.volume).toBe(1);
    expect(afterFrame?.shouldPlay).toBe(true);
  });
});

describe("4 stale player/post event is ignored", () => {
  it("rejects a previous post, epoch, or media id", () => {
    expect(
      shouldHonorWatchStatusEvent({
        playerAlive: true,
        bound: true,
        eventMediaId: "post-1",
        boundMediaId: "post-2",
      })
    ).toBe(false);
    expect(
      shouldHonorWatchStatusEvent({
        playerAlive: true,
        bound: true,
        eventPostId: 1,
        boundPostId: 2,
      })
    ).toBe(false);
    expect(
      shouldHonorWatchStatusEvent({
        playerAlive: true,
        bound: true,
        eventEpoch: 3,
        boundEpoch: 4,
      })
    ).toBe(false);
    expect(
      shouldStartPlaybackAfterAsset({
        ...GATE_BASE,
        surfaceAttached: true,
        ownerGeneration: 5,
        commandGeneration: 4,
      })
    ).toBe(false);
  });
});
