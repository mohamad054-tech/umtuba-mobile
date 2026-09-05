import { describe, expect, it } from "vitest";

import {
  resolveWatchTapPauseCommand,
  shouldLifecycleResumeAfterUserPause,
  shouldPlayWithUserPause,
} from "./playbackPolicy";
import { shouldStartPlaybackAfterAsset } from "./playerLifecycle";
import {
  createWatchActiveIndexArbiter,
  decideWatchActiveIndexClaim,
  decideWatchViewabilityEvidence,
  shouldLoadOwnedWatchPlayer,
  shouldRejectStaleIndexZero,
  shouldRetainWatchSurface,
} from "./watchActiveIndexArbiter";

function commit(
  arbiter: ReturnType<typeof createWatchActiveIndexArbiter>,
  page: number
) {
  return decideWatchActiveIndexClaim({
    arbiter,
    reason: "handoff-commit",
    requestedIndex: page,
    navigationGeneration: arbiter.navigationGeneration,
    nativeSettledPage: page,
  });
}

describe("watch activeIndex arbiter — Fold6 14:29:17 / 14:29:24", () => {
  it("keeps index 1 after settle 0→1 when delayed viewability/bootstrap claim 0", () => {
    let arbiter = createWatchActiveIndexArbiter();
    const boot = decideWatchActiveIndexClaim({
      arbiter,
      reason: "bootstrap",
      requestedIndex: 0,
      navigationGeneration: 0,
    });
    expect(boot.accept).toBe(true);
    arbiter = boot.next;
    expect(arbiter.activeIndex).toBe(0);

    const toOne = commit(arbiter, 1);
    expect(toOne.accept).toBe(true);
    arbiter = toOne.next;
    expect(arbiter.activeIndex).toBe(1);
    expect(arbiter.lastSettledNativePage).toBe(1);

    expect(decideWatchViewabilityEvidence().mayClaimActiveIndex).toBe(false);

    const delayedViewabilityZero = decideWatchActiveIndexClaim({
      arbiter,
      reason: "bootstrap",
      requestedIndex: 0,
      navigationGeneration: arbiter.navigationGeneration,
    });
    expect(delayedViewabilityZero.accept).toBe(false);
    expect(delayedViewabilityZero.rejectReason).toBe("bootstrap-after-claim");
    expect(arbiter.activeIndex).toBe(1);

    const staleOffsetZero = decideWatchActiveIndexClaim({
      arbiter,
      reason: "native-settle",
      requestedIndex: 0,
      navigationGeneration: arbiter.navigationGeneration,
      nativeSettledPage: null,
    });
    expect(staleOffsetZero.accept).toBe(false);
    expect(staleOffsetZero.rejectReason).toBe("independent-writer-forbidden");
    expect(staleOffsetZero.next.activeIndex).toBe(1);
    expect(
      decideWatchActiveIndexClaim({
        arbiter,
        reason: "handoff-commit",
        requestedIndex: 0,
        navigationGeneration: arbiter.navigationGeneration,
        nativeSettledPage: null,
      }).accept
    ).toBe(false);

    expect(
      shouldRejectStaleIndexZero({
        requestedIndex: 0,
        lastSettledNativePage: 1,
        provenNativePage: null,
      })
    ).toBe(true);
    expect(shouldRetainWatchSurface({
      itemIndex: 1,
      activeIndex: 0,
      lastSettledNativePage: 1,
    })).toBe(true);
    expect(
      shouldLoadOwnedWatchPlayer({
        index: 1,
        activeIndex: 0,
        platform: "android",
        lastSettledNativePage: 1,
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
        surfaceAttached: true,
      })
    ).toBe(true);
    expect(arbiter.activeIndex).toBe(1);
    expect(arbiter.lastSettledNativePage).toBe(1);
  });

  it("allows a real back swipe when native offset proves page 0", () => {
    let arbiter = createWatchActiveIndexArbiter();
    arbiter = decideWatchActiveIndexClaim({
      arbiter,
      reason: "bootstrap",
      requestedIndex: 0,
      navigationGeneration: 0,
    }).next;
    arbiter = commit(arbiter, 1).next;
    const back = commit(arbiter, 0);
    expect(back.accept).toBe(true);
    expect(back.next.activeIndex).toBe(0);
    expect(back.next.lastSettledNativePage).toBe(0);
  });

  it("rejects a stale handoff generation after auto-advance", () => {
    let arbiter = createWatchActiveIndexArbiter();
    arbiter = decideWatchActiveIndexClaim({
      arbiter,
      reason: "bootstrap",
      requestedIndex: 0,
      navigationGeneration: 0,
    }).next;
    const first = decideWatchActiveIndexClaim({
      arbiter,
      reason: "handoff-commit",
      requestedIndex: 2,
      navigationGeneration: arbiter.navigationGeneration,
      nativeSettledPage: 2,
    });
    expect(first.accept).toBe(true);
    arbiter = first.next;
    expect(
      decideWatchActiveIndexClaim({
        arbiter,
        reason: "programmatic",
        requestedIndex: 0,
        navigationGeneration: arbiter.navigationGeneration,
      }).rejectReason
    ).toBe("independent-writer-forbidden");
    const stale = decideWatchActiveIndexClaim({
      arbiter,
      reason: "handoff-commit",
      requestedIndex: 0,
      navigationGeneration: 0,
    });
    expect(stale.accept).toBe(false);
    expect(stale.rejectReason).toBe("stale-generation");
    expect(arbiter.activeIndex).toBe(2);
  });
});

describe("first-video tap pause latch", () => {
  it("invokes the handler, issues pause, and blocks lifecycle resume", () => {
    const tap = resolveWatchTapPauseCommand({
      isActive: true,
      feedShouldPlay: true,
      paneStatus: "ready",
      userPaused: false,
    });
    expect(tap.invokeHandler).toBe(true);
    expect(tap.pauseCommand).toBe(true);
    expect(tap.nextUserPaused).toBe(true);
    expect(tap.shouldPlay).toBe(false);
    expect(
      shouldPlayWithUserPause({
        feedShouldPlay: true,
        userPaused: tap.nextUserPaused,
        isActive: true,
      })
    ).toBe(false);
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
        shouldPlay: tap.shouldPlay,
        playerAlive: true,
        ownerGeneration: 1,
        commandGeneration: 1,
        surfaceAttached: true,
      })
    ).toBe(false);
  });
});
