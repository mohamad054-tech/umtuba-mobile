import { describe, expect, it } from "vitest";

import {
  canNewWatchEngineAudioBecomeAudible,
  confirmWatchEngineOutgoingNativeSilence,
  holdIncomingWatchEngineAudioSilent,
  noteWatchEnginePlayerNativePlaying,
  planWatchEngineAudioHandoffSteps,
  registerWatchEngineAudioPlayer,
  resetWatchEngineAudioHandoffForTests,
  runWatchEngineOutgoingAudioHandoff,
  silenceOutgoingWatchEngineAudio,
} from "./audioHandoff";

function fakePlayer(playing = true) {
  return {
    muted: false,
    volume: 1,
    playing,
    pause() {
      this.playing = false;
    },
  };
}

describe("watch engine audio handoff", () => {
  it("silences outgoing and gates incoming until native playing is false", () => {
    resetWatchEngineAudioHandoffForTests();
    const outgoing = fakePlayer(true);
    const incoming = fakePlayer(false);
    registerWatchEngineAudioPlayer("post-1", outgoing);
    registerWatchEngineAudioPlayer("post-2", incoming);

    expect(planWatchEngineAudioHandoffSteps()).toEqual([
      "identify_outgoing",
      "mute_outgoing",
      "pause_outgoing",
      "hold_incoming_silent",
      "confirm_outgoing_native_silence",
      "allow_incoming_unmute",
    ]);

    const first = runWatchEngineOutgoingAudioHandoff({
      fromMediaId: "post-1",
      toMediaId: "post-2",
    });
    expect(first.outgoingSilenced).toBe(true);
    expect(outgoing.muted).toBe(true);
    expect(outgoing.volume).toBe(0);
    expect(outgoing.playing).toBe(false);
    expect(incoming.muted).toBe(true);
    expect(canNewWatchEngineAudioBecomeAudible()).toBe(false);

    noteWatchEnginePlayerNativePlaying("post-1", true);
    expect(canNewWatchEngineAudioBecomeAudible()).toBe(false);
    noteWatchEnginePlayerNativePlaying("post-1", false);
    expect(canNewWatchEngineAudioBecomeAudible()).toBe(true);
    expect(confirmWatchEngineOutgoingNativeSilence("post-1")).toBe(true);
  });

  it("does not pause a warming incoming neighbor", () => {
    resetWatchEngineAudioHandoffForTests();
    const incoming = fakePlayer(true);
    expect(holdIncomingWatchEngineAudioSilent(incoming)).toBe(true);
    expect(incoming.muted).toBe(true);
    expect(incoming.volume).toBe(0);
    expect(incoming.playing).toBe(true);
    expect(silenceOutgoingWatchEngineAudio(null).silenced).toBe(true);
  });
});
