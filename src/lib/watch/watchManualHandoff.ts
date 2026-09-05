import { shouldMountWatchPlayer } from "@/src/lib/feed/videoStoragePath";
import {
  sanitizeWatchListIndex,
  shouldAttachWatchSurface,
} from "./playbackPolicy";
import {
  decideWatchViewabilityEvidence,
  shouldLoadOwnedWatchPlayer,
} from "./watchActiveIndexArbiter";

/** Direction is known once the drag crosses a fraction of one page. */
const MANUAL_DIRECTION_PAGE_FRACTION = 0.12;

export function resolveManualHandoffTarget(input: {
  fromIndex: number;
  currentOffset: number;
  itemHeight: number;
  itemCount: number;
}): number | null {
  if (!Number.isFinite(input.itemHeight) || input.itemHeight <= 0) {
    return null;
  }
  if (!Number.isFinite(input.itemCount) || input.itemCount <= 0) {
    return null;
  }
  if (!Number.isFinite(input.currentOffset) || input.currentOffset < 0) {
    return null;
  }
  const from = sanitizeWatchListIndex(input.fromIndex);
  if (from == null) return null;
  const delta = input.currentOffset - from * input.itemHeight;
  const threshold = input.itemHeight * MANUAL_DIRECTION_PAGE_FRACTION;
  if (delta >= threshold) {
    const next = from + 1;
    return next < input.itemCount ? next : null;
  }
  if (delta <= -threshold) {
    const prev = from - 1;
    return prev >= 0 ? prev : null;
  }
  return null;
}

export function shouldWarmManualTarget(input: {
  fromIndex: number;
  targetIndex: number | null;
}): boolean {
  const from = sanitizeWatchListIndex(input.fromIndex);
  const target = sanitizeWatchListIndex(input.targetIndex ?? Number.NaN);
  if (from == null || target == null) return false;
  return target !== from;
}

export function resolveProactivePrepareIndexes(input: {
  committedIndex: number;
  itemCount: number;
}): number[] {
  const committed = sanitizeWatchListIndex(input.committedIndex);
  if (committed == null || input.itemCount <= 0) return [];
  const out: number[] = [];
  if (committed - 1 >= 0) out.push(committed - 1);
  if (committed + 1 < input.itemCount) out.push(committed + 1);
  return out;
}

/** Viewability never writes activeIndex. */
export function manualViewabilityMayWriteActiveIndex(): false {
  return decideWatchViewabilityEvidence().mayClaimActiveIndex;
}

export function isWatchPresentationReady(input: {
  surfaceAttached: boolean;
  firstFrame: boolean;
  mediaId: string | null | undefined;
  expectedMediaId: string | null | undefined;
  generation: number;
  expectedGeneration: number;
}): boolean {
  if (input.surfaceAttached !== true || input.firstFrame !== true) return false;
  const mediaId = input.mediaId?.trim() ?? "";
  const expected = input.expectedMediaId?.trim() ?? "";
  if (!mediaId || !expected || mediaId !== expected) return false;
  return (
    Number.isFinite(input.generation) &&
    input.generation === input.expectedGeneration
  );
}

export function shouldRejectOwnedBlackSurface(input: {
  ownedIndex: number;
  targetIndex: number;
  surfaceReady: boolean;
}): boolean {
  return (
    input.ownedIndex === input.targetIndex && input.surfaceReady !== true
  );
}

export function shouldCompleteManualHandoff(input: {
  nativeSettledPage?: number | null;
  targetIndex: number | null;
  targetSurfaceAttached: boolean;
  targetFirstFrame: boolean;
}): boolean {
  const target = sanitizeWatchListIndex(input.targetIndex ?? Number.NaN);
  if (target == null) return false;
  void input.nativeSettledPage;
  return input.targetSurfaceAttached === true && input.targetFirstFrame === true;
}

export function shouldStartManualHandoffAudio(input: {
  targetSurfaceAttached: boolean;
  targetFirstFrame: boolean;
  targetIsActive: boolean;
}): boolean {
  return (
    input.targetSurfaceAttached === true &&
    input.targetFirstFrame === true &&
    input.targetIsActive === true
  );
}

