import { describe, expect, it } from "vitest";

import {
  resolveWatchTapPauseCommand,
  shouldHandoffWatchAdvance,
  shouldLifecycleResumeAfterUserPause,
} from "./playbackPolicy";
import { shouldStartPlaybackAfterAsset } from "./playerLifecycle";
import {
  createWatchActiveIndexArbiter,
  decideWatchActiveIndexClaim,
  decideWatchViewabilityEvidence,
  shouldLoadOwnedWatchPlayer,
} from "./watchActiveIndexArbiter";
import {
  manualViewabilityMayWriteActiveIndex,
  resolveAndroidManualSettleAction,
  resolveManualHandoffCompletionTransaction,
  resolveManualHandoffTarget,
  shouldClaimWatchIndexFromNativeSettle,
  shouldIgnoreStaleManualSettle,
  shouldCompleteManualHandoff,
  shouldKeepPreviousSurfaceDuringManualHandoff,
  shouldReleasePreviousWatchSurface,
  shouldStartManualHandoffAudio,
  shouldWarmManualTarget,
} from "./watchManualHandoff";

describe("manual handoff parity with auto-advance", () => {
  it("warms the target before any activeIndex claim", () => {
    expect(
      resolveManualHandoffTarget({
        fromIndex: 0,
        currentOffset: 200,
        itemHeight: 800,
        itemCount: 5,
      })
    ).toBe(1);
    expect(shouldWarmManualTarget({ fromIndex: 0, targetIndex: 1 })).toBe(
      true
    );
    expect(
      shouldLoadOwnedWatchPlayer({
        index: 1,
        activeIndex: 0,
        platform: "android",
        warmedTargetIndex: 1,
      })
    ).toBe(true);
    expect(
      shouldLoadOwnedWatchPlayer({
        index: 0,
        activeIndex: 0,
        platform: "android",
        warmedTargetIndex: 1,
      })
    ).toBe(true);
    let activeIndex = 0;
    expect(manualViewabilityMayWriteActiveIndex()).toBe(false);
    expect(decideWatchViewabilityEvidence().mayClaimActiveIndex).toBe(false);
    expect(activeIndex).toBe(0);
  });

  it("onViewableItemsChanged cannot write activeIndex", () => {
    const arbiter = createWatchActiveIndexArbiter();
    expect(decideWatchViewabilityEvidence().mayClaimActiveIndex).toBe(false);
    expect(
      decideWatchActiveIndexClaim({
        arbiter: {
          ...arbiter,
          activeIndex: 1,
          pageClaimed: true,
          lastSettledNativePage: 1,
          userInteracted: true,
        },
        reason: "bootstrap",
        requestedIndex: 0,
        navigationGeneration: 0,
      }).accept
    ).toBe(false);
  });

  it("target audio cannot start before surface + first_frame + active claim", () => {
    expect(
      shouldStartManualHandoffAudio({
        targetSurfaceAttached: true,
        targetFirstFrame: false,
        targetIsActive: false,
      })
    ).toBe(false);
    expect(
      shouldStartManualHandoffAudio({
        targetSurfaceAttached: true,
        targetFirstFrame: true,
        targetIsActive: false,
      })
    ).toBe(false);
    expect(
      shouldStartManualHandoffAudio({
        targetSurfaceAttached: true,
        targetFirstFrame: true,
        targetIsActive: true,
      })
    ).toBe(true);
    expect(
      shouldStartPlaybackAfterAsset({
        nativeReady: true,
        jsReady: true,
        isActive: true,
        shouldPlay: true,
        playerAlive: true,
        ownerGeneration: 2,
        commandGeneration: 2,
        surfaceAttached: false,
      })
    ).toBe(false);
  });

  it("previous surface cannot release before completed handoff", () => {
    expect(
      shouldKeepPreviousSurfaceDuringManualHandoff({
        handoffCompleted: false,
      })
    ).toBe(true);
    expect(
      shouldReleasePreviousWatchSurface({
        handoffCompleted: false,
        claimedTarget: false,
        targetFirstFrame: true,
      })
    ).toBe(false);
    expect(
      shouldCompleteManualHandoff({
        nativeSettledPage: 1,
        targetIndex: 1,
        targetSurfaceAttached: true,
        targetFirstFrame: false,
      })
    ).toBe(false);
    expect(
      shouldCompleteManualHandoff({
        nativeSettledPage: 1,
        targetIndex: 1,
        targetSurfaceAttached: true,
        targetFirstFrame: true,
      })
    ).toBe(true);
    expect(
      shouldReleasePreviousWatchSurface({
        handoffCompleted: true,
        claimedTarget: true,
        targetFirstFrame: true,
      })
    ).toBe(true);
  });

  it("manual settle runs claim + lock + native offset pin only after first_frame", () => {
    expect(
      shouldClaimWatchIndexFromNativeSettle({
        platform: "android",
        nativePage: 1,
        activeIndex: 0,
      })
    ).toBe(false);
    expect(
      resolveAndroidManualSettleAction({ nativePage: 1, activeIndex: 0 })
    ).toBe("await-target-ready");
    expect(
      resolveAndroidManualSettleAction({ nativePage: 0, activeIndex: 0 })
    ).toBe("cancel");
    expect(
      shouldCompleteManualHandoff({
        nativeSettledPage: 1,
        targetIndex: 1,
        targetSurfaceAttached: true,
        targetFirstFrame: false,
      })
    ).toBe(false);
    expect(resolveManualHandoffCompletionTransaction()).toEqual({
      claimReason: "programmatic",
      applyViewabilityLock: true,
      pinNativeOffset: true,
    });
    expect(
      shouldClaimWatchIndexFromNativeSettle({
        platform: "ios",
        nativePage: 1,
        activeIndex: 0,
      })
    ).toBe(true);
  });

  it("manual settle 0→1 and 1→2 then back 2→1", () => {
    expect(
      resolveManualHandoffTarget({
        fromIndex: 0,
        currentOffset: 800,
        itemHeight: 800,
        itemCount: 5,
      })
    ).toBe(1);
    expect(
      resolveManualHandoffTarget({
        fromIndex: 1,
        currentOffset: 1600,
        itemHeight: 800,
        itemCount: 5,
      })
    ).toBe(2);
    expect(
      resolveManualHandoffTarget({
        fromIndex: 2,
        currentOffset: 800,
        itemHeight: 800,
        itemCount: 5,
      })
    ).toBe(1);
    let arbiter = createWatchActiveIndexArbiter();
    arbiter = decideWatchActiveIndexClaim({
      arbiter,
      reason: "bootstrap",
      requestedIndex: 0,
      navigationGeneration: 0,
    }).next;
    arbiter = decideWatchActiveIndexClaim({
      arbiter,
      reason: "programmatic",
      requestedIndex: 1,
      navigationGeneration: arbiter.navigationGeneration,
      nativeSettledPage: 1,
    }).next;
    expect(arbiter.activeIndex).toBe(1);
    arbiter = decideWatchActiveIndexClaim({
      arbiter,
      reason: "programmatic",
      requestedIndex: 2,
      navigationGeneration: arbiter.navigationGeneration,
      nativeSettledPage: 2,
    }).next;
    expect(arbiter.activeIndex).toBe(2);
    arbiter = decideWatchActiveIndexClaim({
      arbiter,
      reason: "programmatic",
      requestedIndex: 1,
      navigationGeneration: arbiter.navigationGeneration,
      nativeSettledPage: 1,
    }).next;
    expect(arbiter.activeIndex).toBe(1);
  });

  it("rejects a delayed stale index-0 callback after settle on 1", () => {
    let arbiter = createWatchActiveIndexArbiter();
    arbiter = decideWatchActiveIndexClaim({
      arbiter,
      reason: "bootstrap",
      requestedIndex: 0,
      navigationGeneration: 0,
    }).next;
    arbiter = decideWatchActiveIndexClaim({
      arbiter,
      reason: "programmatic",
      requestedIndex: 1,
      navigationGeneration: arbiter.navigationGeneration,
      nativeSettledPage: 1,
    }).next;
    expect(decideWatchViewabilityEvidence().mayClaimActiveIndex).toBe(false);
    expect(
      decideWatchActiveIndexClaim({
        arbiter,
        reason: "bootstrap",
        requestedIndex: 0,
        navigationGeneration: arbiter.navigationGeneration,
      }).accept
    ).toBe(false);
    expect(
      shouldIgnoreStaleManualSettle({
        locked: true,
        nativePage: 0,
        activeIndex: 1,
      })
    ).toBe(true);
    expect(arbiter.activeIndex).toBe(1);
  });

  it("auto-advance still hands off on next first_frame", () => {
    expect(
      shouldHandoffWatchAdvance({
        nextFirstFrame: true,
        waitedMs: 0,
      })
    ).toBe(true);
    expect(
      shouldHandoffWatchAdvance({
        nextFirstFrame: false,
        waitedMs: 0,
      })
    ).toBe(false);
    expect(
      shouldHandoffWatchAdvance({
        nextFirstFrame: false,
        waitedMs: 700,
      })
    ).toBe(true);
  });

  it("tap pause latch survives readyToPlay", () => {
    const tap = resolveWatchTapPauseCommand({
      isActive: true,
      feedShouldPlay: true,
      paneStatus: "ready",
      userPaused: false,
    });
    expect(tap.invokeHandler).toBe(true);
    expect(tap.pauseCommand).toBe(true);
    expect(
      shouldLifecycleResumeAfterUserPause({
        userPaused: true,
        lifecycleWantsPlay: true,
      })
    ).toBe(false);
    expect(
      shouldStartPlaybackAfterAsset({
        nativeReady: true,
        jsReady: true,
        isActive: true,
        shouldPlay: false,
        playerAlive: true,
        ownerGeneration: 1,
        commandGeneration: 1,
        surfaceAttached: true,
      })
    ).toBe(false);
  });
});
