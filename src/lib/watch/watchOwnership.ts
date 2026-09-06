/**
 * Single Watch ownership authority.
 *
 * Viewability 80% supplies INTENT only. One committed index owns
 * presentation and, after the previous native player is silenced, audio.
 * Commit must not remount visible cells via extraData generation.
 */

import { applyInactiveAudioTeardown, type PlayerLike } from "./playerSession";

export type WatchOwnershipPlayerSlot = {
  postKey: string;
  src: string;
  instanceGeneration: number;
};

export const WATCH_VIEWABILITY_PERCENT_THRESHOLD = 80;
export const WATCH_MAX_AUDIBLE_PLAYERS = 1;
export const WATCH_MAX_LIVE_PLAYBACK_OWNERS = 1;

export type WatchOwnershipIntentType = "viewability-80" | "auto-next";

export type WatchOwnershipIntent = {
  type: WatchOwnershipIntentType;
  toIndex: number;
  mediaId: string;
  generation: number;
};

export type WatchOwnershipState = {
  committedIndex: number;
  presentationOwner: number;
  audibleOwner: number | null;
  boundMediaId: string | null;
  previousIndex: number | null;
  generation: number;
};

export type WatchPlayerDiagnostic = {
  playerId: string;
  index: number;
  mediaId: string;
  isOwner: boolean;
  playWhenReady: boolean;
  isPlaying: boolean;
  effectiveVolume: number;
  surfaceId: string | null;
};

export function createWatchOwnershipState(
  committedIndex = 0,
  boundMediaId: string | null = null
): WatchOwnershipState {
  return {
    committedIndex,
    presentationOwner: committedIndex,
    audibleOwner: committedIndex,
    boundMediaId,
    previousIndex: null,
    generation: 0,
  };
}

/** Generation is stale-event identity only. It must not enter FlatList extraData. */
export function resolveWatchCommitExtraData(input: {
  activeIndex: number;
  interactionSignature: string;
}): string {
  return `${input.activeIndex}:${input.interactionSignature}`;
}

export function watchCommitExtraDataIncludesGeneration(
  extraData: string
): boolean {
  return /(?:^|:)(?:gen|generation|playbackGeneration)=/i.test(extraData);
}

export function watchCommitRemountsVisibleCell(input: {
  prevExtraData: string;
  nextExtraData: string;
  prevCellKey: string;
  nextCellKey: string;
  prevPlayerSlot: WatchOwnershipPlayerSlot;
  nextPlayerSlot: WatchOwnershipPlayerSlot;
}): boolean {
  if (input.prevCellKey !== input.nextCellKey) return true;
  if (input.prevPlayerSlot.postKey !== input.nextPlayerSlot.postKey) return true;
  if (input.prevPlayerSlot.src !== input.nextPlayerSlot.src) return true;
  return (
    input.prevPlayerSlot.instanceGeneration !==
    input.nextPlayerSlot.instanceGeneration
  );
}

export function isWatchOwnershipAtomic(input: {
  nativeVisiblePage: number;
  committedIndex: number;
  presentationOwner: number;
  boundMediaIndex: number;
  audibleOwner: number | null;
}): boolean {
  if (input.nativeVisiblePage !== input.committedIndex) return false;
  if (input.presentationOwner !== input.committedIndex) return false;
  if (input.boundMediaIndex !== input.committedIndex) return false;
  return (
    input.audibleOwner === null || input.audibleOwner === input.committedIndex
  );
}

export function describeWatchPlayerDiagnostic(input: {
  playerId: string;
  index: number;
  mediaId: string;
  isOwner: boolean;
  playWhenReady: boolean;
  isPlaying: boolean;
  muted: boolean;
  volume: number;
  surfaceId: string | null;
}): WatchPlayerDiagnostic {
  const effectiveVolume =
    input.muted || !input.isOwner ? 0 : Math.max(0, input.volume);
  return {
    playerId: input.playerId,
    index: input.index,
    mediaId: input.mediaId,
    isOwner: input.isOwner,
    playWhenReady: input.isOwner ? input.playWhenReady : false,
    isPlaying: input.isPlaying && input.isOwner,
    effectiveVolume,
    surfaceId: input.surfaceId,
  };
}

export function isNonOwnerNativeSilent(
  player: WatchPlayerDiagnostic
): boolean {
  if (player.isOwner) return true;
  return (
    player.effectiveVolume === 0 &&
    player.playWhenReady === false &&
    !player.isPlaying
  );
}

export function countNativeAudibleOwners(
  players: readonly WatchPlayerDiagnostic[]
): number {
  return players.filter(
    (player) =>
      player.isOwner &&
      player.effectiveVolume > 0 &&
      (player.isPlaying || player.playWhenReady)
  ).length;
}

