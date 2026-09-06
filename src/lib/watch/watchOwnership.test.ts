import { describe, expect, it, vi } from "vitest";

vi.mock("expo-video", () => ({
  setVideoCacheSizeAsync: async () => undefined,
}));

import { ANDROID_WATCH_CACHE_TARGET } from "./androidWatchMediaCache";
import { createPlayerSession } from "./playerSession";
import {
  applyWatchOwnershipSilence,
  commitWatchOwnership,
  countNativeAudibleOwners,
  createWatchOwnershipState,
  describeWatchPlayerDiagnostic,
  isNonOwnerNativeSilent,
  isWatchOwnershipAtomic,
  mayUnmuteNewOwner,
  resolveWatchBindActiveIndex,
  resolveWatchCommitExtraData,
  shouldAcceptBackwardOwnership,
  shouldCompleteOwnershipTransaction,
  shouldHonorViewability80Intent,
  shouldRejectStaleOwnershipEvent,
  shouldRetainPreviousOwnerSurface,
  shouldRetireWatchPlayer,
  shouldSyncNativePageAfterCommit,
  unlockWatchAudibleOwner,
  watchCommitExtraDataIncludesGeneration,
  watchCommitRemountsVisibleCell,
  watchViewabilityIsIntentOnly,
  WATCH_MAX_AUDIBLE_PLAYERS,
  WATCH_VIEWABILITY_PERCENT_THRESHOLD,
} from "./watchOwnership";

function ownerPlayer(index: number, mediaId: string) {
  return describeWatchPlayerDiagnostic({
    playerId: `p-${index}`,
    index,
    mediaId,
    isOwner: true,
    playWhenReady: true,
    isPlaying: true,
    muted: false,
    volume: 1,
    surfaceId: `s-${index}`,
  });
}

function silentNeighbor(index: number, mediaId: string) {
  return describeWatchPlayerDiagnostic({
    playerId: `p-${index}`,
    index,
    mediaId,
    isOwner: false,
    playWhenReady: true,
    isPlaying: true,
    muted: false,
    volume: 1,
    surfaceId: `s-${index}`,
  });
}

describe("ONE_NATIVE_AUDIO_OWNER", () => {
  it("allows at most one audible native owner", () => {
    const players = [
      ownerPlayer(1, "post-1"),
      silentNeighbor(0, "post-0"),
      silentNeighbor(2, "post-2"),
    ];
    expect(countNativeAudibleOwners(players)).toBe(WATCH_MAX_AUDIBLE_PLAYERS);
    expect(players.filter((row) => !row.isOwner).every(isNonOwnerNativeSilent)).toBe(
      true
    );
  });
});

describe("STABLE_VISIBLE_CELL_NO_COMMIT_REMOUNT", () => {
  it("keeps cell key and player slot across N→N+1 extraData", () => {
    const prev = resolveWatchCommitExtraData({
      activeIndex: 0,
      interactionSignature: "likes",
    });
    const next = resolveWatchCommitExtraData({
      activeIndex: 1,
      interactionSignature: "likes",
    });
    expect(watchCommitExtraDataIncludesGeneration(next)).toBe(false);
    expect(
      watchCommitRemountsVisibleCell({
        prevExtraData: prev,
        nextExtraData: next,
        prevCellKey: "post-1",
        nextCellKey: "post-1",
        prevPlayerSlot: { postKey: "post-1", src: "file://a", instanceGeneration: 0 },
        nextPlayerSlot: { postKey: "post-1", src: "file://a", instanceGeneration: 0 },
      })
    ).toBe(false);
  });
});

describe("NATIVE_PAGE_EQUALS_COMMITTED_INDEX / PRESENTATION / BOUND MEDIA", () => {
  it("requires visible page, presentation, bound media, and audio to match", () => {
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
        presentationOwner: 1,
        boundMediaIndex: 1,
        audibleOwner: 1,
      })
    ).toBe(false);
  });
});

describe("FIRST_0_TO_1_NO_SNAPBACK", () => {
  it("uses the same 80% intent path and rejects stale page-0 without reverse drag", () => {
    expect(watchViewabilityIsIntentOnly()).toBe(true);
    expect(
      shouldHonorViewability80Intent({
        viewableIndex: 1,
        committedIndex: 0,
        reverseDrag: false,
      })
    ).toBe(true);
    const after = commitWatchOwnership({
      state: createWatchOwnershipState(0, "post-0"),
      toIndex: 1,
      mediaId: "post-1",
      previousSilenced: true,
    });
    expect(after.committedIndex).toBe(1);
    expect(
      shouldHonorViewability80Intent({
        viewableIndex: 0,
        committedIndex: after.committedIndex,
        reverseDrag: false,
      })
    ).toBe(false);
    expect(
      shouldSyncNativePageAfterCommit({
        reason: "viewability-80",
        nativePage: 0,
        committedIndex: 1,
      })
    ).toBe(false);
  });
});

describe("FORWARD_1_2_3_NO_SNAPBACK", () => {
  it("commits 1→2→3 without remount or page-0 intent", () => {
    let state = createWatchOwnershipState(1, "post-1");
    state = commitWatchOwnership({
      state,
      toIndex: 2,
      mediaId: "post-2",
      previousSilenced: true,
    });
    state = commitWatchOwnership({
      state,
      toIndex: 3,
      mediaId: "post-3",
      previousSilenced: true,
    });
    expect(state.committedIndex).toBe(3);
    expect(state.presentationOwner).toBe(3);
    expect(
      shouldHonorViewability80Intent({
        viewableIndex: 0,
        committedIndex: 3,
        reverseDrag: false,
      })
    ).toBe(false);
  });
});

