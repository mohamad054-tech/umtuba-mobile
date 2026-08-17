import { describe, expect, it } from "vitest";

import {
  applyInactiveAudioTeardown,
  applyPlaybackIntent,
  createPlayerSession,
} from "./playerSession";
import {
  bumpWatchOwnerGeneration,
  canProduceWatchAudio,
  countAudibleWatchPlayers,
  INACTIVE_WATCH_AUDIO,
  isWatchAudioOwner,
  resolveActivePlayerKey,
  resolveWatchPlaybackIntent,
  shouldHonorLatePlayerEvent,
  shouldTeardownUnexpectedPlay,
} from "./activePlayerOwnership";
import { shouldPlayVideo } from "./playbackPolicy";

describe("ONLY_ACTIVE_WATCH_POST_CAN_PLAY_AUDIO", () => {
  it("allows audio only for the matching active index", () => {
    expect(isWatchAudioOwner(1, 1)).toBe(true);
    expect(isWatchAudioOwner(0, 1)).toBe(false);
    expect(isWatchAudioOwner(2, 1)).toBe(false);
  });

  it("bumps ownership generation on A→B and A→B→C, not on same index", () => {
    const afterB = bumpWatchOwnerGeneration(0, 0, 1);
    expect(afterB).toBe(1);
    const afterC = bumpWatchOwnerGeneration(afterB, 1, 2);
    expect(afterC).toBe(2);
    expect(bumpWatchOwnerGeneration(afterC, 2, 2)).toBe(2);
  });

  it("bumps again on fast back B→A", () => {
    const atB = bumpWatchOwnerGeneration(0, 0, 1);
    const backToA = bumpWatchOwnerGeneration(atB, 1, 0);
    expect(backToA).toBe(2);
    expect(
      canProduceWatchAudio({
        isActive: true,
        shouldPlay: true,
        ownerGeneration: backToA,
        commandGeneration: atB,
      })
    ).toBe(false);
  });

  it("rejects late play from the previous generation after A→B", () => {
    const genA = 0;
    const genB = bumpWatchOwnerGeneration(genA, 0, 1);
    expect(
      shouldHonorLatePlayerEvent({
        isActive: false,
        shouldPlay: false,
        ownerGeneration: genB,
        eventGeneration: genA,
      })
    ).toBe(false);
    expect(
      canProduceWatchAudio({
        isActive: true,
        shouldPlay: true,
        ownerGeneration: genB,
        commandGeneration: genB,
      })
    ).toBe(true);
  });

  it("silences inactive cards even when user mute is off and loop would stay on", () => {
    expect(
      resolveWatchPlaybackIntent({
        isActive: false,
        shouldPlay: false,
        muted: false,
        volume: 1,
        loop: true,
      })
    ).toEqual({
      shouldPlay: false,
      muted: true,
      volume: 0,
      loop: false,
      resetPosition: true,
    });
    expect(INACTIVE_WATCH_AUDIO.loop).toBe(false);
    expect(INACTIVE_WATCH_AUDIO.muted).toBe(true);
  });

  it("keeps position when the active card pauses for background, then only that card can resume", () => {
    const backgroundPlay = shouldPlayVideo({
      isActive: true,
      appState: "background",
      screenFocused: true,
    });
    const intent = resolveWatchPlaybackIntent({
      isActive: true,
      shouldPlay: backgroundPlay,
      muted: false,
      volume: 1,
      loop: false,
    });
    expect(intent).toEqual({
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

  it("tears down A and plays only B on active change", () => {
    const previous = createPlayerSession();
    const next = createPlayerSession();
    applyPlaybackIntent(previous.player, {
      shouldPlay: true,
      muted: false,
      volume: 1,
      loop: true,
    });
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
    expect(previous.calls.filter((c) => c === "pause").length).toBeGreaterThanOrEqual(
      1
    );
    expect(next.calls).toContain("play");
    expect(next.player.muted).toBe(false);
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

  it("native unexpected play on an inactive card forces mute+pause without reactivating", () => {
    const previous = createPlayerSession();
    applyInactiveAudioTeardown(previous.player, { resetPosition: true });
    expect(shouldTeardownUnexpectedPlay({
      isPlaying: true,
      isActive: false,
      shouldPlay: false,
    })).toBe(true);
    applyInactiveAudioTeardown(previous.player, { resetPosition: false });
    expect(previous.player.muted).toBe(true);
    expect(previous.player.volume).toBe(0);
    expect(previous.player.loop).toBe(false);
    expect(previous.calls.at(-1)).toBe("pause");
  });

  it("partial/cancel swipe that stays on A does not bump ownership", () => {
    expect(bumpWatchOwnerGeneration(4, 2, 2)).toBe(4);
    expect(isWatchAudioOwner(2, 2)).toBe(true);
  });

  it("resolves a single active player key", () => {
    expect(
      resolveActivePlayerKey([{ key: "a" }, { key: "b" }, { key: "c" }], 1)
    ).toBe("b");
    expect(resolveActivePlayerKey([{ key: "a" }], 3)).toBeNull();
  });

  it("preload adjacent cards are silent and not released", () => {
    const adjacent = createPlayerSession();
    applyPlaybackIntent(
      adjacent.player,
      resolveWatchPlaybackIntent({
        isActive: false,
        shouldPlay: false,
        muted: false,
        volume: 1,
        loop: true,
      })
    );
    expect(adjacent.released).toBe(false);
    expect(adjacent.player.muted).toBe(true);
    expect(adjacent.player.volume).toBe(0);
    expect(adjacent.player.loop).toBe(false);
    expect(adjacent.calls).not.toContain("release");
  });
});
