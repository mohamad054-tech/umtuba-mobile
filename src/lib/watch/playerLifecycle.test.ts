import { describe, expect, it } from "vitest";

import {
  bumpWatchOwnerGeneration,
  canProduceWatchAudio,
  countAudibleWatchPlayers,
  isWatchAudioOwner,
  resolveWatchPlaybackIntent,
  shouldHonorLatePlayerEvent,
} from "./activePlayerOwnership";
import {
  detachWatchPlayerBinding,
  isRetryHitTargetClear,
  nextPlayerInstanceGeneration,
  resolveRetryTargetPostId,
  shouldApplyWatchTransport,
  shouldCallPlayerMethodsOnUnmount,
  shouldRecreateWatchPlayer,
  watchWindowMountedIndexes,
  watchWindowRemounts,
} from "./playerLifecycle";
import {
  resolveSeekTimeOrNull,
  resolveWatchScrollOffset,
  sanitizeWatchListIndex,
  shouldPlayVideo,
  toWatchListPixels,
} from "./playbackPolicy";
import {
  applyInactiveAudioTeardown,
  applyPlaybackIntent,
  applySeekTime,
  createPlayerSession,
  isPlayerAlive,
} from "./playerSession";

function audibleCount(
  players: Array<{
    isActive: boolean;
    shouldPlay: boolean;
    muted: boolean;
    volume: number;
    playing?: boolean;
  }>
) {
  return countAudibleWatchPlayers(players);
}

describe("TEST_A active A → B ownership", () => {
  it("A loses audio ownership before B becomes audible", () => {
    const a = createPlayerSession();
    const b = createPlayerSession();
    applyPlaybackIntent(a.player, {
      shouldPlay: true,
      muted: false,
      volume: 1,
      loop: false,
    });
    applyPlaybackIntent(
      a.player,
      resolveWatchPlaybackIntent({
        isActive: false,
        shouldPlay: false,
        muted: false,
        volume: 1,
        loop: true,
      })
    );
    applyPlaybackIntent(
      b.player,
      resolveWatchPlaybackIntent({
        isActive: true,
        shouldPlay: true,
        muted: false,
        volume: 1,
        loop: false,
      })
    );

    expect(a.player.muted).toBe(true);
    expect(a.player.volume).toBe(0);
    expect(a.player.loop).toBe(false);
    expect(a.calls).toContain("pause");
    expect(b.calls).toContain("play");
    expect(b.player.muted).toBe(false);
    expect(isWatchAudioOwner(0, 1)).toBe(false);
    expect(isWatchAudioOwner(1, 1)).toBe(true);
    expect(
      audibleCount([
        {
          isActive: false,
          shouldPlay: false,
          muted: a.player.muted,
          volume: a.player.volume,
          playing: false,
        },
        {
          isActive: true,
          shouldPlay: true,
          muted: b.player.muted,
          volume: b.player.volume,
          playing: true,
        },
      ])
    ).toBe(1);
  });
});

describe("TEST_B A → B → C rapidly", () => {
  it("only C is audible at the end", () => {
    let gen = 0;
    gen = bumpWatchOwnerGeneration(gen, 0, 1);
    gen = bumpWatchOwnerGeneration(gen, 1, 2);
    expect(gen).toBe(2);
    expect(
      canProduceWatchAudio({
        isActive: true,
        shouldPlay: true,
        ownerGeneration: gen,
        commandGeneration: 0,
      })
    ).toBe(false);
    expect(
      canProduceWatchAudio({
        isActive: true,
        shouldPlay: true,
        ownerGeneration: gen,
        commandGeneration: gen,
      })
    ).toBe(true);
    expect(
      audibleCount([
        { isActive: false, shouldPlay: false, muted: true, volume: 0, playing: false },
        { isActive: false, shouldPlay: false, muted: true, volume: 0, playing: false },
        { isActive: true, shouldPlay: true, muted: false, volume: 1, playing: true },
      ])
    ).toBe(1);
  });
});

describe("TEST_C B → A backwards", () => {
  it("bumps generation so B cannot keep audio", () => {
    const atB = bumpWatchOwnerGeneration(0, 0, 1);
    const backToA = bumpWatchOwnerGeneration(atB, 1, 0);
    expect(backToA).toBe(2);
    expect(
      shouldHonorLatePlayerEvent({
        isActive: false,
        shouldPlay: false,
        ownerGeneration: backToA,
        eventGeneration: atB,
      })
    ).toBe(false);
    expect(isWatchAudioOwner(0, 0)).toBe(true);
    expect(isWatchAudioOwner(1, 0)).toBe(false);
  });
});

