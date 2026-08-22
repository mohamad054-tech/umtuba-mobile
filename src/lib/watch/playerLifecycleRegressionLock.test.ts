import { describe, expect, it } from "vitest";

import { shouldMountWatchPlayer } from "@/src/lib/feed/videoStoragePath";
import {
  planWatchSignedUrlWork,
  runPrioritizedSignedUrlJobs,
  WATCH_SIGNED_URL_HIGH_CONCURRENCY,
  WATCH_SIGNED_URL_LOW_CONCURRENCY,
} from "@/src/lib/feed/signedUrlScheduler";
import { shouldApplyResolvedWatchSrc } from "@/src/lib/feed/watchPlaybackPrep";
import {
  VIDEO_HISTORY_STACK_GROWTH,
  watchVideoSwipeStackDelta,
} from "@/src/lib/nav/watchRootExit";
import {
  bumpWatchOwnerGeneration,
  canProduceWatchAudio,
  countAudibleWatchPlayers,
  isWatchAudioOwner,
  resolveWatchPlaybackIntent,
  shouldHonorLatePlayerEvent,
} from "./activePlayerOwnership";
import {
  applyWatchInactiveTeardown,
  bumpWatchLeaveGeneration,
  releaseWatchPlayerBinding,
  resolveInactiveTeardownMode,
  resolveNativePlayerStatusCatchup,
  shouldHonorPlayerEventAfterLeave,
  shouldMountSelectedSoundPlayer,
  shouldStartPlaybackAfterAsset,
  watchWindowMountedIndexes,
} from "./playerLifecycle";
import { shouldLoadPlayer, shouldPlayVideo } from "./playbackPolicy";
import {
  applyPlaybackIntent,
  createPlayerSession,
  isPlayerAlive,
} from "./playerSession";

function feed(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `post-${index + 1}`,
    videoPath: `owner/${index + 1}.mp4`,
    src: "",
  }));
}

describe("1 NO_FEED_WIDE_SIGNED_URL_SERIAL_BLOCKING", () => {
  it("keeps active sign off the rest of the page and skips identical src patches", async () => {
    const plan = planWatchSignedUrlWork({ videos: feed(12), activeIndex: 0 });
    expect(plan.active?.id).toBe("post-1");
    expect(plan.nextHigh).toHaveLength(3);
    expect(plan.all.length).toBeLessThan(12);

    const started: string[] = [];
    let releaseActive!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseActive = resolve;
    });
    let highStartedWhileActiveHeld = false;
    const done = runPrioritizedSignedUrlJobs({
      jobs: [
        {
          id: "active",
          priority: 0,
          run: async () => {
            started.push("active");
            await gate;
            return "active-url";
          },
        },
        {
          id: "next-1",
          priority: 1,
          run: async () => {
            started.push("next-1");
            if (!started.includes("active-finished")) {
              highStartedWhileActiveHeld = started.includes("active");
            }
            return "next-url";
          },
        },
      ],
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(started).toContain("active");
    expect(started).toContain("next-1");
    expect(highStartedWhileActiveHeld).toBe(true);
    expect(WATCH_SIGNED_URL_HIGH_CONCURRENCY).toBe(3);
    expect(WATCH_SIGNED_URL_LOW_CONCURRENCY).toBe(2);
    releaseActive();
    await done;
    expect(shouldApplyResolvedWatchSrc("https://cdn.example/a", "https://cdn.example/a")).toBe(
      false
    );
    expect(shouldApplyResolvedWatchSrc("", "https://cdn.example/a")).toBe(true);
  });
});

describe("2 ONE_ACTIVE_PLAYER_INVARIANT", () => {
  it("allows only one audible owner while iOS may preload ±1", () => {
    expect(watchWindowMountedIndexes(2, 6, "ios")).toEqual([1, 2, 3]);
    expect(watchWindowMountedIndexes(2, 6, "android")).toEqual([2]);
    expect(
      countAudibleWatchPlayers([
        { isActive: false, shouldPlay: false, muted: true, volume: 0, playing: false },
        { isActive: true, shouldPlay: true, muted: false, volume: 1, playing: true },
        { isActive: false, shouldPlay: false, muted: true, volume: 0, playing: true },
      ])
    ).toBe(1);
    expect(shouldMountWatchPlayer({ shouldLoadPlayer: true, src: "" })).toBe(false);
  });
});

describe("3 OLD_PLAYER_AUDIO_CANNOT_SURVIVE_ITEM_CHANGE", () => {
  it("silences A immediately when B becomes active, even if A is not JS-ready", () => {
    const previous = createPlayerSession();
    const next = createPlayerSession();
    applyPlaybackIntent(previous.player, {
      shouldPlay: true,
      muted: false,
      volume: 1,
      loop: true,
    });
    applyWatchInactiveTeardown(previous.player, {
      platform: "ios",
      itemReady: false,
    });
    applyPlaybackIntent(
      next.player,
      resolveWatchPlaybackIntent({
        isActive: true,
        shouldPlay: true,
        muted: false,
        volume: 1,
        loop: false,
      })
    );
    expect(previous.player.muted).toBe(true);
    expect(previous.player.volume).toBe(0);
    expect(previous.player.loop).toBe(false);
    expect(previous.calls).toContain("pause");
    expect(next.calls).toContain("play");
    expect(isWatchAudioOwner(0, 1)).toBe(false);
    expect(isWatchAudioOwner(1, 1)).toBe(true);
    expect(
      countAudibleWatchPlayers([
        {
          isActive: false,
          shouldPlay: false,
          muted: previous.player.muted,
          volume: previous.player.volume,
          playing: false,
        },
        {
          isActive: true,
          shouldPlay: true,
          muted: next.player.muted,
          volume: next.player.volume,
          playing: true,
        },
      ])
    ).toBe(1);
  });
});