export function shouldReleasePreviousWatchSurface(input: {
  handoffCompleted: boolean;
  claimedTarget: boolean;
  targetFirstFrame: boolean;
}): boolean {
  return (
    input.handoffCompleted === true &&
    input.claimedTarget === true &&
    input.targetFirstFrame === true
  );
}

export function shouldKeepPreviousSurfaceDuringManualHandoff(input: {
  handoffCompleted: boolean;
}): boolean {
  return input.handoffCompleted !== true;
}

export type ManualHandoffCompletionTransaction = {
  claimReason: "handoff-commit";
  applyViewabilityLock: false;
  pinNativeOffset: false;
};

/** Gesture 80% commit must not pin native offset (that fights the finger). */
export function resolveManualHandoffCompletionTransaction(): ManualHandoffCompletionTransaction {
  return {
    claimReason: "handoff-commit",
    applyViewabilityLock: false,
    pinNativeOffset: false,
  };
}

export function resolveAutoNextHandoffCompletionTransaction(): {
  claimReason: "handoff-commit";
  applyViewabilityLock: false;
  pinNativeOffset: true;
} {
  return {
    claimReason: "handoff-commit",
    applyViewabilityLock: false,
    pinNativeOffset: true,
  };
}

/** Settle is evidence only on every platform. It never writes activeIndex. */
export function shouldClaimWatchIndexFromNativeSettle(input: {
  platform?: string | null;
  nativePage: number | null;
  activeIndex: number;
}): boolean {
  void input;
  return false;
}

export function shouldClaimWatchIndexFromScrollToIndex(): false {
  return false;
}

export function resolveAndroidManualSettleAction(input: {
  nativePage: number;
  activeIndex: number;
}): "cancel" | "await-target-ready" {
  if (input.nativePage === input.activeIndex) return "cancel";
  return "await-target-ready";
}

/** Stale settle after a later commit must not retarget the previous page. */
export function shouldIgnoreStaleManualSettle(input: {
  locked: boolean;
  nativePage: number;
  activeIndex: number;
}): boolean {
  if (input.nativePage !== input.activeIndex && input.nativePage === 0) {
    return input.activeIndex >= 1;
  }
  return input.locked === true && input.nativePage !== input.activeIndex;
}

export type ManualHandoffPending = {
  navigationGeneration: number;
  targetIndex: number;
  targetMediaId: string;
};

export type ManualHandoffCancelReason =
  | "return-to-current"
  | "direction-change"
  | "rapid-retarget"
  | "blur-unmount"
  | "feed-identity-change"
  | "stale-first-frame"
  | "share-open";

export function createManualHandoffPending(input: {
  navigationGeneration: number;
  targetIndex: number;
  targetMediaId: string | null | undefined;
}): ManualHandoffPending | null {
  if (
    !Number.isFinite(input.navigationGeneration) ||
    input.navigationGeneration < 0
  ) {
    return null;
  }
  const targetIndex = sanitizeWatchListIndex(input.targetIndex);
  if (targetIndex == null) return null;
  const targetMediaId = input.targetMediaId?.trim() ?? "";
  if (!targetMediaId) return null;
  return {
    navigationGeneration: input.navigationGeneration,
    targetIndex,
    targetMediaId,
  };
}

export function resolveManualHandoffRetarget(input: {
  previousTarget: number | null;
  nextTarget: number | null;
  fromIndex: number;
}): "keep" | "cancel" | "retarget" {
  const from = sanitizeWatchListIndex(input.fromIndex);
  const next = sanitizeWatchListIndex(input.nextTarget ?? Number.NaN);
  if (from == null || next == null || next === from) return "cancel";
  const previous = sanitizeWatchListIndex(input.previousTarget ?? Number.NaN);
  if (previous == null) return "retarget";
  if (previous === next) return "keep";
  return "retarget";
}

