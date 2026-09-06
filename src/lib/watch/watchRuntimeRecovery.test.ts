import { describe, expect, it, vi } from "vitest";

vi.mock("expo-video", () => ({
  setVideoCacheSizeAsync: async () => undefined,
}));

import { ANDROID_WATCH_CACHE_TARGET } from "./androidWatchMediaCache";
import {
  isBackwardRetainedPlaybackCoherent,
  isVisibleIndexSurfaceAudioAtomic,
  shouldRebindRetainedWatchSurface,
} from "./watchCellBinding";
import {
  applyWatchHandoffAudioTransfer,
  getWatchHandoffAudibleOwner,
  mayAllowWatchHandoffAudio,
  registerWatchPlayer,
  resetWatchHandoffAudibleOwner,
  resetWatchPlayerRegistry,
  shouldUnmuteWatchAfterFirstFrame,
} from "./playerLifecycle";
import { createPlayerSession } from "./playerSession";
import {
  armWatchFirstPagePin,
  armWatchForwardCommitLock,
  createWatchForwardCommitLock,
  createWatchHandoffMachine,
  hasGenuineReverseDragEvidence,
  reduceWatchHandoff,
  resolveWatchHandoffIntentFromViewability,
  shouldClearForwardCommitLock,
  shouldIgnoreStaleManualSettle,
  shouldRejectLockedBackwardViewability,
  shouldRejectStaleWatchIdentityEvent,
  shouldResyncNativeAfterStaleSettle,
} from "./watchManualHandoff";

const HEIGHT = 2100;

function boot(index = 0, mediaId = "media-0") {
  return createWatchHandoffMachine({
    committedIndex: index,
    committedMediaId: mediaId,
    committedGeneration: 1,
    navigationGeneration: 0,
  });
}

function ready(index: number, mediaId: string, generation = 1) {
  return {
    index,
    mediaId,
    generation,
    surfaceAttached: true,
    firstFrame: true,
  };
}

function commitForward(from: number) {
  let machine = boot(from, `media-${from}`);
  const commit = reduceWatchHandoff(machine, {
    type: "viewability-80",
    ...ready(from + 1, `media-${from + 1}`),
  });
  return commit;
}

describe("FIRST_0_TO_1_NO_SNAPBACK", () => {
  it("1→2 cannot revert from a stale page-0 / page-from event", () => {
    const first = commitForward(0);
    expect(first.action).toBe("silence-then-commit");
    expect(first.next.committedIndex).toBe(1);
    expect(first.commit?.pinNativeOffset).toBe(false);

    const lock = armWatchForwardCommitLock({
      fromIndex: 0,
      toIndex: 1,
      navigationGeneration: first.next.navigationGeneration,
    });
    expect(lock?.armed).toBe(true);

    const nominated = resolveWatchHandoffIntentFromViewability({
      viewableItems: [{ index: 0, isViewable: true, percentVisible: 80 }],
      committedIndex: 1,
      itemCount: 5,
    });
    expect(nominated).toBe(0);
    expect(
      shouldRejectLockedBackwardViewability({
        nominatedIndex: nominated,
        committedIndex: 1,
        lock: lock!,
        currentGeneration: first.next.navigationGeneration,
        reverseDragEvidence: false,
      })
    ).toBe(true);

    expect(
      reduceWatchHandoff(first.next, { type: "settle", nativePage: 0 })
        .rejectReason
    ).toBe("stale-settle");
    expect(
      shouldIgnoreStaleManualSettle({
        locked: false,
        nativePage: 0,
        activeIndex: 1,
      })
    ).toBe(true);
    expect(
      shouldResyncNativeAfterStaleSettle({
        lock: lock!,
        nativePage: 0,
        committedIndex: 1,
        reverseDragEvidence: false,
      })
    ).toBe(true);
    expect(
      shouldClearForwardCommitLock({
        lock: lock!,
        committedIndex: 1,
        currentGeneration: first.next.navigationGeneration,
        reverseDragEvidence: false,
      })
    ).toBe(false);

    const afterBlip = armWatchFirstPagePin({
      navigationGeneration: first.next.navigationGeneration,
    });
    expect(
      shouldRejectLockedBackwardViewability({
        nominatedIndex: 0,
        committedIndex: 1,
        lock: lock!,
        currentGeneration: first.next.navigationGeneration,
        reverseDragEvidence: false,
      })
    ).toBe(true);
    expect(afterBlip.inFlight).toBe(true);
  });
});

