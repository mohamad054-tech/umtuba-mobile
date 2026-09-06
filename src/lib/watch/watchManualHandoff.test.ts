import { describe, expect, it, vi } from "vitest";

vi.mock("expo-video", () => ({
  setVideoCacheSizeAsync: async () => undefined,
}));

import {
  resolveWatchTapPauseCommand,
  shouldHandoffWatchAdvance,
  shouldLifecycleResumeAfterUserPause,
} from "./playbackPolicy";
import {
  shouldStartPlaybackAfterAsset,
  shouldUnmuteWatchAfterFirstFrame,
} from "./playerLifecycle";
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

import { ANDROID_WATCH_CACHE_TARGET } from "./androidWatchMediaCache";
import {
  countNativeAudibleOwners,
  describeWatchPlayerDiagnostic,
  isWatchOwnershipAtomic,
  WATCH_VIEWABILITY_PERCENT_THRESHOLD,
} from "./watchOwnership";
import {
  createManualHandoffPending,
  isRetainedPresentationReady,
  manualViewabilityMayWriteActiveIndex,
  resolveAndroidManualSettleAction,
  resolveManualHandoffCancelTransaction,
  resolveManualHandoffCompletionTransaction,
  resolveManualHandoffRetarget,
  resolveManualHandoffTarget,
  resolveNoFirstFrameManualHandoff,
  resolvePendingManualHandoffAction,
  resolveWatchViewabilityIntentEffect,
  shouldAcceptPendingManualHandoff,
  shouldCancelPendingManualHandoff,
  shouldClaimWatchIndexFromNativeSettle,
  shouldCompleteManualHandoff,
  shouldIgnoreStaleManualSettle,
  shouldKeepPreviousSurfaceDuringManualHandoff,
  shouldMountOffscreenManualTargetVideoView,
  shouldRejectStaleManualHandoffEvent,
  shouldReleasePreviousWatchSurface,
  shouldStartManualHandoffAudio,
  shouldWarmManualTarget,
  targetMayBecomeAudible,
  viewabilityMayCommitHandoff,
  viewabilityMayForgeNativePage,
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
    ).toBe(false);
    expect(
      shouldStartManualHandoffAudio({
        targetSurfaceAttached: true,
        targetFirstFrame: true,
        targetIsActive: true,
        isAudioOwner: true,
        handoffCommitted: true,
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
      pinNativeOffset: false,
    });
    expect(resolveManualHandoffCompletionTransaction("auto-next")).toEqual({
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
      phase: "intent",
      nativePageForged: false,
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

describe("bounded handoff commit/cancel correction", () => {
  const pending01 = createManualHandoffPending({
    navigationGeneration: 1,
    targetIndex: 1,
    targetMediaId: "post-2",
  });
  const pending12 = createManualHandoffPending({
    navigationGeneration: 2,
    targetIndex: 2,
    targetMediaId: "post-3",
  });
  const pending10 = createManualHandoffPending({
    navigationGeneration: 3,
    targetIndex: 0,
    targetMediaId: "post-1",
  });

  function accept(input: {
    pending: NonNullable<typeof pending01>;
    nativeSettledPage: number | null;
    nativePageSource?: "viewability" | "scroll-offset" | "proven-settle";
    targetFirstFrame?: boolean;
    targetRetainedReady?: boolean;
    firstFrameMediaId?: string | null;
  }) {
    return shouldAcceptPendingManualHandoff({
      pending: input.pending,
      currentNavigationGeneration: input.pending.navigationGeneration,
      nativeSettledPage: input.nativeSettledPage,
      nativePageSource: input.nativePageSource,
      currentTargetMediaId: input.pending.targetMediaId,
      firstFrameMediaId:
        input.firstFrameMediaId === undefined
          ? input.pending.targetMediaId
          : input.firstFrameMediaId,
      targetSurfaceAttached: true,
      targetFirstFrame: input.targetFirstFrame ?? false,
      targetRetainedReady: input.targetRetainedReady,
      retainedReadyMediaId: input.targetRetainedReady
        ? input.pending.targetMediaId
        : null,
      screenFocused: true,
      shareSheetOpen: false,
      unmounted: false,
    });
  }

  function players(audibleIndex: number | null) {
    return [0, 1, 2].map((index) =>
      describeWatchPlayerDiagnostic({
        playerId: `p${index}`,
        index,
        mediaId: `post-${index + 1}`,
        isOwner: audibleIndex === index,
        playWhenReady: audibleIndex === index,
        isPlaying: audibleIndex === index,
        muted: audibleIndex !== index,
        volume: audibleIndex === index ? 1 : 0,
        surfaceId: `s${index}`,
      })
    );
  }

  it("1. 79% creates no intent or commit", () => {
    const effect = resolveWatchViewabilityIntentEffect(79);
    expect(effect.phase).toBe("none");
    expect(effect.commit).toBe(false);
    expect(effect.setAudioOwner).toBe(false);
    expect(viewabilityMayCommitHandoff()).toBe(false);
  });

  it("2. 80% is INTENT only", () => {
    const effect = resolveWatchViewabilityIntentEffect(80);
    expect(effect.phase).toBe("intent");
    expect(effect.commit).toBe(false);
    expect(effect.forgeNativePage).toBe(false);
    expect(effect.setAudioOwner).toBe(false);
    expect(effect.unmuteTarget).toBe(false);
    expect(pending01?.phase).toBe("intent");
    expect(pending01?.nativePageForged).toBe(false);
    expect(manualViewabilityMayWriteActiveIndex()).toBe(false);
  });

  it("3. 80% + ready without real native commit keeps target silent", () => {
    expect(
      accept({
        pending: pending01!,
        nativeSettledPage: 1,
        nativePageSource: "viewability",
        targetFirstFrame: true,
      })
    ).toBe(false);
    expect(
      accept({
        pending: pending01!,
        nativeSettledPage: 0,
        nativePageSource: "proven-settle",
        targetFirstFrame: true,
      })
    ).toBe(false);
    expect(
      shouldStartManualHandoffAudio({
        targetSurfaceAttached: true,
        targetFirstFrame: true,
        targetIsActive: false,
        isAudioOwner: false,
        handoffCommitted: false,
      })
    ).toBe(false);
    expect(
      targetMayBecomeAudible({
        handoffCommitted: false,
        isAudioOwner: false,
        isPresentationOwner: false,
        previousSilenced: false,
      })
    ).toBe(false);
  });

  it("4. real native commit makes target the sole audio owner", () => {
    expect(
      accept({
        pending: pending01!,
        nativeSettledPage: 1,
        nativePageSource: "proven-settle",
        targetFirstFrame: true,
      })
    ).toBe(true);
    expect(
      targetMayBecomeAudible({
        handoffCommitted: true,
        isAudioOwner: true,
        isPresentationOwner: true,
        previousSilenced: true,
      })
    ).toBe(true);
    expect(countNativeAudibleOwners(players(1))).toBe(1);
  });

  it("5. slow 80% reverse restores N as sole audio owner", () => {
    const cancel = resolveManualHandoffCancelTransaction({ currentIndex: 0 });
    expect(cancel.pending).toBeNull();
    expect(cancel.presentationOwner).toBe(0);
    expect(cancel.audibleOwner).toBe(0);
    expect(cancel.handoffState).toBe("cancelled");
    expect(countNativeAudibleOwners(players(cancel.audibleOwner))).toBe(1);
  });

  it("6. target audio does not survive cancel", () => {
    const cancel = resolveManualHandoffCancelTransaction({ currentIndex: 0 });
    expect(cancel.silenceTarget).toBe(true);
    expect(
      targetMayBecomeAudible({
        handoffCommitted: false,
        isAudioOwner: false,
        isPresentationOwner: false,
        previousSilenced: false,
      })
    ).toBe(false);
    expect(
      shouldStartManualHandoffAudio({
        targetSurfaceAttached: true,
        targetFirstFrame: true,
        targetIsActive: false,
        isAudioOwner: false,
        handoffCommitted: false,
      })
    ).toBe(false);
  });

  it("7. stale first_frame after cancel cannot unmute target", () => {
    expect(
      shouldRejectStaleManualHandoffEvent({
        eventIndex: 1,
        eventMediaId: "post-2",
        eventGeneration: 4,
        pendingIndex: null,
        pendingMediaId: null,
        pendingGeneration: 5,
        handoffState: "cancelled",
      })
    ).toBe(true);
    expect(
      shouldUnmuteWatchAfterFirstFrame({
        firstFrameConfirmed: true,
        isActive: false,
        shouldPlay: true,
        userMuted: false,
        surfaceAttached: true,
        isAudioOwner: false,
        playerMediaId: "post-2",
        visibleMediaId: "post-2",
      })
    ).toBe(false);
  });

  it("8. index 1 preloaded first_frame cannot unlock audio early", () => {
    expect(
      accept({
        pending: pending01!,
        nativeSettledPage: 1,
        nativePageSource: "viewability",
        targetFirstFrame: true,
      })
    ).toBe(false);
    expect(viewabilityMayForgeNativePage()).toBe(false);
    expect(
      shouldUnmuteWatchAfterFirstFrame({
        firstFrameConfirmed: true,
        isActive: true,
        shouldPlay: true,
        userMuted: false,
        surfaceAttached: true,
        isAudioOwner: false,
        playerMediaId: "post-2",
        visibleMediaId: "post-2",
      })
    ).toBe(false);
    expect(
      shouldStartManualHandoffAudio({
        targetSurfaceAttached: true,
        targetFirstFrame: true,
        targetIsActive: true,
        isAudioOwner: false,
        handoffCommitted: false,
      })
    ).toBe(false);
  });

  it("9. backward retained-ready cell can commit without a new first_frame", () => {
    expect(
      isRetainedPresentationReady(
        {
          index: 0,
          mediaId: "post-1",
          surfaceAttached: true,
          firstFrame: true,
          generation: 1,
        },
        { index: 0, mediaId: "post-1" }
      )
    ).toBe(true);
    expect(
      accept({
        pending: pending10!,
        nativeSettledPage: 0,
        nativePageSource: "proven-settle",
        targetFirstFrame: false,
        targetRetainedReady: true,
        firstFrameMediaId: null,
      })
    ).toBe(true);
    expect(
      shouldCompleteManualHandoff({
        nativeSettledPage: 0,
        targetIndex: 0,
        targetSurfaceAttached: true,
        targetFirstFrame: false,
        targetRetainedReady: true,
      })
    ).toBe(true);
  });

  it("10. backward commit transfers audio to the previous visible item", () => {
    expect(
      targetMayBecomeAudible({
        handoffCommitted: true,
        isAudioOwner: true,
        isPresentationOwner: true,
        previousSilenced: true,
      })
    ).toBe(true);
    expect(
      isWatchOwnershipAtomic({
        nativeVisiblePage: 0,
        committedIndex: 0,
        presentationOwner: 0,
        boundMediaIndex: 0,
        audibleOwner: 0,
      })
    ).toBe(true);
    expect(countNativeAudibleOwners(players(0))).toBe(1);
    expect(countNativeAudibleOwners(players(1))).toBe(1);
  });

  it("11. 1→2 picture and audio stay the same owner", () => {
    expect(
      isWatchOwnershipAtomic({
        nativeVisiblePage: 1,
        committedIndex: 1,
        presentationOwner: 1,
        boundMediaIndex: 1,
        audibleOwner: 1,
      })
    ).toBe(true);
    expect(
      isWatchOwnershipAtomic({
        nativeVisiblePage: 0,
        committedIndex: 1,
        presentationOwner: 0,
        boundMediaIndex: 1,
        audibleOwner: 1,
      })
    ).toBe(false);
  });

  it("12. 2→3 still works", () => {
    expect(
      accept({
        pending: pending12!,
        nativeSettledPage: 2,
        nativePageSource: "proven-settle",
        targetFirstFrame: true,
      })
    ).toBe(true);
    expect(
      isWatchOwnershipAtomic({
        nativeVisiblePage: 2,
        committedIndex: 2,
        presentationOwner: 2,
        boundMediaIndex: 2,
        audibleOwner: 2,
      })
    ).toBe(true);
  });

  it("13. first 3 videos never have more than one audible owner", () => {
    expect(countNativeAudibleOwners(players(0))).toBeLessThanOrEqual(1);
    expect(countNativeAudibleOwners(players(1))).toBeLessThanOrEqual(1);
    expect(countNativeAudibleOwners(players(2))).toBeLessThanOrEqual(1);
    expect(countNativeAudibleOwners(players(null))).toBe(0);
  });

  it("14. backward retained handoff does not accept a black page", () => {
    const stuck = resolveNoFirstFrameManualHandoff({ currentActiveIndex: 2 });
    expect(stuck.acceptBlackAsComplete).toBe(false);
    expect(stuck.complete).toBe(false);
    expect(
      shouldCompleteManualHandoff({
        nativeSettledPage: 1,
        targetIndex: 1,
        targetSurfaceAttached: false,
        targetFirstFrame: false,
        targetRetainedReady: false,
      })
    ).toBe(false);
    expect(
      shouldKeepPreviousSurfaceDuringManualHandoff({
        handoffCompleted: false,
      })
    ).toBe(true);
    expect(
      shouldCompleteManualHandoff({
        nativeSettledPage: 1,
        targetIndex: 1,
        targetSurfaceAttached: true,
        targetFirstFrame: false,
        targetRetainedReady: true,
      })
    ).toBe(true);
  });

  it("15. 80% threshold is unchanged", () => {
    expect(WATCH_VIEWABILITY_PERCENT_THRESHOLD).toBe(80);
    expect(resolveWatchViewabilityIntentEffect(79).phase).toBe("none");
    expect(resolveWatchViewabilityIntentEffect(80).phase).toBe("intent");
  });

  it("16. cache 5 is unchanged", () => {
    expect(ANDROID_WATCH_CACHE_TARGET).toBe(5);
  });
});
