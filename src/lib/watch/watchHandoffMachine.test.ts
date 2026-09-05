import { describe, expect, it } from "vitest";

import {
  createWatchActiveIndexArbiter,
  decideWatchActiveIndexClaim,
  decideWatchViewabilityEvidence,
  shouldLoadOwnedWatchPlayer,
} from "./watchActiveIndexArbiter";
import {
  applyWatchHandoffAudioTransfer,
  resetWatchHandoffAudibleOwner,
  shouldStartPlaybackAfterAsset,
} from "./playerLifecycle";
import { createPlayerSession } from "./playerSession";
import {
  createWatchHandoffMachine,
  isWatchPresentationReady,
  preparedWatchNeighborIsSilentOwner,
  reduceWatchHandoff,
  resolveAutoNextHandoffCompletionTransaction,
  resolveProactivePrepareIndexes,
  resolveWatchHandoffIntentFromViewability,
  shouldClaimWatchIndexFromNativeSettle,
  shouldClaimWatchIndexFromScrollToIndex,
  shouldRejectOwnedBlackSurface,
  shouldStartManualHandoffAudio,
} from "./watchManualHandoff";

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

describe("A PREPARE", () => {
  it("prepares N+1 silently without stealing activeIndex or audio", () => {
    let machine = boot();
    expect(resolveProactivePrepareIndexes({ committedIndex: 0, itemCount: 5 })).toEqual([1]);
    const prepared = reduceWatchHandoff(machine, {
      type: "prepare",
      index: 1,
      mediaId: "media-1",
      generation: 1,
    });
    expect(prepared.action).toBe("prepare");
    machine = prepared.next;
    expect(machine.committedIndex).toBe(0);
    expect(machine.prepared?.index).toBe(1);
    const silent = preparedWatchNeighborIsSilentOwner({
      itemIndex: 1,
      committedIndex: 0,
      preparedIndex: 1,
    });
    expect(silent.mayBecomeAudible).toBe(false);
    expect(silent.mayStealActiveIndex).toBe(false);
    expect(
      shouldStartManualHandoffAudio({
        targetSurfaceAttached: true,
        targetFirstFrame: true,
        targetIsActive: false,
      })
    ).toBe(false);
    expect(
      shouldLoadOwnedWatchPlayer({
        index: 1,
        activeIndex: 0,
        platform: "android",
        prepareAdjacentNeighbors: true,
      })
    ).toBe(true);
    const frame = reduceWatchHandoff(machine, {
      type: "first-frame",
      index: 1,
      mediaId: "media-1",
      generation: 1,
      surfaceAttached: true,
    });
    expect(frame.action).toBe("none");
    expect(frame.next.committedIndex).toBe(0);
    expect(frame.next.prepared?.firstFrame).toBe(true);
  });

  it("rejects a prepared neighbor with the wrong media or generation", () => {
    let machine = boot();
    machine = reduceWatchHandoff(machine, {
      type: "prepare",
      index: 1,
      mediaId: "media-1",
      generation: 1,
    }).next;
    const wrong = reduceWatchHandoff(machine, {
      type: "prepare-progress",
      index: 1,
      mediaId: "media-99",
      generation: 1,
      surfaceAttached: true,
      firstFrame: true,
    });
    expect(wrong.action).toBe("reject");
    expect(wrong.rejectReason).toBe("wrong-media-generation");
    expect(wrong.next.committedIndex).toBe(0);
    const staleGen = reduceWatchHandoff(machine, {
      type: "prepare-progress",
      index: 1,
      mediaId: "media-1",
      generation: 9,
      surfaceAttached: true,
      firstFrame: true,
    });
    expect(staleGen.action).toBe("reject");
    expect(staleGen.rejectReason).toBe("wrong-media-generation");
  });
});