describe("TEST_D partial/cancelled swipe", () => {
  it("same index does not bump ownership", () => {
    expect(bumpWatchOwnerGeneration(4, 2, 2)).toBe(4);
    expect(isWatchAudioOwner(2, 2)).toBe(true);
  });
});

describe("TEST_E stale async callback", () => {
  it("old callback after ownership change cannot reactivate old player", () => {
    const previous = createPlayerSession();
    const genA = 0;
    const genB = bumpWatchOwnerGeneration(genA, 0, 1);
    applyPlaybackIntent(
      previous.player,
      resolveWatchPlaybackIntent({
        isActive: false,
        shouldPlay: false,
        muted: false,
        volume: 1,
        loop: true,
      })
    );
    const callsAfterTeardown = previous.calls.slice();
    if (
      shouldHonorLatePlayerEvent({
        isActive: false,
        shouldPlay: true,
        ownerGeneration: genB,
        eventGeneration: genA,
        playerAlive: isPlayerAlive(previous.player),
      })
    ) {
      applyPlaybackIntent(previous.player, {
        shouldPlay: true,
        muted: false,
        volume: 1,
        loop: true,
      });
    }
    expect(previous.calls).toEqual(callsAfterTeardown);
    expect(previous.player.muted).toBe(true);
    expect(previous.player.loop).toBe(false);
  });
});

describe("TEST_F released player receives no later method call", () => {
  it("apply/seek/teardown no-op after release", () => {
    const session = createPlayerSession();
    applyPlaybackIntent(session.player, {
      shouldPlay: true,
      muted: false,
      volume: 1,
      loop: true,
    });
    session.release();
    const callsAfterRelease = session.calls.slice();
    expect(isPlayerAlive(session.player)).toBe(false);
    expect(
      applyPlaybackIntent(session.player, {
        shouldPlay: true,
        muted: false,
        volume: 1,
        loop: true,
      })
    ).toBe(false);
    expect(applyInactiveAudioTeardown(session.player)).toBe(false);
    expect(applySeekTime(session.player, 3)).toBe(false);
    expect(session.calls).toEqual(callsAfterRelease);
  });
});

describe("TEST_G duplicate release", () => {
  it("second release is harmless and does not call pause again", () => {
    const session = createPlayerSession();
    session.release();
    const calls = session.calls.slice();
    session.release();
    expect(session.released).toBe(true);
    expect(session.calls).toEqual(calls);
  });
});

describe("TEST_H background/resume", () => {
  it("only the active owner can produce audio after resume", () => {
    const backgroundPlay = shouldPlayVideo({
      isActive: true,
      appState: "background",
      screenFocused: true,
    });
    expect(
      resolveWatchPlaybackIntent({
        isActive: true,
        shouldPlay: backgroundPlay,
        muted: false,
        volume: 1,
        loop: false,
      })
    ).toEqual({
      shouldPlay: false,
      muted: true,
      volume: 0,
      loop: false,
      resetPosition: false,
    });
    const resumePlay = shouldPlayVideo({
      isActive: true,
      appState: "active",
      screenFocused: true,
    });
    expect(
      resolveWatchPlaybackIntent({
        isActive: true,
        shouldPlay: resumePlay,
        muted: false,
        volume: 1,
        loop: false,
      }).shouldPlay
    ).toBe(true);
    expect(
      resolveWatchPlaybackIntent({
        isActive: false,
        shouldPlay: resumePlay,
        muted: false,
        volume: 1,
        loop: true,
      }).shouldPlay
    ).toBe(false);
  });
});

describe("TEST_I integer-cast regression", () => {
  it("rounds Fold6 fractional heights and rejects unsafe indexes", () => {
    expect(toWatchListPixels(873.333)).toBe(873);
    expect(toWatchListPixels(Number.NaN)).toBeNull();
    expect(toWatchListPixels(-10)).toBeNull();
    expect(sanitizeWatchListIndex(2)).toBe(2);
    expect(sanitizeWatchListIndex(1.7)).toBeNull();
    expect(sanitizeWatchListIndex(Number.NaN)).toBeNull();
    expect(resolveWatchScrollOffset(2, 873.333)).toBe(1746);
    expect(resolveWatchScrollOffset(1.7, 800)).toBeNull();
    expect(resolveSeekTimeOrNull(0.5, Number.NaN)).toBeNull();
    expect(resolveSeekTimeOrNull(0.5, 12)).toBe(6);
  });
});

