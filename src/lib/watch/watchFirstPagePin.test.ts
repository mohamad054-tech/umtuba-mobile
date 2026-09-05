import { describe, expect, it } from "vitest";

import {
  decideWatchActiveIndexClaim,
  createWatchActiveIndexArbiter,
} from "./watchActiveIndexArbiter";
import {
  armWatchFirstPagePin,
  clearWatchFirstPagePin,
  createWatchFirstPagePinState,
  createWatchHandoffMachine,
  hasFirstWatchReverseDragEvidence,
  reduceWatchHandoff,
  resolveAutoNextHandoffCompletionTransaction,
  resolveFirstWatchCommitNativePin,
  resolveWatchFirstPagePinAlignment,
  resolveWatchHandoffIntentFromViewability,
  shouldApplyFirstWatchNativePin,
  shouldClaimWatchIndexFromNativeSettle,
  shouldClaimWatchIndexFromScrollToIndex,
  shouldRejectFirstWatchIndexZeroIntent,
} from "./watchManualHandoff";
import { resolveManualFirstWatchNativePin } from "./watchViewport";

const FROZEN_HEIGHT = 2100;

function boot() {
  return createWatchHandoffMachine({
    committedIndex: 0,
    committedMediaId: "media-0",
    committedGeneration: 1,
    navigationGeneration: 0,
  });
}

function readyTarget(index: number, mediaId: string, generation = 1) {
  return {
    index,
    mediaId,
    generation,
    surfaceAttached: true,
    firstFrame: true,
  };
}

