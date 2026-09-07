/**
 * Watch A→B audio handoff. Mute/pause the outgoing player BEFORE the
 * incoming player may become audible. Prepared neighbors stay silent.
 *
 * Does not write activeIndex, scroll, or attach/detach VideoView.
 */

import { countAudibleWatchPlayers } from "./activePlayerOwnership";
import {
  applyInactiveAudioTeardown,
  runAlivePlayerOp,
  type PlayerLike,
} from "./playerSession";

/**
 * Keep mixWithOthers. Selected-sound overlay and system mixing need it.
 * Bleed was mute-order, not the mixing mode.
 */
export const WATCH_VIDEO_AUDIO_MIXING_MODE = "mixWithOthers" as const;

export const AUDIBLE_WATCH_PLAYERS_MAX = 1;

const slots = new Map<number, PlayerLike>();
let incomingMayUnmute = true;

export function resetWatchAudioHandoffForTests(): void {
  slots.clear();
  incomingMayUnmute = true;
}

export function canIncomingWatchAudioUnmute(): boolean {
  return incomingMayUnmute;
}

export function registerWatchPlayerSlot(
  index: number,
  player: PlayerLike | null
): void {
  if (!Number.isFinite(index) || index < 0) return;
  if (player == null) {
    slots.delete(index);
    return;
  }
  slots.set(index, player);
}

export function getWatchPlayerSlot(index: number): PlayerLike | null {
  return slots.get(index) ?? null;
}

export type WatchAudioHandoffStep =
  | "identify_outgoing"
  | "mute_outgoing"
  | "pause_outgoing"
  | "hold_incoming_silent"
  | "allow_incoming_unmute";

export function planWatchAudioHandoffSteps(): WatchAudioHandoffStep[] {
  return [
    "identify_outgoing",
    "mute_outgoing",
    "pause_outgoing",
    "hold_incoming_silent",
    "allow_incoming_unmute",
  ];
}

/** Mute + volume 0, then pause. Prepared incoming is not paused. */
export function silenceOutgoingWatchAudio(
  player: PlayerLike | null | undefined
): { muted: boolean; paused: boolean; silenced: boolean } {
  if (player == null) {
    return { muted: true, paused: true, silenced: true };
  }
  const ok = applyInactiveAudioTeardown(player, { resetPosition: false });
  if (!ok) {
    return { muted: true, paused: true, silenced: true };
  }
  return {
    muted: player.muted === true && player.volume === 0,
    paused: true,
    silenced: player.muted === true && player.volume === 0,
  };
}

/** Keep a prepared neighbor silent without pausing a warming ExoPlayer. */
export function holdIncomingWatchAudioSilent(
  player: PlayerLike | null | undefined
): boolean {
  if (player == null) return true;
  return runAlivePlayerOp(player, (alive) => {
    alive.muted = true;
    alive.volume = 0;
  });
}

export function runWatchOutgoingAudioHandoff(input: {
  fromIndex: number;
  toIndex: number;
}): {
  outgoingSilenced: boolean;
  incomingHeldSilent: boolean;
  incomingMayUnmute: boolean;
} {
  if (
    !Number.isFinite(input.fromIndex) ||
    !Number.isFinite(input.toIndex) ||
    input.fromIndex === input.toIndex
  ) {
    incomingMayUnmute = true;
    return {
      outgoingSilenced: true,
      incomingHeldSilent: true,
      incomingMayUnmute: true,
    };
  }

  incomingMayUnmute = false;
  const outgoing = getWatchPlayerSlot(input.fromIndex);
  const incoming = getWatchPlayerSlot(input.toIndex);
  const silenced = silenceOutgoingWatchAudio(outgoing);
  const held = holdIncomingWatchAudioSilent(incoming);
  incomingMayUnmute = silenced.silenced;
  return {
    outgoingSilenced: silenced.silenced,
    incomingHeldSilent: held,
    incomingMayUnmute,
  };
}

export function countAudibleWatchPlayerInvariant(
  players: Parameters<typeof countAudibleWatchPlayers>[0]
): number {
  return countAudibleWatchPlayers(players);
}