export function resolvePendingManualHandoffAction(
  reason: ManualHandoffCancelReason
): "cancel" | "reject-completion" {
  if (reason === "share-open" || reason === "stale-first-frame") {
    return "reject-completion";
  }
  return "cancel";
}

export function shouldCancelPendingManualHandoff(
  reason: ManualHandoffCancelReason
): boolean {
  return resolvePendingManualHandoffAction(reason) === "cancel";
}

export function shouldAcceptPendingManualHandoff(input: {
  pending: ManualHandoffPending | null;
  currentNavigationGeneration: number;
  nativeSettledPage: number | null;
  currentTargetMediaId: string | null;
  firstFrameMediaId: string | null;
  targetSurfaceAttached: boolean;
  targetFirstFrame: boolean;
  screenFocused?: boolean;
  shareSheetOpen?: boolean;
  unmounted?: boolean;
  committedIndex?: number;
}): boolean {
  if (input.pending == null) return false;
  if (input.unmounted === true) return false;
  if (input.screenFocused === false) return false;
  if (input.shareSheetOpen === true) return false;
  if (
    input.currentNavigationGeneration !== input.pending.navigationGeneration
  ) {
    return false;
  }
  const committed = sanitizeWatchListIndex(input.committedIndex ?? Number.NaN);
  const native = sanitizeWatchListIndex(input.nativeSettledPage ?? Number.NaN);
  if (
    committed != null &&
    native === committed &&
    committed !== input.pending.targetIndex
  ) {
    return false;
  }
  if (
    !input.currentTargetMediaId ||
    input.currentTargetMediaId !== input.pending.targetMediaId
  ) {
    return false;
  }
  if (
    !input.firstFrameMediaId ||
    input.firstFrameMediaId !== input.pending.targetMediaId
  ) {
    return false;
  }
  return shouldCompleteManualHandoff({
    targetIndex: input.pending.targetIndex,
    targetSurfaceAttached: input.targetSurfaceAttached,
    targetFirstFrame: input.targetFirstFrame,
  });
}

export function resolveNoFirstFrameManualHandoff(input: {
  currentActiveIndex: number;
}): {
  complete: false;
  keepCurrentIndex: number;
  startTargetAudio: false;
  acceptBlackAsComplete: false;
  claimTarget: false;
} {
  return {
    complete: false,
    keepCurrentIndex: input.currentActiveIndex,
    startTargetAudio: false,
    acceptBlackAsComplete: false,
    claimTarget: false,
  };
}

/** Warmed neighbor must mount VideoView before it is active or first_frame waits deadlock. */
export function shouldMountOffscreenManualTargetVideoView(input: {
  itemIndex: number;
  activeIndex: number;
  warmedTargetIndex: number | null;
  src: string | null | undefined;
  platform?: string | null;
  prepareAdjacentNeighbors?: boolean;
}): boolean {
  const adjacent =
    input.prepareAdjacentNeighbors === true &&
    Math.abs(input.itemIndex - input.activeIndex) === 1;
  if (input.itemIndex === input.activeIndex) return false;
  if (input.warmedTargetIndex !== input.itemIndex && !adjacent) return false;
  if (
    !shouldLoadOwnedWatchPlayer({
      index: input.itemIndex,
      activeIndex: input.activeIndex,
      platform: input.platform,
      warmedTargetIndex: input.warmedTargetIndex,
      prepareAdjacentNeighbors: input.prepareAdjacentNeighbors,
    })
  ) {
    return false;
  }
  if (
    !shouldMountWatchPlayer({
      shouldLoadPlayer: true,
      src: input.src,
    })
  ) {
    return false;
  }
  return shouldAttachWatchSurface({
    loadPlayer: true,
    preparePlayer: true,
    itemReady: true,
    warmNextSurface: true,
    platform: input.platform,
  });
}