describe("B 80%", () => {
  it("keeps N active at 79% and commits N+1 at 80% when ready", () => {
    let machine = boot();
    machine = reduceWatchHandoff(machine, {
      type: "prepare",
      index: 1,
      mediaId: "media-1",
      generation: 1,
    }).next;
    machine = reduceWatchHandoff(machine, {
      type: "first-frame",
      index: 1,
      mediaId: "media-1",
      generation: 1,
      surfaceAttached: true,
    }).next;
    expect(
      resolveWatchHandoffIntentFromViewability({
        viewableItems: [{ index: 0, isViewable: true, percentVisible: 79 }],
        committedIndex: 0,
        itemCount: 5,
      })
    ).toBeNull();
    expect(
      resolveWatchHandoffIntentFromViewability({
        viewableItems: [{ index: 1, isViewable: true, percentVisible: 80 }],
        committedIndex: 0,
        itemCount: 5,
      })
    ).toBe(1);
    expect(decideWatchViewabilityEvidence().mayClaimActiveIndex).toBe(false);
    const unprepared = boot();
    const notReady = reduceWatchHandoff(unprepared, {
      type: "viewability-80",
      index: 1,
      mediaId: "media-1",
      generation: 1,
      surfaceAttached: false,
      firstFrame: false,
    });
    expect(notReady.action).toBe("intent");
    expect(notReady.next.committedIndex).toBe(0);
    expect(
      shouldRejectOwnedBlackSurface({
        ownedIndex: 1,
        targetIndex: 1,
        surfaceReady: false,
      })
    ).toBe(true);
    const commit = reduceWatchHandoff(machine, {
      type: "viewability-80",
      ...readyTarget(1, "media-1"),
    });
    expect(commit.action).toBe("silence-then-commit");
    expect(commit.commit?.toIndex).toBe(1);
    expect(commit.commit?.pinNativeOffset).toBe(false);
    expect(commit.commit?.silenceIndex).toBe(0);
    expect(commit.commit?.allowAudioIndex).toBe(1);
    expect(commit.next.committedIndex).toBe(1);
  });

  it("commits once when first_frame arrives after INTENT", () => {
    let machine = boot();
    const intent = reduceWatchHandoff(machine, {
      type: "viewability-80",
      index: 1,
      mediaId: "media-1",
      generation: 1,
      surfaceAttached: false,
      firstFrame: false,
    });
    expect(intent.action).toBe("intent");
    machine = intent.next;
    const first = reduceWatchHandoff(machine, {
      type: "first-frame",
      index: 1,
      mediaId: "media-1",
      generation: 1,
      surfaceAttached: true,
    });
    expect(first.action).toBe("silence-then-commit");
    const second = reduceWatchHandoff(first.next, {
      type: "first-frame",
      index: 1,
      mediaId: "media-1",
      generation: 1,
      surfaceAttached: true,
    });
    expect(second.action).toBe("reject");
    expect(second.next.committedIndex).toBe(1);
  });

  it("handles a backward 80% swipe symmetrically", () => {
    let machine = createWatchHandoffMachine({
      committedIndex: 2,
      committedMediaId: "media-2",
      committedGeneration: 3,
      navigationGeneration: 2,
    });
    machine = reduceWatchHandoff(machine, {
      type: "prepare",
      index: 1,
      mediaId: "media-1",
      generation: 3,
    }).next;
    const intent = resolveWatchHandoffIntentFromViewability({
      viewableItems: [{ index: 1, isViewable: true, percentVisible: 80 }],
      committedIndex: 2,
      itemCount: 5,
    });
    expect(intent).toBe(1);
    const commit = reduceWatchHandoff(machine, {
      type: "viewability-80",
      ...readyTarget(1, "media-1", 3),
    });
    expect(commit.action).toBe("silence-then-commit");
    expect(commit.commit?.fromIndex).toBe(2);
    expect(commit.commit?.toIndex).toBe(1);
  });
});

describe("C BLACK", () => {
  it("never owns a target without a presentation-ready surface", () => {
    expect(
      isWatchPresentationReady({
        surfaceAttached: false,
        firstFrame: false,
        mediaId: "media-1",
        expectedMediaId: "media-1",
        generation: 1,
        expectedGeneration: 1,
      })
    ).toBe(false);
    const machine = boot();
    const black = reduceWatchHandoff(machine, {
      type: "viewability-80",
      index: 1,
      mediaId: "media-1",
      generation: 1,
      surfaceAttached: false,
      firstFrame: false,
    });
    expect(black.action).toBe("intent");
    expect(black.next.committedIndex).toBe(0);
    const stale = reduceWatchHandoff(machine, {
      type: "first-frame",
      index: 4,
      mediaId: "media-4",
      generation: 1,
      surfaceAttached: true,
    });
    expect(stale.action).toBe("reject");
    expect(stale.next.committedIndex).toBe(0);
  });

  it("rapid 1→2→3→4 never commits an unready page", () => {
    let machine = boot();
    for (const index of [1, 2, 3, 4]) {
      const result = reduceWatchHandoff(machine, {
        type: "viewability-80",
        index,
        mediaId: `media-${index}`,
        generation: 1,
        surfaceAttached: false,
        firstFrame: false,
      });
      if (Math.abs(index - machine.committedIndex) !== 1) {
        expect(result.action).toBe("reject");
        continue;
      }
      expect(result.action).toBe("intent");
      expect(result.next.committedIndex).toBe(machine.committedIndex);
      machine = result.next;
    }
  });
});

