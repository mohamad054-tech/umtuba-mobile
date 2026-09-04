import { sanitizeWatchListIndex } from "./playbackPolicy";
import { decideWatchViewabilityEvidence } from "./watchActiveIndexArbiter";

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

export type ManualHandoffCompletionTransaction = {
  claimReason: "programmatic";
  applyViewabilityLock: true;
  pinNativeOffset: true;
};

/** Same claim + lock + scrollToWatchIndex pin as auto-advance. */
export function resolveManualHandoffCompletionTransaction(): ManualHandoffCompletionTransaction {
  return {
    claimReason: "programmatic",
    applyViewabilityLock: true,
    pinNativeOffset: true,
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