export function resolveWatchHandoffIntentFromViewability(input: {
  viewableItems: ReadonlyArray<{
    index?: number | null;
    isViewable?: boolean;
    percentVisible?: number | null;
  }>;
  committedIndex: number;
  itemCount: number;
}): number | null {
  const committed = sanitizeWatchListIndex(input.committedIndex);
  if (committed == null) return null;
  const viewable: number[] = [];
  for (const item of input.viewableItems) {
    if (item.isViewable === false) continue;
    const index = sanitizeWatchListIndex(item.index ?? Number.NaN);
    if (index == null) continue;
    if (index < 0 || index >= input.itemCount) continue;
    viewable.push(index);
  }
  const next = committed + 1;
  const prev = committed - 1;
  if (viewable.includes(next)) return next;
  if (viewable.includes(prev)) return prev;
  return null;
}

export type WatchHandoffPhase = "idle" | "prepare" | "intent";
export type WatchHandoffIntentSource = "viewability-80" | "auto-next";

export type WatchHandoffTarget = {
  index: number;
  mediaId: string;
  generation: number;
  surfaceAttached: boolean;
  firstFrame: boolean;
  source?: WatchHandoffIntentSource;
};

export type WatchHandoffMachine = {
  phase: WatchHandoffPhase;
  committedIndex: number;
  committedMediaId: string;
  committedGeneration: number;
  navigationGeneration: number;
  prepared: WatchHandoffTarget | null;
  intent: WatchHandoffTarget | null;
};

export type WatchHandoffEvent =
  | {
      type: "bootstrap";
      index: number;
      mediaId: string;
      generation: number;
    }
  | {
      type: "prepare";
      index: number;
      mediaId: string;
      generation: number;
    }
  | {
      type: "prepare-progress";
      index: number;
      mediaId: string;
      generation: number;
      surfaceAttached: boolean;
      firstFrame: boolean;
    }
  | {
      type: "viewability-80";
      index: number;
      mediaId: string;
      generation: number;
      surfaceAttached: boolean;
      firstFrame: boolean;
    }
  | {
      type: "auto-next";
      index: number;
      mediaId: string;
      generation: number;
      surfaceAttached: boolean;
      firstFrame: boolean;
    }
  | {
      type: "current-end";
      index: number;
      mediaId: string;
      generation: number;
      surfaceAttached: boolean;
      firstFrame: boolean;
    }
  | {
      type: "first-frame";
      index: number;
      mediaId: string;
      generation: number;
      surfaceAttached: boolean;
    }
  | { type: "settle"; nativePage: number }
  | { type: "scroll-to-index"; index: number }
  | { type: "cancel"; reason: ManualHandoffCancelReason };

export type WatchHandoffCommit = {
  fromIndex: number;
  toIndex: number;
  toMediaId: string;
  claimReason: "handoff-commit";
  pinNativeOffset: boolean;
  silenceIndex: number;
  allowAudioIndex: number;
  retireIndex: number;
};

export type WatchHandoffReduceResult = {
  next: WatchHandoffMachine;
  action: "none" | "prepare" | "intent" | "silence-then-commit" | "reject";
  commit?: WatchHandoffCommit;
  rejectReason?: string;
};

export function createWatchHandoffMachine(input?: {
  committedIndex?: number;
  committedMediaId?: string;
  committedGeneration?: number;
  navigationGeneration?: number;
}): WatchHandoffMachine {
  return {
    phase: "idle",
    committedIndex: input?.committedIndex ?? 0,
    committedMediaId: input?.committedMediaId ?? "",
    committedGeneration: input?.committedGeneration ?? 0,
    navigationGeneration: input?.navigationGeneration ?? 0,
    prepared: null,
    intent: null,
  };
}

function matchesPreparedIdentity(
  target: WatchHandoffTarget,
  event: { index: number; mediaId: string; generation: number }
): boolean {
  return (
    target.index === event.index &&
    target.mediaId === event.mediaId &&
    target.generation === event.generation
  );
}

function asTarget(
  event: {
    index: number;
    mediaId: string;
    generation: number;
    surfaceAttached?: boolean;
    firstFrame?: boolean;
  },
  source?: WatchHandoffIntentSource
): WatchHandoffTarget | null {
  const index = sanitizeWatchListIndex(event.index);
  const mediaId = event.mediaId?.trim() ?? "";
  if (index == null || !mediaId) return null;
  if (!Number.isFinite(event.generation)) return null;
  return {
    index,
    mediaId,
    generation: event.generation,
    surfaceAttached: event.surfaceAttached === true,
    firstFrame: event.firstFrame === true,
    source,
  };
}

