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

/** Viewability never writes activeIndex. */
export function manualViewabilityMayWriteActiveIndex(): false {
  return decideWatchViewabilityEvidence().mayClaimActiveIndex;
}

export function shouldCompleteManualHandoff(input: {
  nativeSettledPage: number | null;
  targetIndex: number | null;
  targetSurfaceAttached: boolean;
  targetFirstFrame: boolean;
}): boolean {
  const native = sanitizeWatchListIndex(input.nativeSettledPage ?? Number.NaN);
  const target = sanitizeWatchListIndex(input.targetIndex ?? Number.NaN);
  if (native == null || target == null) return false;
  if (native !== target) return false;
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

export type ManualHandoffCompletionReason = "user-swipe" | "auto-next";

export type ManualHandoffCompletionTransaction = {
  claimReason: "programmatic";
  applyViewabilityLock: true;
  pinNativeOffset: boolean;
};

/**
 * User swipe already moved the native page. Pinning it again fights Fold6
 * settle and remounts the visible surface. Auto-next still needs one pin.
 */
export function resolveManualHandoffCompletionTransaction(
  reason: ManualHandoffCompletionReason = "user-swipe"
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
  if (
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
  if (
    !input.firstFrameMediaId ||
    input.firstFrameMediaId !== input.pending.targetMediaId
  ) {
    return false;
  }
  return shouldCompleteManualHandoff({
    nativeSettledPage: input.nativeSettledPage,
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