describe("D AUDIO", () => {
  it("mutes the previous owner before the next is allowed to play", () => {
    resetWatchHandoffAudibleOwner();
    const previous = createPlayerSession();
    previous.player.muted = false;
    previous.player.volume = 1;
    const machine = boot();
    const commit = reduceWatchHandoff(machine, {
      type: "viewability-80",
      ...readyTarget(1, "media-1"),
    });
    expect(commit.commit?.silenceIndex).toBe(0);
    expect(commit.commit?.allowAudioIndex).toBe(1);
    const transfer = applyWatchHandoffAudioTransfer({
      previousPlayer: previous.player,
      previousIndex: commit.commit!.silenceIndex,
      nextIndex: commit.commit!.allowAudioIndex,
      platform: "android",
      previousItemReady: true,
    });
    expect(previous.player.muted).toBe(true);
    expect(transfer.simultaneousAudible).toBe(false);
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
        itemIndex: 0,
      })
    ).toBe(false);
    resetWatchHandoffAudibleOwner();
  });
});

describe("E SNAPBACK", () => {
  it("rejects stale index 0, settle, current_end, and scrollToIndex after later commits", () => {
    let machine = boot();
    machine = reduceWatchHandoff(machine, {
      type: "viewability-80",
      ...readyTarget(1, "media-1"),
    }).next;
    machine = reduceWatchHandoff(machine, {
      type: "viewability-80",
      ...readyTarget(2, "media-2"),
    }).next;
    expect(machine.committedIndex).toBe(2);
    expect(
      reduceWatchHandoff(machine, {
        type: "viewability-80",
        ...readyTarget(0, "media-0"),
      }).rejectReason
    ).toBe("non-adjacent-intent");
    expect(
      reduceWatchHandoff(machine, { type: "settle", nativePage: 0 }).rejectReason
    ).toBe("stale-settle");
    expect(
      reduceWatchHandoff(machine, {
        type: "current-end",
        ...readyTarget(0, "media-0"),
      }).rejectReason
    ).toBe("auto-next-not-next");
    expect(
      reduceWatchHandoff(machine, { type: "scroll-to-index", index: 0 }).rejectReason
    ).toBe("independent-writer-forbidden");
    expect(shouldClaimWatchIndexFromNativeSettle({
      platform: "android",
      nativePage: 0,
      activeIndex: 2,
    })).toBe(false);
    expect(shouldClaimWatchIndexFromScrollToIndex()).toBe(false);
    expect(machine.committedIndex).toBe(2);
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
    arbiter = decideWatchActiveIndexClaim({
      arbiter,
      reason: "handoff-commit",
      requestedIndex: 2,
      navigationGeneration: arbiter.navigationGeneration,
      nativeSettledPage: 2,
    }).next;
    expect(
      decideWatchActiveIndexClaim({
        arbiter,
        reason: "handoff-commit",
        requestedIndex: 0,
        navigationGeneration: arbiter.navigationGeneration,
        nativeSettledPage: null,
      }).accept
    ).toBe(false);
    expect(arbiter.activeIndex).toBe(2);
  });
});

describe("F AUTO NEXT", () => {
  it("uses the same machine and does not keep a separate writer", () => {
    let machine = boot();
    machine = reduceWatchHandoff(machine, {
      type: "prepare",
      index: 1,
      mediaId: "media-1",
      generation: 1,
    }).next;
    const pending = reduceWatchHandoff(machine, {
      type: "auto-next",
      index: 1,
      mediaId: "media-1",
      generation: 1,
      surfaceAttached: false,
      firstFrame: false,
    });
    expect(pending.action).toBe("intent");
    expect(pending.next.committedIndex).toBe(0);
    const commit = reduceWatchHandoff(pending.next, {
      type: "first-frame",
      index: 1,
      mediaId: "media-1",
      generation: 1,
      surfaceAttached: true,
    });
    expect(commit.action).toBe("silence-then-commit");
    expect(commit.commit?.pinNativeOffset).toBe(true);
    expect(commit.commit?.claimReason).toBe("handoff-commit");
    expect(resolveAutoNextHandoffCompletionTransaction().claimReason).toBe(
      "handoff-commit"
    );
    expect(
      decideWatchActiveIndexClaim({
        arbiter: createWatchActiveIndexArbiter(),
        reason: "programmatic",
        requestedIndex: 1,
        navigationGeneration: 0,
      }).rejectReason
    ).toBe("independent-writer-forbidden");
  });
});