function tryCommit(
  state: WatchHandoffMachine,
  target: WatchHandoffTarget
): WatchHandoffReduceResult {
  const ready = isWatchPresentationReady({
    surfaceAttached: target.surfaceAttached,
    firstFrame: target.firstFrame,
    mediaId: target.mediaId,
    expectedMediaId: target.mediaId,
    generation: target.generation,
    expectedGeneration: target.generation,
  });
  if (!ready) {
    return {
      next: { ...state, phase: "intent", intent: target },
      action: "intent",
    };
  }
  return {
    next: {
      phase: "idle",
      committedIndex: target.index,
      committedMediaId: target.mediaId,
      committedGeneration: target.generation,
      navigationGeneration: state.navigationGeneration + 1,
      prepared: null,
      intent: null,
    },
    action: "silence-then-commit",
    commit: {
      fromIndex: state.committedIndex,
      toIndex: target.index,
      toMediaId: target.mediaId,
      claimReason: "handoff-commit",
      pinNativeOffset: target.source === "auto-next",
      silenceIndex: state.committedIndex,
      allowAudioIndex: target.index,
      retireIndex: state.committedIndex,
    },
  };
}

function nominate(
  state: WatchHandoffMachine,
  event: {
    index: number;
    mediaId: string;
    generation: number;
    surfaceAttached: boolean;
    firstFrame: boolean;
  },
  source: WatchHandoffIntentSource
): WatchHandoffReduceResult {
  if (event.index === state.committedIndex) {
    return { next: state, action: "none" };
  }
  if (Math.abs(event.index - state.committedIndex) !== 1) {
    return {
      next: state,
      action: "reject",
      rejectReason: "non-adjacent-intent",
    };
  }
  const target = asTarget(event, source);
  if (!target) {
    return { next: state, action: "reject", rejectReason: "invalid-target" };
  }
  if (
    state.prepared &&
    state.prepared.index === target.index &&
    (state.prepared.mediaId !== target.mediaId ||
      state.prepared.generation !== target.generation)
  ) {
    return {
      next: state,
      action: "reject",
      rejectReason: "wrong-media-generation",
    };
  }
  const merged: WatchHandoffTarget = {
    ...target,
    surfaceAttached:
      target.surfaceAttached ||
      (state.prepared?.index === target.index &&
        state.prepared.surfaceAttached),
    firstFrame:
      target.firstFrame ||
      (state.prepared?.index === target.index && state.prepared.firstFrame),
    source,
  };
  return tryCommit({ ...state, phase: "intent", intent: merged }, merged);
}

