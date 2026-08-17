/**
 * Exclusive Watch audio ownership.
 *
 * Adjacent expo-video players stay mounted for preload. Only the active post
 * may emit audio. Inactive / stale-generation commands must mute+pause and
 * disable native loop so iOS onPlayedToEnd / Android REPEAT_MODE cannot
 * restart the previous clip.
 */

import type { PlaybackIntent } from "./playerSession";
import { clampWatchVolume } from "./playbackPolicy";

export const INACTIVE_WATCH_AUDIO = {
  muted: true,
  volume: 0,
  loop: false,
  shouldPlay: false,
} as const;

export function bumpWatchOwnerGeneration(
  prevGeneration: number,
  prevIndex: number,
  nextIndex: number
): number {
  if (!Number.isFinite(nextIndex) || nextIndex < 0) {
    return Number.isFinite(prevGeneration) && prevGeneration > 0
      ? prevGeneration
      : 0;
  }
  if (prevIndex === nextIndex) {
    return Number.isFinite(prevGeneration) && prevGeneration > 0
      ? prevGeneration
      : 0;
  }
  const base =
    Number.isFinite(prevGeneration) && prevGeneration >= 0 ? prevGeneration : 0;
  return base + 1;
}

export function isWatchAudioOwner(
  index: number,
  activeIndex: number
): boolean {
  return (
    Number.isFinite(index) &&
    Number.isFinite(activeIndex) &&
    index === activeIndex
  );
}

export function canProduceWatchAudio(input: {
  isActive: boolean;
  shouldPlay: boolean;
  ownerGeneration: number;
  commandGeneration: number;
}): boolean {
  if (!input.isActive || !input.shouldPlay) return false;
  if (!Number.isFinite(input.ownerGeneration)) return false;
  if (!Number.isFinite(input.commandGeneration)) return false;
  return input.ownerGeneration === input.commandGeneration;
}

/** Late play / playToEnd / retry from a previous owner must be ignored. */
export function shouldHonorLatePlayerEvent(input: {
  isActive: boolean;
  shouldPlay: boolean;
  ownerGeneration: number;
  eventGeneration: number | null;
  playerAlive?: boolean;
}): boolean {
  if (input.playerAlive === false) return false;
  if (input.eventGeneration == null) return false;
  return canProduceWatchAudio({
    isActive: input.isActive,
    shouldPlay: input.shouldPlay,
    ownerGeneration: input.ownerGeneration,
    commandGeneration: input.eventGeneration,
  });
}

/**
 * Guard for play/pause/mute/loop/seek. Released SharedObjects and stale
 * generations must never be touched. Inactive teardown still requires alive.
 */
export function shouldApplyWatchPlayerOp(input: {
  playerAlive: boolean;
  ownerGeneration: number;
  commandGeneration: number | null;
  requireOwner?: boolean;
  isActive?: boolean;
  shouldPlay?: boolean;
}): boolean {
  if (!input.playerAlive) return false;
  if (input.commandGeneration == null) return false;
  if (!Number.isFinite(input.ownerGeneration)) return false;
  if (!Number.isFinite(input.commandGeneration)) return false;
  if (input.ownerGeneration !== input.commandGeneration) return false;
  if (input.requireOwner) {
    return canProduceWatchAudio({
      isActive: input.isActive === true,
      shouldPlay: input.shouldPlay === true,
      ownerGeneration: input.ownerGeneration,
      commandGeneration: input.commandGeneration,
    });
  }
  return true;
}

/**
 * If native playback starts while this card is not the audio owner,
 * immediately tear down. Do not seek — seek can re-trigger play on iOS.
 */
export function shouldTeardownUnexpectedPlay(input: {
  isPlaying: boolean;
  isActive: boolean;
  shouldPlay: boolean;
}): boolean {
  if (!input.isPlaying) return false;
  return !input.isActive || !input.shouldPlay;
}

export function resolveWatchPlaybackIntent(input: {
  isActive: boolean;
  shouldPlay: boolean;
  muted: boolean;
  volume: number;
  loop: boolean;
}): PlaybackIntent {
  if (!input.isActive) {
    return {
      shouldPlay: false,
      muted: true,
      volume: 0,
      loop: false,
      resetPosition: true,
    };
  }
  if (!input.shouldPlay) {
    return {
      shouldPlay: false,
      muted: true,
      volume: 0,
      loop: false,
      resetPosition: false,
    };
  }
  return {
    shouldPlay: true,
    muted: input.muted,
    volume: clampWatchVolume(input.volume),
    loop: input.loop,
    resetPosition: false,
  };
}

export function countAudibleWatchPlayers(
  players: ReadonlyArray<{
    isActive: boolean;
    shouldPlay: boolean;
    muted: boolean;
    volume: number;
    playing?: boolean;
  }>
): number {
  return players.filter((player) => {
    const playing = player.playing !== false;
    return (
      player.isActive &&
      player.shouldPlay &&
      playing &&
      !player.muted &&
      player.volume > 0
    );
  }).length;
}

export function resolveActivePlayerKey(
  items: ReadonlyArray<{ key: string }>,
  activeIndex: number
): string | null {
  if (!Number.isFinite(activeIndex) || activeIndex < 0) return null;
  return items[activeIndex]?.key ?? null;
}