describe("FIRST_3_SINGLE_AUDIO_OWNER", () => {
  it("1→2→3 has one audio owner and previous players are muted first", () => {
    resetWatchHandoffAudibleOwner();
    resetWatchPlayerRegistry();
    const players = [0, 1, 2].map(() => createPlayerSession());
    players.forEach((session, index) => {
      registerWatchPlayer(index, session.player);
      session.player.muted = false;
      session.player.volume = 1;
    });

    const first = applyWatchHandoffAudioTransfer({
      previousPlayer: players[0]!.player,
      previousIndex: 0,
      nextIndex: 1,
      platform: "android",
      previousItemReady: true,
    });
    expect(first.simultaneousAudible).toBe(false);
    expect(first.audibleOwnerIndex).toBe(1);
    expect(getWatchHandoffAudibleOwner()).toBe(1);
    expect(players[0]!.player.muted).toBe(true);
    expect(players[2]!.player.muted).toBe(true);
    expect(mayAllowWatchHandoffAudio({ index: 0, isActive: true })).toBe(false);
    expect(mayAllowWatchHandoffAudio({ index: 1, isActive: true })).toBe(true);
    expect(
      shouldUnmuteWatchAfterFirstFrame({
        firstFrameConfirmed: true,
        isActive: true,
        shouldPlay: true,
        userMuted: false,
        surfaceAttached: true,
        itemIndex: 0,
      })
    ).toBe(false);
    expect(
      shouldUnmuteWatchAfterFirstFrame({
        firstFrameConfirmed: true,
        isActive: true,
        shouldPlay: true,
        userMuted: false,
        surfaceAttached: true,
      })
    ).toBe(false);

    const second = applyWatchHandoffAudioTransfer({
      previousPlayer: players[1]!.player,
      previousIndex: 1,
      nextIndex: 2,
      platform: "android",
      previousItemReady: true,
    });
    expect(second.audibleOwnerIndex).toBe(2);
    expect(players[0]!.player.muted).toBe(true);
    expect(players[1]!.player.muted).toBe(true);
    expect(mayAllowWatchHandoffAudio({ index: 2, isActive: true })).toBe(true);
    expect(mayAllowWatchHandoffAudio({ index: 1, isActive: true })).toBe(false);
  });
});

describe("BACKWARD_RETAINED_SURFACE_REBINDS", () => {
  it("cached backward target rebinds the correct surface/media", () => {
    expect(
      shouldRebindRetainedWatchSurface({
        direction: "backward",
        cachedHit: true,
        playerMediaId: "post-823",
        targetMediaId: "post-823",
        surfaceAttached: false,
      })
    ).toBe(true);
    expect(
      shouldRebindRetainedWatchSurface({
        direction: "backward",
        cachedHit: true,
        playerMediaId: "post-822",
        targetMediaId: "post-823",
        surfaceAttached: true,
      })
    ).toBe(true);
    expect(
      shouldRebindRetainedWatchSurface({
        direction: "forward",
        cachedHit: true,
        playerMediaId: "post-822",
        targetMediaId: "post-822",
        surfaceAttached: true,
      })
    ).toBe(false);
  });
});

describe("BACKWARD_NO_BLACK", () => {
  it("retained backward playback cannot be black while another owner is audible", () => {
    expect(
      isBackwardRetainedPlaybackCoherent({
        visibleIndex: 1,
        committedIndex: 1,
        playerMediaId: "post-823",
        targetMediaId: "post-823",
        surfaceAttached: true,
        firstFrame: true,
        audibleOwnerIndex: 1,
        blackSurface: false,
      })
    ).toBe(true);
    expect(
      isBackwardRetainedPlaybackCoherent({
        visibleIndex: 1,
        committedIndex: 1,
        playerMediaId: "post-823",
        targetMediaId: "post-823",
        surfaceAttached: false,
        firstFrame: false,
        audibleOwnerIndex: 2,
        blackSurface: true,
      })
    ).toBe(false);
  });
});

describe("BACKWARD_CORRECT_AUDIO_OWNER", () => {
  it("backward 2→1 keeps a single audible owner on the committed index", () => {
    resetWatchHandoffAudibleOwner();
    resetWatchPlayerRegistry();
    const previous = createPlayerSession();
    const target = createPlayerSession();
    registerWatchPlayer(2, previous.player);
    registerWatchPlayer(1, target.player);
    previous.player.muted = false;
    previous.player.volume = 1;

    let machine = commitForward(0).next;
    machine = reduceWatchHandoff(machine, {
      type: "viewability-80",
      ...ready(2, "media-2"),
    }).next;
    const reverse = reduceWatchHandoff(machine, {
      type: "viewability-80",
      ...ready(1, "media-1"),
    });
    expect(reverse.action).toBe("silence-then-commit");
    expect(reverse.commit?.fromIndex).toBe(2);
    expect(reverse.commit?.toIndex).toBe(1);

    const transfer = applyWatchHandoffAudioTransfer({
      previousPlayer: previous.player,
      previousIndex: 2,
      nextIndex: 1,
      platform: "android",
      previousItemReady: true,
    });
    expect(transfer.audibleOwnerIndex).toBe(1);
    expect(previous.player.muted).toBe(true);
    expect(mayAllowWatchHandoffAudio({ index: 2, isActive: true })).toBe(false);
    expect(mayAllowWatchHandoffAudio({ index: 1, isActive: true })).toBe(true);
  });
});