describe("FIRST_3_NO_AUDIO_OVERLAP / PREVIOUS_PLAYER_SILENCED_BEFORE_NEXT_AUDIO", () => {
  it("unmutes the next owner only after the previous player is silenced", () => {
    const previous = createPlayerSession();
    previous.player.play();
    const silence = applyWatchOwnershipSilence(previous.player);
    expect(silence.silenced).toBe(true);
    expect(silence.effectiveVolume).toBe(0);
    expect(previous.player.muted).toBe(true);
    expect(previous.player.volume).toBe(0);
    expect(previous.calls).toContain("pause");
    expect(
      mayUnmuteNewOwner({
        previousSilenced: false,
        isPresentationOwner: true,
        isAudioOwner: true,
        userMuted: false,
      })
    ).toBe(false);
    expect(
      mayUnmuteNewOwner({
        previousSilenced: true,
        isPresentationOwner: true,
        isAudioOwner: true,
        userMuted: false,
      })
    ).toBe(true);
    const phase1 = commitWatchOwnership({
      state: createWatchOwnershipState(0, "post-0"),
      toIndex: 1,
      mediaId: "post-1",
      previousSilenced: false,
    });
    expect(phase1.audibleOwner).toBeNull();
    expect(unlockWatchAudibleOwner(phase1).audibleOwner).toBe(1);
  });
});

describe("BACKWARD_RETAINED_SURFACE_REBINDS / BACKWARD_NO_BLACK / BACKWARD_CORRECT_AUDIO_OWNER", () => {
  it("keeps the previous owner mounted and rebinds the retained surface", () => {
    expect(
      shouldRetainPreviousOwnerSurface({
        itemIndex: 1,
        committedIndex: 2,
        previousIndex: 1,
      })
    ).toBe(true);
    expect(
      shouldAcceptBackwardOwnership({
        toIndex: 1,
        fromIndex: 2,
        cachedSourceValid: true,
        reboundSurface: true,
        reboundMediaId: "post-1",
        expectedMediaId: "post-1",
      })
    ).toBe(true);
    expect(
      shouldAcceptBackwardOwnership({
        toIndex: 1,
        fromIndex: 2,
        cachedSourceValid: true,
        reboundSurface: false,
        reboundMediaId: "post-1",
        expectedMediaId: "post-1",
      })
    ).toBe(false);
    const back = commitWatchOwnership({
      state: {
        ...createWatchOwnershipState(2, "post-2"),
        previousIndex: 1,
      },
      toIndex: 1,
      mediaId: "post-1",
      previousSilenced: true,
    });
    expect(back.committedIndex).toBe(1);
    expect(back.audibleOwner).toBe(1);
    expect(back.presentationOwner).toBe(1);
  });
});

describe("STALE_FIRST_FRAME / SETTLE / CURRENT_END NO EFFECT", () => {
  it("rejects stale identity events after commit", () => {
    expect(
      shouldRejectStaleOwnershipEvent({
        eventIndex: 0,
        eventMediaId: "post-0",
        eventGeneration: 1,
        committedIndex: 1,
        committedMediaId: "post-1",
        committedGeneration: 2,
      })
    ).toBe(true);
    expect(
      shouldRejectStaleOwnershipEvent({
        eventIndex: 1,
        eventMediaId: "post-0",
        committedIndex: 1,
        committedMediaId: "post-1",
        committedGeneration: 2,
      })
    ).toBe(true);
    expect(
      shouldRejectStaleOwnershipEvent({
        eventIndex: 1,
        eventMediaId: "post-1",
        eventGeneration: 2,
        committedIndex: 1,
        committedMediaId: "post-1",
        committedGeneration: 2,
      })
    ).toBe(false);
  });
});

describe("80_PERCENT_HANDOFF_PRESERVED / CACHE_5_PRESERVED", () => {
  it("keeps the 80% intent threshold and cache target 5", () => {
    expect(WATCH_VIEWABILITY_PERCENT_THRESHOLD).toBe(80);
    expect(ANDROID_WATCH_CACHE_TARGET).toBe(5);
    expect(
      shouldCompleteOwnershipTransaction({
        toIndex: 1,
        targetMediaId: "post-1",
        targetBoundMediaId: "post-1",
        targetSurfaceAttached: true,
        targetPresentationReady: true,
      })
    ).toBe(true);
  });
});

describe("bind logs never forge activeIndex", () => {
  it("reports the committed index for inactive cells", () => {
    expect(
      resolveWatchBindActiveIndex({ listIndex: 0, committedIndex: 2 })
    ).toBe(2);
  });
});

describe("retired players leave the live window", () => {
  it("retires indexes outside committed/previous/prepare", () => {
    expect(
      shouldRetireWatchPlayer({
        index: 0,
        committedIndex: 3,
        previousIndex: 2,
        preparedIndexes: [2, 3, 4],
      })
    ).toBe(true);
    expect(
      shouldRetireWatchPlayer({
        index: 2,
        committedIndex: 3,
        previousIndex: 2,
        preparedIndexes: [2, 3, 4],
      })
    ).toBe(false);
  });
});
