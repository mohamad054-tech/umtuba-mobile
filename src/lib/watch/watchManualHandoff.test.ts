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
  isAccidentalManualSwipe,
  resolveManualHandoffRetarget,
  resolveManualHandoffTarget,
  resolveManualProgressOrigin,
  resolveManualScrollProgress,
  resolveWatchDragTarget,
  resolveNoFirstFrameManualHandoff,
  shouldCommitShortManualSwipe,
  resolvePendingManualHandoffAction,
  shouldAcceptPendingManualHandoff,
  shouldCancelPendingManualHandoff,
  shouldClaimWatchIndexFromNativeSettle,
  shouldCompleteManualHandoff,
  shouldIgnoreStaleManualSettle,
  shouldKeepPreviousSurfaceDuringManualHandoff,
  shouldApplyWatchPage0Pin,
  shouldPinWatchScrollAfterNativeSettle,
  shouldProgrammaticCommitWatchShortSwipe,
  shouldRejectCollapsedForwardSnapToZero,
  resolveWatchEndDragNativePage,
  shouldMountOffscreenManualTargetVideoView,
  shouldReleasePreviousWatchSurface,
  shouldStartManualHandoffAudio,
  shouldWarmManualTarget,
  WATCH_SHORT_SWIPE_FLICK_PAGES_PER_SEC,
  WATCH_SHORT_SWIPE_PAGE_FRACTION,
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

  it("commits a short 20% swipe on release and ignores tiny movement", () => {
    const height = 800;
    expect(
      resolveManualScrollProgress({
        fromIndex: 0,
        currentOffset: 152,
        itemHeight: height,
        itemCount: 5,
      })
    ).toEqual({ targetIndex: 1, pageFraction: 0.19, deltaPx: 152 });
    expect(
      shouldCommitShortManualSwipe({
        fromIndex: 0,
        targetIndex: 1,
        pageFraction: 0.19,
        velocityY: 0,
        itemHeight: height,
      })
    ).toBe(false);
    expect(
      isAccidentalManualSwipe({
        pageFraction: 0.19,
        velocityY: 0,
        itemHeight: height,
      })
    ).toBe(true);
    expect(
      resolveManualScrollProgress({
        fromIndex: 0,
        currentOffset: 160,
        itemHeight: height,
        itemCount: 5,
      })
    ).toEqual({ targetIndex: 1, pageFraction: 0.2, deltaPx: 160 });
    expect(
      shouldCommitShortManualSwipe({
        fromIndex: 0,
        targetIndex: 1,
        pageFraction: 0.2,
        velocityY: 0,
        itemHeight: height,
      })
    ).toBe(true);
    expect(
      shouldCommitShortManualSwipe({
        fromIndex: 2,
        targetIndex: 1,
        pageFraction: 0.2,
        velocityY: 0,
        itemHeight: height,
      })
    ).toBe(true);
    expect(
      shouldCommitShortManualSwipe({
        fromIndex: 0,
        targetIndex: 1,
        pageFraction: 0.12,
        velocityY: height,
        itemHeight: height,
      })
    ).toBe(true);
    expect(
      shouldCommitShortManualSwipe({
        fromIndex: 0,
        targetIndex: 1,
        pageFraction: 0.2,
        velocityY: -height,
        itemHeight: height,
      })
    ).toBe(true);
    expect(
      shouldCommitShortManualSwipe({
        fromIndex: 0,
        targetIndex: 1,
        pageFraction: 0.12,
        velocityY: -height,
        itemHeight: height,
      })
    ).toBe(false);
    expect(manualViewabilityMayWriteActiveIndex()).toBe(false);
    expect(
      shouldCompleteManualHandoff({
        nativeSettledPage: 1,
        targetIndex: 1,
        targetSurfaceAttached: true,
        targetFirstFrame: false,
      })
    ).toBe(false);
    expect(
      resolveWatchEndDragNativePage({
        currentOffset: 160,
        itemHeight: height,
        itemCount: 5,
      })
    ).toBe(0);
    expect(
      shouldProgrammaticCommitWatchShortSwipe({
        targetIndex: 1,
        nativeRoundedPage: 0,
      })
    ).toBe(true);
    expect(
      resolveWatchEndDragNativePage({
        currentOffset: 480,
        itemHeight: height,
        itemCount: 5,
      })
    ).toBe(1);
    expect(
      shouldProgrammaticCommitWatchShortSwipe({
        targetIndex: 1,
        nativeRoundedPage: 1,
        fromIndex: 1,
      })
    ).toBe(false);
    expect(
      shouldProgrammaticCommitWatchShortSwipe({
        targetIndex: 1,
        nativeRoundedPage: 1,
        fromIndex: 0,
      })
    ).toBe(true);
    expect(
      shouldPinWatchScrollAfterNativeSettle({
        currentOffset: 800,
        targetOffset: 800,
      })
    ).toBe(false);
    expect(
      shouldPinWatchScrollAfterNativeSettle({
        currentOffset: 160,
        targetOffset: 800,
      })
    ).toBe(true);
  });

  it("page-1 normal forward never collapses to 0 after a stale page-0 offset", () => {
    const height = 800;
    expect(WATCH_SHORT_SWIPE_PAGE_FRACTION).toBe(0.2);
    expect(WATCH_SHORT_SWIPE_FLICK_PAGES_PER_SEC).toBe(1);
    expect(shouldApplyWatchPage0Pin({ fromIndex: 0, targetIndex: 1 })).toBe(
      true
    );
    expect(shouldApplyWatchPage0Pin({ fromIndex: 1, targetIndex: 2 })).toBe(
      false
    );
    expect(shouldApplyWatchPage0Pin({ fromIndex: 1, targetIndex: 0 })).toBe(
      false
    );

    const collapsedForward = resolveManualScrollProgress({
      fromIndex: 1,
      currentOffset: 480,
      itemHeight: height,
      itemCount: 8,
      dragStartOffset: 0,
    });
    expect(collapsedForward.targetIndex).toBe(2);
    expect(collapsedForward.deltaPx).toBe(480);
    expect(collapsedForward.pageFraction).toBe(0.6);
    expect(
      shouldRejectCollapsedForwardSnapToZero({
        fromIndex: 1,
        targetIndex: 0,
        deltaPx: 480,
      })
    ).toBe(true);
    expect(
      shouldCommitShortManualSwipe({
        fromIndex: 1,
        targetIndex: collapsedForward.targetIndex,
        pageFraction: collapsedForward.pageFraction,
        velocityY: 0,
        itemHeight: height,
        deltaPx: collapsedForward.deltaPx,
      })
    ).toBe(true);
    expect(
      resolveWatchDragTarget({
        fromIndex: 1,
        directionalTarget: 2,
        nativeHint: 0,
        dragDeltaPx: 480,
      })
    ).toBe(2);

    const aligned12 = resolveManualScrollProgress({
      fromIndex: 1,
      currentOffset: 1280,
      itemHeight: height,
      itemCount: 8,
      dragStartOffset: 800,
    });
    expect(aligned12.targetIndex).toBe(2);
    expect(aligned12.pageFraction).toBe(0.6);
    expect(
      shouldProgrammaticCommitWatchShortSwipe({
        targetIndex: 2,
        nativeRoundedPage: 2,
        fromIndex: 1,
      })
    ).toBe(false);

    const short12 = resolveManualScrollProgress({
      fromIndex: 1,
      currentOffset: 960,
      itemHeight: height,
      itemCount: 8,
      dragStartOffset: 800,
    });
    expect(short12.targetIndex).toBe(2);
    expect(short12.pageFraction).toBe(0.2);
    expect(
      shouldCommitShortManualSwipe({
        fromIndex: 1,
        targetIndex: 2,
        pageFraction: 0.2,
        velocityY: 0,
        itemHeight: height,
        deltaPx: 160,
      })
    ).toBe(true);

    const flick12 = shouldCommitShortManualSwipe({
      fromIndex: 1,
      targetIndex: 2,
      pageFraction: 0.12,
      velocityY: height,
      itemHeight: height,
      deltaPx: 96,
    });
    expect(flick12).toBe(true);

    const realBack = resolveManualScrollProgress({
      fromIndex: 1,
      currentOffset: 320,
      itemHeight: height,
      itemCount: 8,
      dragStartOffset: 800,
    });
    expect(realBack.targetIndex).toBe(0);
    expect(realBack.deltaPx).toBe(-480);
    expect(
      shouldRejectCollapsedForwardSnapToZero({
        fromIndex: 1,
        targetIndex: 0,
        deltaPx: -480,
      })
    ).toBe(false);

    const page23 = resolveManualScrollProgress({
      fromIndex: 2,
      currentOffset: 2080,
      itemHeight: height,
      itemCount: 8,
      dragStartOffset: 1600,
    });
    expect(page23.targetIndex).toBe(3);
    expect(
      shouldApplyWatchPage0Pin({ fromIndex: 2, targetIndex: 3 })
    ).toBe(false);
    expect(
      resolveManualProgressOrigin({
        fromIndex: 1,
        itemHeight: height,
        dragStartOffset: 0,
      })
    ).toBe(0);
    expect(
      resolveManualHandoffTarget({
        fromIndex: 0,
        currentOffset: 160,
        itemHeight: height,
        itemCount: 8,
      })
    ).toBe(1);
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
