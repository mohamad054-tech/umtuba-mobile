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
  watchShareDismissPreservesActiveItem,
  watchShareSheetRemountsWatch,
} from "@/src/lib/social/watchShareSheet";

import {
  createManualHandoffPending,
  manualViewabilityMayWriteActiveIndex,
  resolveAndroidManualSettleAction,
  resolveManualHandoffCompletionTransaction,
  resolveManualHandoffRetarget,
  resolveManualHandoffTarget,
  resolveNoFirstFrameManualHandoff,
  resolvePendingManualHandoffAction,
  shouldAcceptPendingManualHandoff,
  shouldCancelPendingManualHandoff,
  shouldClaimWatchIndexFromNativeSettle,
  shouldCompleteManualHandoff,
  shouldIgnoreStaleManualSettle,
  shouldKeepPreviousSurfaceDuringManualHandoff,
  shouldMountOffscreenManualTargetVideoView,
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
        nativeSettledPage: null,
        targetIndex: 1,
        targetSurfaceAttached: true,
        targetFirstFrame: false,
      })
    ).toBe(false);
    expect(
      shouldCompleteManualHandoff({
        nativeSettledPage: null,
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

  it("manual settle never writes activeIndex on any platform", () => {
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
        nativeSettledPage: null,
        targetIndex: 1,
        targetSurfaceAttached: true,
        targetFirstFrame: false,
      })
    ).toBe(false);
    expect(resolveManualHandoffCompletionTransaction()).toEqual({
      claimReason: "handoff-commit",
      applyViewabilityLock: false,
      pinNativeOffset: false,
    });
    expect(
      shouldClaimWatchIndexFromNativeSettle({
        platform: "ios",
        nativePage: 1,
        activeIndex: 0,
      })
    ).toBe(false);
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
      reason: "handoff-commit",
      requestedIndex: 1,
      navigationGeneration: arbiter.navigationGeneration,
      nativeSettledPage: 1,
    }).next;
    expect(arbiter.activeIndex).toBe(1);
    arbiter = decideWatchActiveIndexClaim({
      arbiter,
      reason: "handoff-commit",
      requestedIndex: 2,
      navigationGeneration: arbiter.navigationGeneration,
      nativeSettledPage: 2,
    }).next;
    expect(arbiter.activeIndex).toBe(2);
    arbiter = decideWatchActiveIndexClaim({
      arbiter,
      reason: "handoff-commit",
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
      reason: "handoff-commit",
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

describe("manual handoff cancel, identity, and deadlock gate", () => {
  const pending = createManualHandoffPending({
    navigationGeneration: 3,
    targetIndex: 1,
    targetMediaId: "post-2",
  });

  function readyCompletion(
    overrides: Partial<Parameters<typeof shouldAcceptPendingManualHandoff>[0]> = {}
  ) {
    return shouldAcceptPendingManualHandoff({
      pending,
      currentNavigationGeneration: 3,
      nativeSettledPage: 1,
      currentTargetMediaId: "post-2",
      firstFrameMediaId: "post-2",
      targetSurfaceAttached: true,
      targetFirstFrame: true,
      screenFocused: true,
      shareSheetOpen: false,
      unmounted: false,
      committedIndex: 0,
      ...overrides,
    });
  }

  it("cancels a drag that returns to the current page", () => {
    expect(
      resolveManualHandoffTarget({
        fromIndex: 0,
        currentOffset: 40,
        itemHeight: 800,
        itemCount: 5,
      })
    ).toBeNull();
    expect(
      resolveAndroidManualSettleAction({ nativePage: 0, activeIndex: 0 })
    ).toBe("cancel");
    expect(shouldCancelPendingManualHandoff("return-to-current")).toBe(true);
    expect(readyCompletion({ nativeSettledPage: 0 })).toBe(false);
  });

  it("cancels when direction changes before settle", () => {
    expect(
      resolveManualHandoffRetarget({
        previousTarget: 1,
        nextTarget: null,
        fromIndex: 0,
      })
    ).toBe("cancel");
    expect(
      resolveManualHandoffRetarget({
        previousTarget: 1,
        nextTarget: -1,
        fromIndex: 1,
      })
    ).toBe("cancel");
    expect(shouldCancelPendingManualHandoff("direction-change")).toBe(true);
  });

  it("retargets a rapid 0→1→2 intent and rejects the old first_frame", () => {
    expect(
      resolveManualHandoffRetarget({
        previousTarget: 1,
        nextTarget: 2,
        fromIndex: 0,
      })
    ).toBe("retarget");
    expect(shouldCancelPendingManualHandoff("rapid-retarget")).toBe(true);
    const next = createManualHandoffPending({
      navigationGeneration: 3,
      targetIndex: 2,
      targetMediaId: "post-3",
    });
    expect(
      shouldAcceptPendingManualHandoff({
        pending: next,
        currentNavigationGeneration: 3,
        nativeSettledPage: 2,
        currentTargetMediaId: "post-3",
        firstFrameMediaId: "post-2",
        targetSurfaceAttached: true,
        targetFirstFrame: true,
        screenFocused: true,
      })
    ).toBe(false);
    expect(
      shouldAcceptPendingManualHandoff({
        pending: next,
        currentNavigationGeneration: 3,
        nativeSettledPage: 2,
        currentTargetMediaId: "post-3",
        firstFrameMediaId: "post-3",
        targetSurfaceAttached: true,
        targetFirstFrame: true,
        screenFocused: true,
      })
    ).toBe(true);
  });

  it("cancels when Watch loses focus or unmounts", () => {
    expect(shouldCancelPendingManualHandoff("blur-unmount")).toBe(true);
    expect(readyCompletion({ screenFocused: false })).toBe(false);
    expect(readyCompletion({ unmounted: true })).toBe(false);
    expect(readyCompletion()).toBe(true);
  });

  it("cancels when feed refresh/reorder changes the target post", () => {
    expect(shouldCancelPendingManualHandoff("feed-identity-change")).toBe(true);
    expect(readyCompletion({ currentTargetMediaId: "post-99" })).toBe(false);
    expect(
      createManualHandoffPending({
        navigationGeneration: 3,
        targetIndex: 1,
        targetMediaId: "",
      })
    ).toBeNull();
  });

  it("rejects a stale first_frame from a previous target", () => {
    expect(resolvePendingManualHandoffAction("stale-first-frame")).toBe(
      "reject-completion"
    );
    expect(readyCompletion({ firstFrameMediaId: "post-1" })).toBe(false);
    expect(readyCompletion({ currentNavigationGeneration: 4 })).toBe(false);
    expect(pending).toEqual({
      navigationGeneration: 3,
      targetIndex: 1,
      targetMediaId: "post-2",
    });
  });

  it("rejects completion while Share is open and does not remount Watch", () => {
    expect(resolvePendingManualHandoffAction("share-open")).toBe(
      "reject-completion"
    );
    expect(readyCompletion({ shareSheetOpen: true })).toBe(false);
    expect(watchShareSheetRemountsWatch()).toBe(false);
    expect(watchShareDismissPreservesActiveItem()).toBe(true);
    expect(readyCompletion({ shareSheetOpen: false })).toBe(true);
  });

  it("never completes a black page when first_frame never arrives", () => {
    const stuck = resolveNoFirstFrameManualHandoff({ currentActiveIndex: 0 });
    expect(stuck.complete).toBe(false);
    expect(stuck.claimTarget).toBe(false);
    expect(stuck.startTargetAudio).toBe(false);
    expect(stuck.acceptBlackAsComplete).toBe(false);
    expect(stuck.keepCurrentIndex).toBe(0);
    expect(readyCompletion({ targetFirstFrame: false })).toBe(false);
    expect(
      shouldStartManualHandoffAudio({
        targetSurfaceAttached: false,
        targetFirstFrame: false,
        targetIsActive: false,
      })
    ).toBe(false);
    expect(
      shouldAcceptPendingManualHandoff({
        pending,
        currentNavigationGeneration: 3,
        nativeSettledPage: 1,
        currentTargetMediaId: "post-99",
        firstFrameMediaId: "post-2",
        targetSurfaceAttached: true,
        targetFirstFrame: true,
      })
    ).toBe(false);
  });

  it("mounts the warmed target VideoView before it is active", () => {
    expect(
      shouldMountOffscreenManualTargetVideoView({
        itemIndex: 1,
        activeIndex: 0,
        warmedTargetIndex: 1,
        src: "https://cdn.example/2.mp4",
        platform: "android",
      })
    ).toBe(true);
    expect(
      shouldMountOffscreenManualTargetVideoView({
        itemIndex: 1,
        activeIndex: 0,
        warmedTargetIndex: null,
        src: "https://cdn.example/2.mp4",
        platform: "android",
      })
    ).toBe(false);
    expect(
      shouldLoadOwnedWatchPlayer({
        index: 1,
        activeIndex: 0,
        platform: "android",
        warmedTargetIndex: 1,
      })
    ).toBe(true);
  });
});