describe("unmount detach does not touch the player", () => {
  it("marks dead and drops refs without play/pause/mute", () => {
    const session = createPlayerSession();
    applyPlaybackIntent(session.player, {
      shouldPlay: true,
      muted: false,
      volume: 1,
      loop: false,
    });
    const callsBefore = session.calls.slice();
    let dead = false;
    let generation: number | null = 4;
    let bound: unknown = session.player;
    expect(shouldCallPlayerMethodsOnUnmount()).toBe(false);
    detachWatchPlayerBinding({
      markDead: () => {
        dead = true;
      },
      clearPlayGeneration: () => {
        generation = null;
      },
      dropBoundRef: () => {
        bound = null;
      },
    });
    expect(dead).toBe(true);
    expect(generation).toBeNull();
    expect(bound).toBeNull();
    expect(session.calls).toEqual(callsBefore);
    expect(session.released).toBe(false);
  });
});

describe("A→B→C→B→A player window", () => {
  it("keeps a bounded ±1 window and remounts only distant posts", () => {
    const sequence = [0, 1, 2, 1, 0, 1, 2, 1, 0];
    expect(watchWindowMountedIndexes(0, 5)).toEqual([0, 1]);
    expect(watchWindowMountedIndexes(2, 5)).toEqual([1, 2, 3]);
    const remounts = watchWindowRemounts(sequence, 5);
    expect(remounts).toContain(0);
    expect(remounts.filter((index) => index === 0).length).toBeGreaterThan(1);
    for (const active of sequence) {
      expect(watchWindowMountedIndexes(active, 5).length).toBeLessThanOrEqual(3);
      expect(watchWindowMountedIndexes(active, 5, "android")).toEqual([active]);
    }
  });

  it("does not reset source identity on ownership-only changes", () => {
    const slot = { postKey: "post-7", src: "https://cdn.example/a.mp4", instanceGeneration: 0 };
    expect(
      shouldRecreateWatchPlayer(slot, {
        postKey: "post-7",
        src: "https://cdn.example/a.mp4",
        instanceGeneration: 0,
      })
    ).toBe(false);
    expect(
      shouldRecreateWatchPlayer(slot, {
        postKey: "post-7",
        src: "https://cdn.example/a.mp4",
        instanceGeneration: 1,
      })
    ).toBe(true);
  });
});

describe("transport waits until item ready", () => {
  it("blocks play/pause/seek before ready on both platforms and allows chrome", () => {
    expect(
      shouldApplyWatchTransport({
        playerAlive: true,
        itemReady: false,
        kind: "pause",
        platform: "ios",
      })
    ).toBe(false);
    expect(
      shouldApplyWatchTransport({
        playerAlive: true,
        itemReady: false,
        kind: "play",
        platform: "ios",
      })
    ).toBe(false);
    expect(
      shouldApplyWatchTransport({
        playerAlive: true,
        itemReady: false,
        kind: "chrome",
        platform: "ios",
      })
    ).toBe(true);
    expect(
      shouldApplyWatchTransport({
        playerAlive: true,
        itemReady: false,
        kind: "pause",
        platform: "android",
      })
    ).toBe(false);
    expect(
      shouldApplyWatchTransport({
        playerAlive: true,
        itemReady: false,
        kind: "play",
        platform: "android",
      })
    ).toBe(false);
    expect(
      shouldApplyWatchTransport({
        playerAlive: true,
        itemReady: true,
        kind: "play",
        platform: "ios",
      })
    ).toBe(true);
    expect(
      shouldApplyWatchTransport({
        playerAlive: true,
        itemReady: true,
        kind: "play",
        platform: "android",
      })
    ).toBe(true);
  });
});

describe("Retry recovery generation and hit target", () => {
  it("retries only the current active post and remounts a new generation", () => {
    expect(
      resolveRetryTargetPostId({ activePostId: 9, overlayPostId: 9 })
    ).toBe(9);
    expect(
      resolveRetryTargetPostId({ activePostId: 9, overlayPostId: 3 })
    ).toBeNull();
    expect(nextPlayerInstanceGeneration(0)).toBe(1);
    expect(nextPlayerInstanceGeneration(4)).toBe(5);
    expect(
      isRetryHitTargetClear({ errorVisible: true, tapLayerBlocksRetry: true })
    ).toBe(false);
    expect(
      isRetryHitTargetClear({ errorVisible: true, tapLayerBlocksRetry: false })
    ).toBe(true);
  });
});