export function watchViewabilityIsIntentOnly(): true {
  return true;
}

export function shouldHonorViewability80Intent(input: {
  viewableIndex: number;
  committedIndex: number;
  reverseDrag: boolean;
}): boolean {
  if (!Number.isFinite(input.viewableIndex) || input.viewableIndex < 0) {
    return false;
  }
  if (input.viewableIndex === input.committedIndex) return false;
  // Viewability never reverse-commits. Bounce of page 0 after 1→2 is snapback.
  if (input.viewableIndex < input.committedIndex) return false;
  void input.reverseDrag;
  return true;
}

export function shouldCompleteOwnershipTransaction(input: {
  toIndex: number;
  targetMediaId: string;
  targetBoundMediaId: string;
  targetSurfaceAttached: boolean;
  targetPresentationReady: boolean;
}): boolean {
  if (!Number.isFinite(input.toIndex) || input.toIndex < 0) return false;
  if (!input.targetMediaId || input.targetMediaId !== input.targetBoundMediaId) {
    return false;
  }
  return (
    input.targetSurfaceAttached === true &&
    input.targetPresentationReady === true
  );
}

export function applyWatchOwnershipSilence(player: PlayerLike): {
  silenced: boolean;
  effectiveVolume: number;
} {
  const silenced = applyInactiveAudioTeardown(player, { resetPosition: false });
  return { silenced, effectiveVolume: 0 };
}

export function mayUnmuteNewOwner(input: {
  previousSilenced: boolean;
  isPresentationOwner: boolean;
  isAudioOwner: boolean;
  userMuted: boolean;
}): boolean {
  if (!input.previousSilenced) return false;
  if (!input.isPresentationOwner || !input.isAudioOwner) return false;
  return input.userMuted !== true;
}

export function shouldRejectStaleOwnershipEvent(input: {
  eventIndex: number;
  eventMediaId?: string | null;
  eventGeneration?: number | null;
  committedIndex: number;
  committedMediaId: string;
  committedGeneration: number;
}): boolean {
  if (input.eventIndex !== input.committedIndex) return true;
  if (
    input.eventMediaId != null &&
    input.eventMediaId !== input.committedMediaId
  ) {
    return true;
  }
  if (
    input.eventGeneration != null &&
    input.eventGeneration !== input.committedGeneration
  ) {
    return true;
  }
  return false;
}

export function shouldSyncNativePageAfterCommit(input: {
  reason: WatchOwnershipIntentType;
  nativePage: number | null;
  committedIndex: number;
}): boolean {
  if (input.reason !== "auto-next") return false;
  if (input.nativePage == null) return true;
  return input.nativePage !== input.committedIndex;
}

export function resolveWatchBindActiveIndex(input: {
  listIndex: number;
  committedIndex: number;
}): number {
  void input.listIndex;
  return input.committedIndex;
}

export function shouldRetainPreviousOwnerSurface(input: {
  itemIndex: number;
  committedIndex: number;
  previousIndex: number | null;
}): boolean {
  if (input.previousIndex == null) return false;
  if (input.itemIndex === input.committedIndex) return false;
  return input.itemIndex === input.previousIndex;
}

export function shouldAcceptBackwardOwnership(input: {
  toIndex: number;
  fromIndex: number;
  cachedSourceValid: boolean;
  reboundSurface: boolean;
  reboundMediaId: string;
  expectedMediaId: string;
}): boolean {
  if (input.toIndex >= input.fromIndex) return false;
  if (!input.cachedSourceValid) return false;
  if (!input.reboundSurface) return false;
  return input.reboundMediaId === input.expectedMediaId;
}

export function commitWatchOwnership(input: {
  state: WatchOwnershipState;
  toIndex: number;
  mediaId: string;
  previousSilenced: boolean;
}): WatchOwnershipState {
  const from = input.state.committedIndex;
  const nextGeneration =
    from === input.toIndex
      ? input.state.generation
      : input.state.generation + 1;
  return {
    committedIndex: input.toIndex,
    presentationOwner: input.toIndex,
    audibleOwner: input.previousSilenced ? input.toIndex : null,
    boundMediaId: input.mediaId,
    previousIndex: from === input.toIndex ? input.state.previousIndex : from,
    generation: nextGeneration,
  };
}

export function unlockWatchAudibleOwner(
  state: WatchOwnershipState
): WatchOwnershipState {
  return {
    ...state,
    audibleOwner: state.presentationOwner,
  };
}

export function shouldRetireWatchPlayer(input: {
  index: number;
  committedIndex: number;
  previousIndex: number | null;
  preparedIndexes: readonly number[];
}): boolean {
  if (input.index === input.committedIndex) return false;
  if (input.previousIndex != null && input.index === input.previousIndex) {
    return false;
  }
  return !input.preparedIndexes.includes(input.index);
}
