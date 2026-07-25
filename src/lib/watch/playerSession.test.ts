import { describe, expect, it } from "vitest";

import {
  applyPlaybackIntent,
  applySeekTime,
  createPlayerSession,
} from "./playerSession";
import { shouldPlayVideo } from "./playbackPolicy";

describe("applyPlaybackIntent", () => {
  it("plays active unmuted session and pauses inactive", () => {
    const session = createPlayerSession();
    applyPlaybackIntent(session.player, {
      shouldPlay: true,
      muted: false,
      volume: 0.8,
      loop: false,
    });
    expect(session.calls).toContain("play");
    expect(session.player.muted).toBe(false);
    expect(session.player.volume).toBe(0.8);
    expect(session.player.loop).toBe(false);

    applyPlaybackIntent(session.player, {
      shouldPlay: false,
      muted: true,
      volume: 0,
      loop: true,
      resetPosition: true,
    });
    expect(session.calls).toContain("pause");
    expect(session.player.currentTime).toBe(0);
    expect(session.player.muted).toBe(true);
    expect(session.player.volume).toBe(0);
    expect(session.player.loop).toBe(true);
  });

  it("background pause keeps position", () => {
    const session = createPlayerSession();
    session.player.currentTime = 12;
    applyPlaybackIntent(session.player, {
      shouldPlay: false,
      muted: true,
      volume: 0,
      loop: true,
      resetPosition: false,
    });
    expect(session.player.currentTime).toBe(12);
  });

  it("background policy forces pause intent", () => {
    const session = createPlayerSession();
    const play = shouldPlayVideo({
      isActive: true,
      appState: "background",
      screenFocused: true,
    });
    applyPlaybackIntent(session.player, {
      shouldPlay: play,
      muted: false,
      volume: 1,
      loop: false,
    });
    expect(session.calls).toEqual(["pause"]);
  });

  it("seeks to a clamped time", () => {
    const session = createPlayerSession();
    expect(applySeekTime(session.player, 4.5)).toBe(true);
    expect(session.player.currentTime).toBe(4.5);
    expect(applySeekTime(session.player, Number.NaN)).toBe(false);
    expect(session.player.currentTime).toBe(4.5);
  });

  it("release cleans up and blocks further play", () => {
    const session = createPlayerSession();
    applyPlaybackIntent(session.player, {
      shouldPlay: true,
      muted: false,
      volume: 1,
      loop: true,
    });
    session.release();
    expect(session.released).toBe(true);
    expect(session.calls).toContain("release");
    expect(() => session.player.play()).toThrow(/after release/);
  });
});