export function reduceWatchHandoff(
  state: WatchHandoffMachine,
  event: WatchHandoffEvent
): WatchHandoffReduceResult {
  switch (event.type) {
    case "bootstrap": {
      const target = asTarget({
        ...event,
        surfaceAttached: true,
        firstFrame: true,
      });
      if (!target) {
        return { next: state, action: "reject", rejectReason: "invalid-target" };
      }
      return {
        next: {
          phase: "idle",
          committedIndex: target.index,
          committedMediaId: target.mediaId,
          committedGeneration: target.generation,
          navigationGeneration: state.navigationGeneration,
          prepared: null,
          intent: null,
        },
        action: "none",
      };
    }
    case "prepare": {
      if (event.index === state.committedIndex) {
        return { next: state, action: "none" };
      }
      if (Math.abs(event.index - state.committedIndex) !== 1) {
        return {
          next: state,
          action: "reject",
          rejectReason: "non-adjacent-prepare",
        };
      }
      const target = asTarget(event);
      if (!target) {
        return {
          next: state,
          action: "reject",
          rejectReason: "invalid-target",
        };
      }
      return {
        next: {
          ...state,
          phase: state.phase === "intent" ? "intent" : "prepare",
          prepared: target,
        },
        action: "prepare",
      };
    }
    case "prepare-progress": {
      const target = asTarget(event);
      if (!target) {
        return { next: state, action: "reject", rejectReason: "invalid-target" };
      }
      if (
        state.prepared &&
        state.prepared.index === target.index &&
        !matchesPreparedIdentity(state.prepared, event)
      ) {
        return {
          next: state,
          action: "reject",
          rejectReason: "wrong-media-generation",
        };
      }
      if (state.phase === "intent" && state.intent) {
        if (!matchesPreparedIdentity(state.intent, event)) {
          return {
            next: state,
            action: "reject",
            rejectReason: "stale-first-frame",
          };
        }
        const merged = {
          ...state.intent,
          surfaceAttached: target.surfaceAttached || state.intent.surfaceAttached,
          firstFrame: target.firstFrame || state.intent.firstFrame,
        };
        return tryCommit(state, merged);
      }
      if (state.prepared && matchesPreparedIdentity(state.prepared, event)) {
        return {
          next: {
            ...state,
            prepared: {
              ...state.prepared,
              surfaceAttached: target.surfaceAttached,
              firstFrame: target.firstFrame,
            },
          },
          action: "none",
        };
      }
      if (state.prepared == null && Math.abs(target.index - state.committedIndex) === 1) {
        return {
          next: {
            ...state,
            phase: state.phase === "idle" ? "prepare" : state.phase,
            prepared: target,
          },
          action: "prepare",
        };
      }
      return { next: state, action: "none" };
    }
    case "viewability-80":
      return nominate(state, event, "viewability-80");
    case "auto-next":
    case "current-end":
      if (event.index !== state.committedIndex + 1) {
        return {
          next: state,
          action: "reject",
          rejectReason: "auto-next-not-next",
        };
      }
      return nominate(state, event, "auto-next");
    case "first-frame": {
      const target = asTarget({ ...event, firstFrame: true });
      if (!target) {
        return { next: state, action: "reject", rejectReason: "invalid-target" };
      }
      if (state.phase === "intent" && state.intent) {
        if (!matchesPreparedIdentity(state.intent, event)) {
          return {
            next: state,
            action: "reject",
            rejectReason: "stale-first-frame",
          };
        }
        return tryCommit(state, {
          ...state.intent,
          surfaceAttached: event.surfaceAttached || state.intent.surfaceAttached,
          firstFrame: true,
        });
      }
      if (state.prepared && matchesPreparedIdentity(state.prepared, event)) {
        return {
          next: {
            ...state,
            prepared: {
              ...state.prepared,
              surfaceAttached: true,
              firstFrame: true,
            },
          },
          action: "none",
        };
      }
      return {
        next: state,
        action: "reject",
        rejectReason: "stale-first-frame",
      };
    }
    case "settle": {
      if (event.nativePage === state.committedIndex) {
        if (state.intent && state.intent.index !== state.committedIndex) {
          return {
            next: {
              ...state,
              phase: state.prepared ? "prepare" : "idle",
              intent: null,
            },
            action: "none",
          };
        }
        return { next: state, action: "none" };
      }
      if (
        event.nativePage === 0 &&
        state.committedIndex >= 1
      ) {
        return {
          next: state,
          action: "reject",
          rejectReason: "stale-settle",
        };
      }
      return { next: state, action: "none" };
    }
    case "scroll-to-index":
      return {
        next: state,
        action: "reject",
        rejectReason: "independent-writer-forbidden",
      };
    case "cancel":
      return {
        next: {
          ...state,
          phase: state.prepared ? "prepare" : "idle",
          intent: null,
        },
        action: "none",
      };
    default:
      return { next: state, action: "none" };
  }
}

export function preparedWatchNeighborIsSilentOwner(input: {
  itemIndex: number;
  committedIndex: number;
  preparedIndex: number | null;
}): {
  mayBecomeAudible: false;
  mayStealActiveIndex: false;
} {
  void input;
  return { mayBecomeAudible: false, mayStealActiveIndex: false };
}