describe("VISIBLE_INDEX_SURFACE_AUDIO_ATOMICITY", () => {
  it("visible page, committed index, surface, and audio stay one identity", () => {
    expect(
      isVisibleIndexSurfaceAudioAtomic({
        visiblePage: 2,
        committedIndex: 2,
        presentationOwner: 2,
        boundMediaId: "post-822",
        committedMediaId: "post-822",
        audibleOwnerIndex: 2,
      })
    ).toBe(true);
    expect(
      isVisibleIndexSurfaceAudioAtomic({
        visiblePage: 2,
        committedIndex: 1,
        presentationOwner: 2,
        boundMediaId: "post-822",
        committedMediaId: "post-823",
        audibleOwnerIndex: 1,
      })
    ).toBe(false);
    expect(
      isVisibleIndexSurfaceAudioAtomic({
        visiblePage: 2,
        committedIndex: 2,
        presentationOwner: 2,
        boundMediaId: "post-822",
        committedMediaId: "post-822",
        audibleOwnerIndex: 1,
      })
    ).toBe(false);
  });
});

describe("stale identity events", () => {
  it("rejects stale first_frame, settle, and current_end", () => {
    const machine = reduceWatchHandoff(boot(), {
      type: "prepare",
      index: 1,
      mediaId: "media-1",
      generation: 4,
    }).next;
    expect(
      reduceWatchHandoff(machine, {
        type: "first-frame",
        index: 1,
        mediaId: "media-stale",
        generation: 4,
        surfaceAttached: true,
      }).rejectReason
    ).toBe("stale-first-frame");
    expect(
      reduceWatchHandoff(machine, {
        type: "first-frame",
        index: 1,
        mediaId: "media-1",
        generation: 3,
        surfaceAttached: true,
      }).rejectReason
    ).toBe("stale-first-frame");

    const committed = commitForward(1);
    expect(
      reduceWatchHandoff(committed.next, { type: "settle", nativePage: 1 })
        .rejectReason
    ).toBe("stale-settle");

    expect(
      reduceWatchHandoff(committed.next, {
        type: "current-end",
        index: 1,
        mediaId: "media-1",
        generation: 1,
        surfaceAttached: true,
        firstFrame: true,
      }).rejectReason
    ).toBe("auto-next-not-next");
    expect(
      reduceWatchHandoff(
        reduceWatchHandoff(committed.next, {
          type: "prepare",
          index: 3,
          mediaId: "media-3",
          generation: 9,
        }).next,
        {
          type: "current-end",
          index: 3,
          mediaId: "media-wrong",
          generation: 9,
          surfaceAttached: true,
          firstFrame: true,
        }
      ).rejectReason
    ).toBe("stale-current-end");
    expect(
      shouldRejectStaleWatchIdentityEvent({
        eventIndex: 1,
        eventMediaId: "media-1",
        eventGeneration: 1,
        expectedIndex: 1,
        expectedMediaId: "media-1",
        expectedGeneration: 2,
      })
    ).toBe(true);
  });
});

describe("preserved 80% and cache 5", () => {
  it("keeps the 80% viewability threshold and rolling cache of 5", () => {
    expect(ANDROID_WATCH_CACHE_TARGET).toBe(5);
    const nominated = resolveWatchHandoffIntentFromViewability({
      viewableItems: [{ index: 1, isViewable: true, percentVisible: 80 }],
      committedIndex: 0,
      itemCount: 5,
    });
    expect(nominated).toBe(1);
    const commit = commitForward(0);
    expect(commit.action).toBe("silence-then-commit");
    expect(commit.commit?.toIndex).toBe(1);
    expect(
      hasGenuineReverseDragEvidence({
        committedIndex: 1,
        lockToIndex: 1,
        dragStartIndex: 1,
        dragStartOffset: HEIGHT,
        dragTargetIndex: 0,
        itemHeight: HEIGHT,
      })
    ).toBe(true);
    expect(createWatchForwardCommitLock().armed).toBe(false);
  });
});
