import { shouldMountWatchPlayer } from "@/src/lib/feed/videoStoragePath";
import {
  sanitizeWatchListIndex,
  shouldAttachWatchSurface,
} from "./playbackPolicy";
import {
  decideWatchViewabilityEvidence,
  shouldLoadOwnedWatchPlayer,
} from "./watchActiveIndexArbiter";
import { WATCH_VIEWABILITY_PERCENT_THRESHOLD } from "./watchOwnership";

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

/** Viewability never writes activeIndex. */
export function manualViewabilityMayWriteActiveIndex(): false {
  return decideWatchViewabilityEvidence().mayClaimActiveIndex;
}

export function shouldCompleteManualHandoff(input: {
  nativeSettledPage: number | null;
  targetIndex: number | null;
  targetSurfaceAttached: boolean;
  targetFirstFrame: boolean;
  targetRetainedReady?: boolean;
  requireNativeSettle?: boolean;
}): boolean {
  const target = sanitizeWatchListIndex(input.targetIndex ?? Number.NaN);
  if (target == null) return false;
  if (input.requireNativeSettle !== false) {
    const native = sanitizeWatchListIndex(input.nativeSettledPage ?? Number.NaN);
    if (native == null || native !== target) return false;
  }
  const presentationReady =
    input.targetSurfaceAttached === true &&
    (input.targetFirstFrame === true || input.targetRetainedReady === true);
  return presentationReady;
}