describe("first 0→1 native pin + index-0 guard", () => {
  it("1. 80% commit 0→1 sets activeIndex 1 and native pin target 1", () => {
    const machine = boot();
    const commit = reduceWatchHandoff(machine, {
      type: "viewability-80",
      ...readyTarget(1, "media-1"),
    });
    expect(commit.action).toBe("silence-then-commit");
    expect(commit.next.committedIndex).toBe(1);
    expect(commit.commit?.toIndex).toBe(1);
    expect(commit.commit?.pinNativeOffset).toBe(false);

    let arbiter = createWatchActiveIndexArbiter();
    arbiter = decideWatchActiveIndexClaim({
      arbiter,
      reason: "bootstrap",
      requestedIndex: 0,
      navigationGeneration: 0,
    }).next;
    const claimed = decideWatchActiveIndexClaim({
      arbiter,
      reason: "handoff-commit",
      requestedIndex: 1,
      navigationGeneration: arbiter.navigationGeneration,
    });
    expect(claimed.accept).toBe(true);
    expect(claimed.next.activeIndex).toBe(1);

    const helperOffset = resolveManualFirstWatchNativePin({
      fromIndex: 0,
      toIndex: 1,
      frozenItemHeight: FROZEN_HEIGHT,
    });
    const pin = resolveFirstWatchCommitNativePin({
      fromIndex: commit.commit!.fromIndex,
      toIndex: commit.commit!.toIndex,
      frozenItemHeight: FROZEN_HEIGHT,
      navigationGeneration: commit.next.navigationGeneration,
    });
    expect(helperOffset).toBe(FROZEN_HEIGHT);
    expect(pin).toEqual({
      offset: FROZEN_HEIGHT,
      targetIndex: 1,
      navigationGeneration: commit.next.navigationGeneration,
    });
    expect(shouldClaimWatchIndexFromScrollToIndex()).toBe(false);
  });

  it("2. while first pin is in-flight, index-0 viewability cannot backward-commit", () => {
    const commit = reduceWatchHandoff(boot(), {
      type: "viewability-80",
      ...readyTarget(1, "media-1"),
    });
    const pin = armWatchFirstPagePin({
      navigationGeneration: commit.next.navigationGeneration,
    });
    const nominated = resolveWatchHandoffIntentFromViewability({
      viewableItems: [{ index: 0, isViewable: true, percentVisible: 80 }],
      committedIndex: 1,
      itemCount: 5,
    });
    expect(nominated).toBe(0);
    expect(
      shouldRejectFirstWatchIndexZeroIntent({
        nominatedIndex: nominated,
        committedIndex: 1,
        pin,
        currentGeneration: commit.next.navigationGeneration,
        reverseDragEvidence: false,
      })
    ).toBe(true);
  });

  it("3. native page 1 alignment clears the first-pin guard", () => {
    const pin = armWatchFirstPagePin({ navigationGeneration: 1 });
    expect(
      resolveWatchFirstPagePinAlignment({
        nativePage: 1,
        committedIndex: 1,
        pin,
        currentGeneration: 1,
      })
    ).toBe("clear");
    expect(clearWatchFirstPagePin(pin).inFlight).toBe(false);
    expect(
      resolveWatchFirstPagePinAlignment({
        nativePage: 0,
        committedIndex: 1,
        pin: clearWatchFirstPagePin(pin),
        currentGeneration: 1,
      })
    ).toBe("ignore");
  });

  it("4. after the guard clears, genuine reverse swipe 1→0 works at 80%", () => {
    const cleared = clearWatchFirstPagePin(
      armWatchFirstPagePin({ navigationGeneration: 1 })
    );
    expect(
      shouldRejectFirstWatchIndexZeroIntent({
        nominatedIndex: 0,
        committedIndex: 1,
        pin: cleared,
        currentGeneration: 1,
        reverseDragEvidence: false,
      })
    ).toBe(false);

    let machine = reduceWatchHandoff(boot(), {
      type: "viewability-80",
      ...readyTarget(1, "media-1"),
    }).next;
    machine = reduceWatchHandoff(machine, {
      type: "prepare",
      index: 0,
      mediaId: "media-0",
      generation: 1,
    }).next;
    const reverse = reduceWatchHandoff(machine, {
      type: "viewability-80",
      ...readyTarget(0, "media-0"),
    });
    expect(reverse.action).toBe("silence-then-commit");
    expect(reverse.commit?.fromIndex).toBe(1);
    expect(reverse.commit?.toIndex).toBe(0);

    expect(
      hasFirstWatchReverseDragEvidence({
        committedIndex: 1,
        dragStartIndex: 1,
        dragStartOffset: FROZEN_HEIGHT,
        dragTargetIndex: 0,
        itemHeight: FROZEN_HEIGHT,
      })
    ).toBe(true);
    expect(
      shouldRejectFirstWatchIndexZeroIntent({
        nominatedIndex: 0,
        committedIndex: 1,
        pin: armWatchFirstPagePin({ navigationGeneration: 1 }),
        currentGeneration: 1,
        reverseDragEvidence: true,
      })
    ).toBe(false);
  });

  it("5. wrong generation pin is ignored", () => {
    expect(
      shouldApplyFirstWatchNativePin({
        pinGeneration: 1,
        currentGeneration: 2,
      })
    ).toBe(false);
    expect(
      resolveFirstWatchCommitNativePin({
        fromIndex: 0,
        toIndex: 1,
        frozenItemHeight: FROZEN_HEIGHT,
        navigationGeneration: -1,
      })
    ).toBeNull();
    const pin = resolveFirstWatchCommitNativePin({
      fromIndex: 0,
      toIndex: 1,
      frozenItemHeight: FROZEN_HEIGHT,
      navigationGeneration: 1,
    });
    expect(pin?.navigationGeneration).toBe(1);
    expect(
      shouldApplyFirstWatchNativePin({
        pinGeneration: pin!.navigationGeneration,
        currentGeneration: 2,
      })
    ).toBe(false);
  });

  it("6. stale index-0 callback after generation change is ignored", () => {
    const pin = armWatchFirstPagePin({ navigationGeneration: 1 });
    expect(
      shouldRejectFirstWatchIndexZeroIntent({
        nominatedIndex: 0,
        committedIndex: 1,
        pin,
        currentGeneration: 2,
        reverseDragEvidence: false,
      })
    ).toBe(true);
    expect(
      resolveWatchFirstPagePinAlignment({
        nativePage: 0,
        committedIndex: 1,
        pin,
        currentGeneration: 2,
      })
    ).toBe("clear");
  });

  it("7. later 1→2 / 2→3 do not get a first-page pin", () => {
    expect(
      resolveFirstWatchCommitNativePin({
        fromIndex: 1,
        toIndex: 2,
        frozenItemHeight: FROZEN_HEIGHT,
        navigationGeneration: 2,
      })
    ).toBeNull();
    expect(
      resolveFirstWatchCommitNativePin({
        fromIndex: 2,
        toIndex: 3,
        frozenItemHeight: FROZEN_HEIGHT,
        navigationGeneration: 3,
      })
    ).toBeNull();
    expect(
      resolveManualFirstWatchNativePin({
        fromIndex: 1,
        toIndex: 2,
        frozenItemHeight: FROZEN_HEIGHT,
      })
    ).toBeNull();

    let machine = reduceWatchHandoff(boot(), {
      type: "viewability-80",
      ...readyTarget(1, "media-1"),
    }).next;
    const next = reduceWatchHandoff(machine, {
      type: "viewability-80",
      ...readyTarget(2, "media-2"),
    });
    expect(next.action).toBe("silence-then-commit");
    expect(next.commit?.pinNativeOffset).toBe(false);
    expect(next.next.committedIndex).toBe(2);
  });

  it("8. auto-next still pins through the machine and is not a first-page writer", () => {
    let machine = boot();
    machine = reduceWatchHandoff(machine, {
      type: "prepare",
      index: 1,
      mediaId: "media-1",
      generation: 1,
    }).next;
    const commit = reduceWatchHandoff(machine, {
      type: "auto-next",
      ...readyTarget(1, "media-1"),
    });
    expect(commit.action).toBe("silence-then-commit");
    expect(commit.commit?.pinNativeOffset).toBe(true);
    expect(resolveAutoNextHandoffCompletionTransaction().pinNativeOffset).toBe(
      true
    );
    expect(shouldClaimWatchIndexFromScrollToIndex()).toBe(false);
  });

  it("9. first 0→1 cannot revert to 0 from settle or viewability race", () => {
    const commit = reduceWatchHandoff(boot(), {
      type: "viewability-80",
      ...readyTarget(1, "media-1"),
    });
    expect(commit.next.committedIndex).toBe(1);
    const pin = armWatchFirstPagePin({
      navigationGeneration: commit.next.navigationGeneration,
    });
    expect(
      shouldRejectFirstWatchIndexZeroIntent({
        nominatedIndex: 0,
        committedIndex: 1,
        pin,
        currentGeneration: commit.next.navigationGeneration,
        reverseDragEvidence: false,
      })
    ).toBe(true);
    expect(
      reduceWatchHandoff(commit.next, { type: "settle", nativePage: 0 })
        .rejectReason
    ).toBe("stale-settle");
    expect(commit.next.committedIndex).toBe(1);
    expect(
      shouldClaimWatchIndexFromNativeSettle({
        platform: "android",
        nativePage: 0,
        activeIndex: 1,
      })
    ).toBe(false);
    expect(
      resolveWatchFirstPagePinAlignment({
        nativePage: 0,
        committedIndex: 1,
        pin,
        currentGeneration: commit.next.navigationGeneration,
      })
    ).toBe("keep");
    expect(
      hasFirstWatchReverseDragEvidence({
        committedIndex: 1,
        dragStartIndex: 1,
        dragStartOffset: 0,
        dragTargetIndex: 0,
        itemHeight: FROZEN_HEIGHT,
      })
    ).toBe(false);
    expect(createWatchFirstPagePinState().inFlight).toBe(false);
  });
});
