import { describe, expect, it } from "vitest";

import {
  applyPlaybackIntent,
  createPlayerSession,
} from "./playerSession";
import { shouldPlayVideo } from "./playbackPolicy";

describe("applyPlaybackIntent", () => {
  it("plays active unmuted session and pauses inactive", () => {
    const session = createPlayerSession();
    applyPlaybackIntent(session.player, { shouldPlay: true, muted: false });
    expect(session.calls).toContain("play");
    expect(session.player.muted).toBe(false);
    expect(session.player.loop).toBe(true);

    applyPlaybackIntent(session.player, {
      shouldPlay: false,
      muted: true,
      resetPosition: true,
    });
    expect(session.calls).toContain("pause");
    expect(session.player.currentTime).toBe(0);
    expect(session.player.muted).toBe(true);
  });

  it("background pause keeps position", () => {
    const session = createPlayerSession();
    session.player.currentTime = 12;
    applyPlaybackIntent(session.player, {
      shouldPlay: false,
      muted: true,
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
    applyPlaybackIntent(session.player, { shouldPlay: play, muted: true });
    expect(session.calls).toEqual(["pause"]);
  });

  it("release cleans up and blocks further play", () => {
    const session = createPlayerSession();
    applyPlaybackIntent(session.player, { shouldPlay: true, muted: true });
    session.release();
    expect(session.released).toBe(true);
    expect(session.calls).toContain("release");
    expect(() => session.player.play()).toThrow(/after release/);
  });
});