export function shouldStartManualHandoffAudio(input: {
  targetSurfaceAttached: boolean;
  targetFirstFrame: boolean;
  targetIsActive: boolean;
  isAudioOwner?: boolean;
  handoffCommitted?: boolean;
}): boolean {
  if (input.isAudioOwner === false) return false;
  if (input.handoffCommitted === false) return false;
  return (
    input.targetSurfaceAttached === true &&
    input.targetFirstFrame === true &&
    input.targetIsActive === true &&
    input.isAudioOwner === true &&
    input.handoffCommitted === true
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
  claimReason: "programmatic";
  applyViewabilityLock: true;
  pinNativeOffset: boolean;
};

/** User swipe commits without pin-vs-settle. Auto-next may sync native once. */
export function resolveManualHandoffCompletionTransaction(
  reason: "user-swipe" | "auto-next" = "user-swipe"
): ManualHandoffCompletionTransaction {
  return {
    claimReason: "programmatic",
    applyViewabilityLock: true,
    pinNativeOffset: reason === "auto-next",
  };
}

/**
 * Android cross-page settle is evidence only. Claim happens later through
 * scrollToWatchIndex after the target first_frame. iOS still claims here.
 */
export function shouldClaimWatchIndexFromNativeSettle(input: {
  platform?: string | null;
  nativePage: number | null;
  activeIndex: number;
}): boolean {
  if (input.nativePage == null) return false;
  if (input.platform === "android") {
    return false;
  }
  return Number.isFinite(input.activeIndex);
}

export function resolveAndroidManualSettleAction(input: {
  nativePage: number;
  activeIndex: number;
}): "cancel" | "await-target-ready" {
  if (input.nativePage === input.activeIndex) return "cancel";
  return "await-target-ready";
}

/** Stale settle after scrollToWatchIndex must not retarget the previous page. */
export function shouldIgnoreStaleManualSettle(input: {
  locked: boolean;
  nativePage: number;
  activeIndex: number;
}): boolean {
  return input.locked === true && input.nativePage !== input.activeIndex;
}

export type ManualHandoffPhase = "idle" | "intent" | "committed" | "cancelled";

export type ManualHandoffPending = {
  navigationGeneration: number;
  targetIndex: number;
  targetMediaId: string;
  phase: "intent";
  nativePageForged: false;
};

export type ManualHandoffReadyProof = {
  index: number;
  mediaId: string;
  surfaceAttached: boolean;
  firstFrame: boolean;
  generation: number;
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
    phase: "intent",
    nativePageForged: false,
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
  targetRetainedReady?: boolean;
  retainedReadyMediaId?: string | null;
  nativePageSource?:
    | "viewability"
    | "scroll-offset"
    | "proven-settle"
    | "manual-80-ready";
  screenFocused?: boolean;
  shareSheetOpen?: boolean;
  unmounted?: boolean;
}): boolean {
  if (input.pending == null) return false;
  if (input.unmounted === true) return false;
  if (input.screenFocused === false) return false;
  if (input.shareSheetOpen === true) return false;
  if (input.nativePageSource === "viewability") return false;
  if (
    input.currentNavigationGeneration !== input.pending.navigationGeneration
  ) {
    return false;
  }
  const manual80Ready = input.nativePageSource === "manual-80-ready";
  if (
    !manual80Ready &&
    sanitizeWatchListIndex(input.nativeSettledPage ?? Number.NaN) !==
      input.pending.targetIndex
  ) {
    return false;
  }
  if (
    !input.currentTargetMediaId ||
    input.currentTargetMediaId !== input.pending.targetMediaId
  ) {
    return false;
  }
  const liveFirstFrame =
    input.firstFrameMediaId != null &&
    input.firstFrameMediaId === input.pending.targetMediaId &&
    input.targetFirstFrame === true;
  const retainedReady =
    input.targetRetainedReady === true &&
    input.retainedReadyMediaId === input.pending.targetMediaId;
  if (!liveFirstFrame && !retainedReady) {
    return false;
  }
  return shouldCompleteManualHandoff({
    nativeSettledPage: input.nativeSettledPage,
    targetIndex: input.pending.targetIndex,
    targetSurfaceAttached: input.targetSurfaceAttached,
    targetFirstFrame: liveFirstFrame,
    targetRetainedReady: retainedReady,
    requireNativeSettle: !manual80Ready,
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
}): boolean {
  if (input.warmedTargetIndex == null) return false;
  if (input.itemIndex !== input.warmedTargetIndex) return false;
  if (input.itemIndex === input.activeIndex) return false;
  if (
    !shouldLoadOwnedWatchPlayer({
      index: input.itemIndex,
      activeIndex: input.activeIndex,
      platform: input.platform,
      warmedTargetIndex: input.warmedTargetIndex,
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

export function resolveWatchViewabilityHandoffPhase(
  visiblePercent: number
): "none" | "intent" {
  if (
    !Number.isFinite(visiblePercent) ||
    visiblePercent < WATCH_VIEWABILITY_PERCENT_THRESHOLD
  ) {
    return "none";
  }
  return "intent";
}

export function viewabilityMayCommitHandoff(): false {
  return false;
}

export function viewabilityMayCommitManualHandoff(): false {
  return false;
}

/** Scroll-offset progress toward the neighbor. Not native-page rounding (50%). */
export function resolveManualScrollProgress(input: {
  fromIndex: number;
  currentOffset: number;
  itemHeight: number;
  itemCount: number;
}): { targetIndex: number | null; visiblePercent: number } {
  if (!Number.isFinite(input.itemHeight) || input.itemHeight <= 0) {
    return { targetIndex: null, visiblePercent: 0 };
  }
  const from = sanitizeWatchListIndex(input.fromIndex);
  if (from == null) return { targetIndex: null, visiblePercent: 0 };
  const fromOffset = from * input.itemHeight;
  const delta = input.currentOffset - fromOffset;
  const visiblePercent = Math.min(
    100,
    Math.max(0, (Math.abs(delta) / input.itemHeight) * 100)
  );
  return {
    targetIndex: resolveManualHandoffTarget(input),
    visiblePercent,
  };
}

export function shouldCommitFromManualScrollProgress(input: {
  visiblePercent: number;
  targetIndex: number | null;
  fromIndex: number;
}): boolean {
  const target = sanitizeWatchListIndex(input.targetIndex ?? Number.NaN);
  const from = sanitizeWatchListIndex(input.fromIndex);
  if (target == null || from == null || target === from) return false;
  return (
    Number.isFinite(input.visiblePercent) &&
    input.visiblePercent >= WATCH_VIEWABILITY_PERCENT_THRESHOLD
  );
}

/** Ready proof must be stored even before a pending handoff exists. */
export function shouldRecordManualHandoffReadyProof(input: {
  eventIndex: number;
  activeIndex: number;
  warmedTargetIndex: number | null;
  previousIndex: number | null;
}): boolean {
  return (
    input.eventIndex === input.activeIndex ||
    input.eventIndex === input.activeIndex + 1 ||
    input.eventIndex === input.warmedTargetIndex ||
    input.eventIndex === input.previousIndex
  );
}

export function shouldPinCommittedPageOnSettle(input: {
  handoffPhase: ManualHandoffPhase;
  nativePage: number;
  committedIndex: number;
}): boolean {
  return (
    input.handoffPhase === "committed" &&
    input.nativePage !== input.committedIndex
  );
}

export function viewabilityMayForgeNativePage(): false {
  return false;
}

export function resolveWatchViewabilityIntentEffect(visiblePercent: number): {
  phase: "none" | "intent";
  commit: false;
  forgeNativePage: false;
  setAudioOwner: false;
  unmuteTarget: false;
} {
  return {
    phase: resolveWatchViewabilityHandoffPhase(visiblePercent),
    commit: false,
    forgeNativePage: false,
    setAudioOwner: false,
    unmuteTarget: false,
  };
}

/** Manual 80% may commit when the target is already presentation-ready. */
export function manual80CommitRequiresFullNativeSettle(): false {
  return false;
}

export function resolveManual80CommitDecision(input: {
  visiblePercent: number;
  currentIndex: number;
  targetIndex: number;
  targetReady: boolean;
  targetMediaMatches: boolean;
}): {
  phase: "none" | "intent" | "committed";
  commit: boolean;
  requireFullNativeSettle: false;
  forgeNativePage: false;
  silenceCurrentFirst: boolean;
} {
  const current = sanitizeWatchListIndex(input.currentIndex);
  const target = sanitizeWatchListIndex(input.targetIndex);
  if (
    !Number.isFinite(input.visiblePercent) ||
    input.visiblePercent < WATCH_VIEWABILITY_PERCENT_THRESHOLD ||
    current == null ||
    target == null ||
    target === current
  ) {
    return {
      phase: "none",
      commit: false,
      requireFullNativeSettle: false,
      forgeNativePage: false,
      silenceCurrentFirst: false,
    };
  }
  if (!input.targetReady || !input.targetMediaMatches) {
    return {
      phase: "intent",
      commit: false,
      requireFullNativeSettle: false,
      forgeNativePage: false,
      silenceCurrentFirst: false,
    };
  }
  return {
    phase: "committed",
    commit: true,
    requireFullNativeSettle: false,
    forgeNativePage: false,
    silenceCurrentFirst: true,
  };
}

export function resolveManualReverseBefore80Commit(input: {
  currentIndex: number;
}): {
  commit: false;
  restoreOwner: number;
  treatAsNewReverse: false;
} {
  return {
    commit: false,
    restoreOwner: sanitizeWatchListIndex(input.currentIndex) ?? 0,
    treatAsNewReverse: false,
  };
}

export function resolveManualReverseAfter80Commit(input: {
  committedIndex: number;
  nextTarget: number | null;
}): "keep" | "new-handoff" {
  const committed = sanitizeWatchListIndex(input.committedIndex);
  const next = sanitizeWatchListIndex(input.nextTarget ?? Number.NaN);
  if (committed == null || next == null || next === committed) return "keep";
  return "new-handoff";
}

export function isRetainedPresentationReady(
  proof: ManualHandoffReadyProof | null | undefined,
  expected: { index: number; mediaId: string; generation?: number }
): boolean {
  if (!proof) return false;
  if (proof.index !== expected.index) return false;
  if (proof.mediaId !== expected.mediaId) return false;
  if (
    expected.generation != null &&
    proof.generation !== expected.generation
  ) {
    return false;
  }
  return proof.surfaceAttached === true && proof.firstFrame === true;
}

export function resolveManualHandoffCancelTransaction(input: {
  currentIndex: number;
}): {
  pending: null;
  presentationOwner: number;
  audibleOwner: number;
  silenceTarget: true;
  handoffState: "cancelled";
  rejectStaleTargetEvents: true;
} {
  const current = sanitizeWatchListIndex(input.currentIndex) ?? 0;
  return {
    pending: null,
    presentationOwner: current,
    audibleOwner: current,
    silenceTarget: true,
    handoffState: "cancelled",
    rejectStaleTargetEvents: true,
  };
}

export function shouldRejectStaleManualHandoffEvent(input: {
  eventIndex: number;
  eventMediaId?: string | null;
  eventGeneration?: number | null;
  eventHandoffState?: ManualHandoffPhase;
  pendingIndex: number | null;
  pendingMediaId: string | null;
  pendingGeneration: number;
  handoffState: ManualHandoffPhase;
}): boolean {
  if (input.eventHandoffState === "cancelled") return true;
  if (input.handoffState === "cancelled" && input.pendingIndex == null) {
    return true;
  }
  if (input.handoffState === "committed") {
    return input.eventIndex !== input.pendingIndex;
  }
  if (input.pendingIndex == null) return true;
  if (input.eventIndex !== input.pendingIndex) return true;
  if (
    input.eventMediaId != null &&
    input.pendingMediaId != null &&
    input.eventMediaId !== input.pendingMediaId
  ) {
    return true;
  }
  if (
    input.eventGeneration != null &&
    input.eventGeneration !== input.pendingGeneration
  ) {
    return true;
  }
  return false;
}

export function targetMayBecomeAudible(input: {
  handoffCommitted: boolean;
  isAudioOwner: boolean;
  isPresentationOwner: boolean;
  previousSilenced: boolean;
}): boolean {
  return (
    input.handoffCommitted === true &&
    input.isAudioOwner === true &&
    input.isPresentationOwner === true &&
    input.previousSilenced === true
  );
}
