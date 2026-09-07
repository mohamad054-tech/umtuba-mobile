import { afterEach, describe, expect, it } from "vitest";

import { applyPlaybackIntent, createPlayerSession } from "./playerSession";
import { shouldUnmuteWatchAfterFirstFrame } from "./playerLifecycle";
import {
  AUDIBLE_WATCH_PLAYERS_MAX,
  WATCH_VIDEO_AUDIO_MIXING_MODE,
  canIncomingWatchAudioUnmute,
  countAudibleWatchPlayerInvariant,
  holdIncomingWatchAudioSilent,
  planWatchAudioHandoffSteps,
  registerWatchPlayerSlot,
  resetWatchAudioHandoffForTests,
  runWatchOutgoingAudioHandoff,
  silenceOutgoingWatchAudio,
} from "./watchAudioHandoff";

afterEach(() => {
  resetWatchAudioHandoffForTests();
});

function audibleSnapshot(input: {
  outgoing: ReturnType<typeof createPlayerSession>;
  incoming: ReturnType<typeof createPlayerSession>;
  incomingActive: boolean;
}) {
  return countAudibleWatchPlayerInvariant([
    {
      isActive: false,
      shouldPlay: false,
      muted: input.outgoing.player.muted,
      volume: input.outgoing.player.volume,
      playing: false,
    },
    {
      isActive: input.incomingActive,
      shouldPlay: true,
      muted: input.incoming.player.muted,
      volume: input.incoming.player.volume,
      playing: input.incomingActive && !input.incoming.player.muted,
    },
  ]);
}

describe("Watch audio clean handoff", () => {
  it("keeps mixWithOthers and a single audible-player cap", () => {
    expect(WATCH_VIDEO_AUDIO_MIXING_MODE).toBe("mixWithOthers");
    expect(AUDIBLE_WATCH_PLAYERS_MAX).toBe(1);
    expect(planWatchAudioHandoffSteps()).toEqual([
      "identify_outgoing",
      "mute_outgoing",
      "pause_outgoing",
      "hold_incoming_silent",
      "allow_incoming_unmute",
    ]);
  });

  it("mutes outgoing to volume 0 before pause", () => {
    const order: string[] = [];
    const outgoing = createPlayerSession();
    applyPlaybackIntent(outgoing.player, {
      shouldPlay: true,
      muted: false,
      volume: 1,
      loop: true,
    });
    const player = outgoing.player;
    const originalPause = player.pause;
    player.pause = () => {
      order.push(`pause:muted=${player.muted}:vol=${player.volume}`);
      originalPause();
    };
    const result = silenceOutgoingWatchAudio(player);
    expect(result.muted).toBe(true);
    expect(result.paused).toBe(true);
    expect(result.silenced).toBe(true);
    expect(player.muted).toBe(true);
    expect(player.volume).toBe(0);
    expect(player.loop).toBe(false);
    expect(order[0]).toBe("pause:muted=true:vol=0");
    expect(outgoing.calls).toContain("pause");
  });

  it("holds the prepared incoming player silent without pausing it", () => {
    const incoming = createPlayerSession();
    incoming.player.muted = false;
    incoming.player.volume = 1;
    expect(holdIncomingWatchAudioSilent(incoming.player)).toBe(true);
    expect(incoming.player.muted).toBe(true);
    expect(incoming.player.volume).toBe(0);
    expect(incoming.calls).not.toContain("pause");
  });

  it("blocks incoming unmute until outgoing is silenced, then allows exactly one audible player", () => {
    const outgoing = createPlayerSession();
    const incoming = createPlayerSession();
    applyPlaybackIntent(outgoing.player, {
      shouldPlay: true,
      muted: false,
      volume: 1,
      loop: false,
    });
    registerWatchPlayerSlot(0, outgoing.player);
    registerWatchPlayerSlot(1, incoming.player);

    expect(canIncomingWatchAudioUnmute()).toBe(true);
    const handoff = runWatchOutgoingAudioHandoff({ fromIndex: 0, toIndex: 1 });
    expect(handoff.outgoingSilenced).toBe(true);
    expect(handoff.incomingHeldSilent).toBe(true);
    expect(handoff.incomingMayUnmute).toBe(true);
    expect(outgoing.player.muted).toBe(true);
    expect(outgoing.player.volume).toBe(0);
    expect(outgoing.calls).toContain("pause");
    expect(incoming.player.muted).toBe(true);
    expect(incoming.player.volume).toBe(0);
    expect(incoming.calls).not.toContain("pause");
    expect(
      audibleSnapshot({ outgoing, incoming, incomingActive: false })
    ).toBe(0);

    expect(
      shouldUnmuteWatchAfterFirstFrame({
        firstFrameConfirmed: true,
        isActive: true,
        shouldPlay: true,
        userMuted: false,
        surfaceAttached: true,
        outgoingSilenced: false,
      })
    ).toBe(false);
    expect(
      shouldUnmuteWatchAfterFirstFrame({
        firstFrameConfirmed: true,
        isActive: true,
        shouldPlay: true,
        userMuted: false,
        surfaceAttached: true,
        outgoingSilenced: canIncomingWatchAudioUnmute(),
      })
    ).toBe(true);

    applyPlaybackIntent(incoming.player, {
      shouldPlay: true,
      muted: false,
      volume: 1,
      loop: false,
    });
    expect(
      audibleSnapshot({ outgoing, incoming, incomingActive: true })
    ).toBe(AUDIBLE_WATCH_PLAYERS_MAX);
  });

  it("treats a missing outgoing slot as already silenced so the first video can unmute", () => {
    const incoming = createPlayerSession();
    registerWatchPlayerSlot(0, incoming.player);
    const handoff = runWatchOutgoingAudioHandoff({ fromIndex: 0, toIndex: 0 });
    expect(handoff.outgoingSilenced).toBe(true);
    expect(canIncomingWatchAudioUnmute()).toBe(true);
  });

  it("closes the incoming unmute gate before outgoing silence during A→B", () => {
    const outgoing = createPlayerSession();
    const incoming = createPlayerSession();
    applyPlaybackIntent(outgoing.player, {
      shouldPlay: true,
      muted: false,
      volume: 1,
      loop: false,
    });
    registerWatchPlayerSlot(0, outgoing.player);
    registerWatchPlayerSlot(1, incoming.player);

    const seen: boolean[] = [];
    const originalPause = outgoing.player.pause;
    outgoing.player.pause = () => {
      seen.push(canIncomingWatchAudioUnmute());
      originalPause();
    };
    runWatchOutgoingAudioHandoff({ fromIndex: 0, toIndex: 1 });
    expect(seen).toEqual([false]);
    expect(canIncomingWatchAudioUnmute()).toBe(true);
  });
});
