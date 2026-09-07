/**
 * Watch A→B audio handoff. JS mute/pause is not enough: incoming audio
 * stays gated until outgoing native playing is confirmed stopped.
 *
 * NEW_AUDIO_AUDIBLE => OLD_AUDIO_NATIVE_SILENCED
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
 * Bleed was mute-order / native teardown lag, not the mixing mode.
 */
export const WATCH_VIDEO_AUDIO_MIXING_MODE = "mixWithOthers" as const;

export const AUDIBLE_WATCH_PLAYERS_MAX = 1;

const slots = new Map<number, PlayerLike>();
const nativePlayingByIndex = new Map<number, boolean>();
const listeners = new Set<() => void>();

let incomingMayUnmute = true;
let pendingOutgoingIndex: number | null = null;

export function resetWatchAudioHandoffForTests(): void {
  slots.clear();
  nativePlayingByIndex.clear();
  listeners.clear();
  incomingMayUnmute = true;
  pendingOutgoingIndex = null;
}

function notifyWatchAudioHandoffListeners(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}

export function subscribeWatchAudioHandoff(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isWatchOutgoingNativeAudioSilenced(
  player: PlayerLike | null | undefined,
  index?: number
): boolean {
  if (index != null && Number.isFinite(index)) {
    if (nativePlayingByIndex.get(index) === false) return true;
    if (pendingOutgoingIndex === index) {
      return nativePlayingByIndex.get(index) === false;
    }
    if (nativePlayingByIndex.get(index) === true) return false;
  }
  if (player == null) return true;
  if (player.playing === true) return false;
  if (player.playing === false) return true;
  return false;
}

export function canIncomingWatchAudioUnmute(): boolean {
  return incomingMayUnmute;
}

export function canNewWatchAudioBecomeAudible(): boolean {
  if (!incomingMayUnmute) return false;
  if (pendingOutgoingIndex == null) return true;
  const outgoing = getWatchPlayerSlot(pendingOutgoingIndex);
  return isWatchOutgoingNativeAudioSilenced(outgoing, pendingOutgoingIndex);
}

export function registerWatchPlayerSlot(
  index: number,
  player: PlayerLike | null
): void {
  if (!Number.isFinite(index) || index < 0) return;
  if (player == null) {
    slots.delete(index);
    nativePlayingByIndex.delete(index);
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
  | "confirm_outgoing_native_silence"
  | "allow_incoming_unmute";

export function planWatchAudioHandoffSteps(): WatchAudioHandoffStep[] {
  return [
    "identify_outgoing",
    "mute_outgoing",
    "pause_outgoing",
    "hold_incoming_silent",
    "confirm_outgoing_native_silence",
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

function allowIncomingUnmute(): void {
  incomingMayUnmute = true;
  pendingOutgoingIndex = null;
  notifyWatchAudioHandoffListeners();
}

export function confirmWatchOutgoingNativeSilence(index: number): boolean {
  if (!Number.isFinite(index) || index < 0) return false;
  nativePlayingByIndex.set(index, false);
  if (pendingOutgoingIndex != null && pendingOutgoingIndex !== index) {
    notifyWatchAudioHandoffListeners();
    return false;
  }
  allowIncomingUnmute();
  return true;
}

export function noteWatchPlayerNativePlaying(
  index: number,
  isPlaying: boolean
): void {
  if (!Number.isFinite(index) || index < 0) return;
  nativePlayingByIndex.set(index, isPlaying);
  if (
    isPlaying !== true &&
    pendingOutgoingIndex === index &&
    isWatchOutgoingNativeAudioSilenced(getWatchPlayerSlot(index), index)
  ) {
    allowIncomingUnmute();
    return;
  }
  notifyWatchAudioHandoffListeners();
}

export function runWatchOutgoingAudioHandoff(input: {
  fromIndex: number;
  toIndex: number;
}): {
  outgoingSilenced: boolean;
  incomingHeldSilent: boolean;
  incomingMayUnmute: boolean;
  outgoingNativeSilenced: boolean;
} {
  if (
    !Number.isFinite(input.fromIndex) ||
    !Number.isFinite(input.toIndex) ||
    input.fromIndex === input.toIndex
  ) {
    incomingMayUnmute = true;
    pendingOutgoingIndex = null;
    notifyWatchAudioHandoffListeners();
    return {
      outgoingSilenced: true,
      incomingHeldSilent: true,
      incomingMayUnmute: true,
      outgoingNativeSilenced: true,
    };
  }

  incomingMayUnmute = false;
  pendingOutgoingIndex = input.fromIndex;
  const outgoing = getWatchPlayerSlot(input.fromIndex);
  const incoming = getWatchPlayerSlot(input.toIndex);
  if (outgoing == null) {
    nativePlayingByIndex.set(input.fromIndex, false);
  } else {
    nativePlayingByIndex.set(input.fromIndex, true);
  }
  const silenced = silenceOutgoingWatchAudio(outgoing);
  const held = holdIncomingWatchAudioSilent(incoming);
  const nativeSilenced = isWatchOutgoingNativeAudioSilenced(
    outgoing,
    input.fromIndex
  );
  if (nativeSilenced) {
    nativePlayingByIndex.set(input.fromIndex, false);
    incomingMayUnmute = true;
    pendingOutgoingIndex = null;
  }
  notifyWatchAudioHandoffListeners();
  return {
    outgoingSilenced: silenced.silenced,
    incomingHeldSilent: held,
    incomingMayUnmute,
    outgoingNativeSilenced: nativeSilenced,
  };
}

export function countAudibleWatchPlayerInvariant(
  players: Parameters<typeof countAudibleWatchPlayers>[0]
): number {
  return countAudibleWatchPlayers(players);
}