describe("4 STALE_ASYNC_PLAYER_CALLBACK_PROTECTION", () => {
  it("ignores late play from the previous ownership generation", () => {
    const previous = createPlayerSession();
    const genA = 0;
    const genB = bumpWatchOwnerGeneration(genA, 0, 1);
    applyWatchInactiveTeardown(previous.player, {
      platform: "ios",
      itemReady: true,
    });
    const callsAfter = previous.calls.slice();
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
    expect(previous.calls).toEqual(callsAfter);
    expect(previous.player.muted).toBe(true);
  });
});

describe("5 ACTIVE_ITEM_PRIORITY", () => {
  it("starts the active item as soon as native or JS reports ready", () => {
    expect(
      shouldStartPlaybackAfterAsset({
        nativeReady: true,
        jsReady: false,
        isActive: true,
        shouldPlay: true,
        playerAlive: true,
        ownerGeneration: 3,
        commandGeneration: 3,
      })
    ).toBe(true);
    expect(
      shouldStartPlaybackAfterAsset({
        nativeReady: false,
        jsReady: false,
        isActive: true,
        shouldPlay: true,
        playerAlive: true,
        ownerGeneration: 3,
        commandGeneration: 3,
      })
    ).toBe(false);
    expect(
      resolveNativePlayerStatusCatchup({
        bound: true,
        nativeStatus: "readyToPlay",
        jsStatus: "loading",
      })
    ).toBe("ready");
    expect(
      resolveNativePlayerStatusCatchup({
        bound: false,
        nativeStatus: "readyToPlay",
        jsStatus: "loading",
      })
    ).toBeNull();
  });
});

describe("6 NEXT_ITEM_PREPARATION_BOUNDED", () => {
  it("preloads neighbors without mounting extra sound players or 10 video players", () => {
    expect(shouldLoadPlayer(1, 0, "ios")).toBe(true);
    expect(shouldLoadPlayer(3, 0, "ios")).toBe(false);
    expect(
      shouldMountSelectedSoundPlayer({
        isActive: false,
        shouldLoadPlayer: true,
        uri: "https://cdn.example/sound.m4a",
      })
    ).toBe(false);
    expect(
      shouldMountSelectedSoundPlayer({
        isActive: true,
        shouldLoadPlayer: true,
        uri: "https://cdn.example/sound.m4a",
      })
    ).toBe(true);
    const plan = planWatchSignedUrlWork({ videos: feed(16), activeIndex: 2 });
    expect(plan.nextHigh).toHaveLength(3);
    expect(plan.nextLow.length).toBeLessThanOrEqual(7);
  });
});

describe("7 PLAYER_RELEASE_CLEANUP", () => {
  it("silences before detach and ignores later ops after release", () => {
    const session = createPlayerSession();
    applyPlaybackIntent(session.player, {
      shouldPlay: true,
      muted: false,
      volume: 1,
      loop: false,
    });
    let dead = false;
    releaseWatchPlayerBinding({
      player: session.player,
      markDead: () => {
        dead = true;
      },
      clearPlayGeneration: () => undefined,
      dropBoundRef: () => undefined,
    });
    expect(dead).toBe(true);
    expect(session.player.muted).toBe(true);
    expect(session.calls).toContain("pause");
    session.release();
    const calls = session.calls.slice();
    session.release();
    expect(session.calls).toEqual(calls);
    expect(isPlayerAlive(session.player)).toBe(false);
  });
});

describe("8 WATCH_LEAVE_REENTRY_CLEANUP", () => {
  it("bumps leave generation and rejects stale events until focus returns", () => {
    const leaveGen = bumpWatchLeaveGeneration(4);
    expect(leaveGen).toBe(5);
    expect(
      shouldHonorPlayerEventAfterLeave({
        screenFocused: false,
        eventGeneration: 4,
        ownerGeneration: 5,
      })
    ).toBe(false);
    expect(
      shouldHonorPlayerEventAfterLeave({
        screenFocused: true,
        eventGeneration: 5,
        ownerGeneration: 5,
      })
    ).toBe(true);
    expect(
      shouldPlayVideo({
        isActive: true,
        appState: "active",
        screenFocused: false,
      })
    ).toBe(false);
  });
});

describe("9 NO_PLAYBACK_HISTORY_GROWTH_REGRESSION", () => {
  it("never grows navigation history on video advance", () => {
    expect(VIDEO_HISTORY_STACK_GROWTH).toBe(0);
    expect(watchVideoSwipeStackDelta(20)).toBe(0);
    expect(watchVideoSwipeStackDelta(0)).toBe(0);
  });
});

describe("10 PREVIOUS_dd86a3_ONE_ACTIVE_PLAYER_BEHAVIOR_PRESERVED", () => {
  it("keeps Android active-only mount and no pause-before-ready", () => {
    expect(watchWindowMountedIndexes(4, 9, "android")).toEqual([4]);
    expect(shouldLoadPlayer(3, 4, "android")).toBe(false);
    expect(
      resolveInactiveTeardownMode({ platform: "android", itemReady: false })
    ).toBe("mute-only");
    expect(
      resolveInactiveTeardownMode({ platform: "android", itemReady: true })
    ).toBe("mute-and-pause");
    expect(
      canProduceWatchAudio({
        isActive: true,
        shouldPlay: true,
        ownerGeneration: 1,
        commandGeneration: 0,
      })
    ).toBe(false);
  });
});
