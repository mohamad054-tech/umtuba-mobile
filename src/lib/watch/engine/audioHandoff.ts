/**
 * Clean-room port of e0ad65e / 3c092f8 onto the aa57b8ae Watch engine.
 *
 * Decision layer (audio.ts) already: no owner while settling until first
 * frame, then only incoming. Native ExoPlayer can still emit the outgoing
 * clip until JS mute lands. This module mutes outgoing immediately and
 * gates incoming unmute until outgoing native playing is confirmed false.
 *
 * Media-id keyed — not the old index/WatchVideoCard slot map.
 */

export const WATCH_ENGINE_AUDIO_MIXING_MODE = "mixWithOthers" as const;
export const AUDIBLE_WATCH_ENGINE_PLAYERS_MAX = 1;

export type WatchEngineAudioPlayerLike = {
  muted: boolean;
  volume: number;
  playing?: boolean;
  pause?: () => void;
};

export type WatchEngineAudioHandoffStep =
  | "identify_outgoing"
  | "mute_outgoing"
  | "pause_outgoing"
  | "hold_incoming_silent"
  | "confirm_outgoing_native_silence"
  | "allow_incoming_unmute";

const slots = new Map<string, WatchEngineAudioPlayerLike>();
const nativePlayingById = new Map<string, boolean>();
const listeners = new Set<() => void>();

let incomingMayUnmute = true;
let pendingOutgoingId: string | null = null;

export function resetWatchEngineAudioHandoffForTests(): void {
  slots.clear();
  nativePlayingById.clear();
  listeners.clear();
  incomingMayUnmute = true;
  pendingOutgoingId = null;
}

function notify(): void {
  for (const listener of [...listeners]) listener();
}

export function subscribeWatchEngineAudioHandoff(
  listener: () => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function planWatchEngineAudioHandoffSteps(): WatchEngineAudioHandoffStep[] {
  return [
    "identify_outgoing",
    "mute_outgoing",
    "pause_outgoing",
    "hold_incoming_silent",
    "confirm_outgoing_native_silence",
    "allow_incoming_unmute",
  ];
}

export function registerWatchEngineAudioPlayer(
  mediaId: string,
  player: WatchEngineAudioPlayerLike | null
): void {
  if (!mediaId) return;
  if (player == null) {
    slots.delete(mediaId);
    nativePlayingById.delete(mediaId);
    return;
  }
  slots.set(mediaId, player);
}

export function getWatchEngineAudioPlayer(
  mediaId: string
): WatchEngineAudioPlayerLike | null {
  return slots.get(mediaId) ?? null;
}

export function silenceOutgoingWatchEngineAudio(
  player: WatchEngineAudioPlayerLike | null | undefined
): { muted: boolean; paused: boolean; silenced: boolean } {
  if (player == null) {
    return { muted: true, paused: true, silenced: true };
  }
  player.muted = true;
  player.volume = 0;
  player.pause?.();
  return {
    muted: player.muted === true && player.volume === 0,
    paused: true,
    silenced: player.muted === true && player.volume === 0,
  };
}

export function holdIncomingWatchEngineAudioSilent(
  player: WatchEngineAudioPlayerLike | null | undefined
): boolean {
  if (player == null) return true;
  player.muted = true;
  player.volume = 0;
  return player.muted === true && player.volume === 0;
}

export function isWatchEngineOutgoingNativeSilenced(
  player: WatchEngineAudioPlayerLike | null | undefined,
  mediaId?: string
): boolean {
  if (mediaId) {
    if (nativePlayingById.get(mediaId) === false) return true;
    if (nativePlayingById.get(mediaId) === true) return false;
  }
  if (player == null) return true;
  if (player.playing === true) return false;
  if (player.playing === false) return true;
  return false;
}

export function canIncomingWatchEngineAudioUnmute(): boolean {
  return incomingMayUnmute;
}

export function canNewWatchEngineAudioBecomeAudible(): boolean {
  if (!incomingMayUnmute) return false;
  if (pendingOutgoingId == null) return true;
  const outgoing = getWatchEngineAudioPlayer(pendingOutgoingId);
  return isWatchEngineOutgoingNativeSilenced(outgoing, pendingOutgoingId);
}

function allowIncomingUnmute(): void {
  incomingMayUnmute = true;
  pendingOutgoingId = null;
  notify();
}

export function confirmWatchEngineOutgoingNativeSilence(
  mediaId: string
): boolean {
  if (!mediaId) return false;
  nativePlayingById.set(mediaId, false);
  if (pendingOutgoingId != null && pendingOutgoingId !== mediaId) {
    notify();
    return false;
  }
  allowIncomingUnmute();
  return true;
}

export function noteWatchEnginePlayerNativePlaying(
  mediaId: string,
  isPlaying: boolean
): void {
  if (!mediaId) return;
  nativePlayingById.set(mediaId, isPlaying);
  if (
    isPlaying !== true &&
    pendingOutgoingId === mediaId &&
    isWatchEngineOutgoingNativeSilenced(
      getWatchEngineAudioPlayer(mediaId),
      mediaId
    )
  ) {
    allowIncomingUnmute();
    return;
  }
  notify();
}

export function runWatchEngineOutgoingAudioHandoff(input: {
  fromMediaId: string | null;
  toMediaId: string | null;
}): {
  outgoingSilenced: boolean;
  incomingHeldSilent: boolean;
  incomingMayUnmute: boolean;
  outgoingNativeSilenced: boolean;
} {
  if (
    !input.fromMediaId ||
    !input.toMediaId ||
    input.fromMediaId === input.toMediaId
  ) {
    incomingMayUnmute = true;
    pendingOutgoingId = null;
    notify();
    return {
      outgoingSilenced: true,
      incomingHeldSilent: true,
      incomingMayUnmute: true,
      outgoingNativeSilenced: true,
    };
  }

  incomingMayUnmute = false;
  pendingOutgoingId = input.fromMediaId;
  const outgoing = getWatchEngineAudioPlayer(input.fromMediaId);
  const incoming = getWatchEngineAudioPlayer(input.toMediaId);
  nativePlayingById.set(input.fromMediaId, outgoing != null);
  const silenced = silenceOutgoingWatchEngineAudio(outgoing);
  const held = holdIncomingWatchEngineAudioSilent(incoming);
  const nativeSilenced = isWatchEngineOutgoingNativeSilenced(
    outgoing,
    input.fromMediaId
  );
  if (nativeSilenced) {
    nativePlayingById.set(input.fromMediaId, false);
    incomingMayUnmute = true;
    pendingOutgoingId = null;
  }
  notify();
  return {
    outgoingSilenced: silenced.silenced,
    incomingHeldSilent: held,
    incomingMayUnmute,
    outgoingNativeSilenced: nativeSilenced,
  };
}
