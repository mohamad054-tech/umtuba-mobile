import { describe, expect, it } from "vitest";

import type { WatchVideo } from "@/src/contracts/watch";
import {
  dedupeWatchVideosPreserveOrder,
  mergeWatchVideos,
  resolveWatchIndexFromScrollOffset,
  shouldAttachWatchSurface,
} from "./playbackPolicy";
import { shouldStartPlaybackAfterAsset } from "./playerLifecycle";
import {
  isOneCellLateBinding,
  isWatchCellBindingAligned,
  isWatchSwipeBindingCorrect,
  resolveWatchBoundCellSource,
  shouldReplaceWatchCellSource,
  watchMediaIdentity,
  watchSequenceStaysAligned,
} from "./watchCellBinding";

function video(id: string, postId: number | null, src = `https://cdn.example/${id}.mp4`): WatchVideo {
  return {
    id,
    postId,
    src,
    title: id,
    caption: "",
    location: { city: "", country: "" },
    music: "",
    aiSummary: "",
    translation: "",
    author: { id: null, name: "a", username: "@a", avatar: "A" },
    stats: { likes: 0, comments: 0, shares: 0, saves: 0, views: 0 },
    likedByMe: false,
    savedByMe: false,
    source: "supabase",
  };
}

describe("watchMediaIdentity", () => {
  it("uses post id, never the list index", () => {
    expect(watchMediaIdentity({ id: "clip-a", postId: 41 })).toBe("post-41");
    expect(watchMediaIdentity({ id: "legacy-clip" })).toBe("legacy-clip");
    expect(watchMediaIdentity({ id: "clip-a", postId: 41 })).not.toBe("0");
  });
});

describe("Watch 1 → 2 swipe binding", () => {
  it("aligns picture, audio, cell, player, and media id on video 2", () => {
    const step = {
      visibleIndex: 1,
      visibleMediaId: "post-2",
      cellKey: "post-2",
      playerMediaId: "post-2",
      surfaceMediaId: "post-2",
      cachedMediaId: "post-2",
      audioMediaId: "post-2",
    };
    expect(isWatchSwipeBindingCorrect(step)).toBe(true);
    expect(
      isWatchCellBindingAligned({
        visibleIndex: 1,
        visibleMediaId: "post-2",
        activeIndex: 1,
        activeMediaId: "post-2",
        playerMediaId: "post-2",
        cachedMediaId: "post-2",
        surfaceMediaId: "post-2",
      })
    ).toBe(true);
    expect(
      shouldStartPlaybackAfterAsset({
        nativeReady: true,
        jsReady: true,
        isActive: true,
        shouldPlay: true,
        playerAlive: true,
        ownerGeneration: 1,
        commandGeneration: 1,
        surfaceAttached: true,
        playerMediaId: "post-2",
        visibleMediaId: "post-2",
      })
    ).toBe(true);
  });

  it("rejects video 2 audio on a black or stale video 1 surface", () => {
    expect(
      isWatchSwipeBindingCorrect({
        visibleIndex: 1,
        visibleMediaId: "post-2",
        cellKey: "post-2",
        playerMediaId: "post-2",
        surfaceMediaId: "post-1",
        cachedMediaId: "post-2",
        audioMediaId: "post-2",
      })
    ).toBe(false);
    expect(
      shouldStartPlaybackAfterAsset({
        nativeReady: true,
        jsReady: true,
        isActive: true,
        shouldPlay: true,
        playerAlive: true,
        ownerGeneration: 1,
        commandGeneration: 1,
        surfaceAttached: false,
        playerMediaId: "post-2",
        visibleMediaId: "post-2",
      })
    ).toBe(false);
  });
});

describe("Watch 2 → 3 swipe binding", () => {
  it("lands on video 3, never video 1", () => {
    const steps = [
      {
        index: 0,
        mediaId: "post-1",
        playerMediaId: "post-1",
        surfaceMediaId: "post-1",
      },
      {
        index: 1,
        mediaId: "post-2",
        playerMediaId: "post-2",
        surfaceMediaId: "post-2",
      },
      {
        index: 2,
        mediaId: "post-3",
        playerMediaId: "post-3",
        surfaceMediaId: "post-3",
      },
    ];
    expect(watchSequenceStaysAligned(steps)).toBe(true);
    expect(
      isWatchSwipeBindingCorrect({
        visibleIndex: 2,
        visibleMediaId: "post-3",
        cellKey: "post-3",
        playerMediaId: "post-3",
        surfaceMediaId: "post-3",
        cachedMediaId: "post-3",
        audioMediaId: "post-3",
      })
    ).toBe(true);
    expect(resolveWatchIndexFromScrollOffset(1600, 800, 5)).toBe(2);
    expect(resolveWatchIndexFromScrollOffset(0, 800, 5)).not.toBe(2);
  });

  it("rejects snap-back to video 1", () => {
    expect(
      watchSequenceStaysAligned([
        {
          index: 0,
          mediaId: "post-1",
          playerMediaId: "post-1",
          surfaceMediaId: "post-1",
        },
        {
          index: 1,
          mediaId: "post-2",
          playerMediaId: "post-2",
          surfaceMediaId: "post-2",
        },
        {
          index: 2,
          mediaId: "post-1",
          playerMediaId: "post-1",
          surfaceMediaId: "post-1",
        },
      ])
    ).toBe(false);
    expect(
      isWatchSwipeBindingCorrect({
        visibleIndex: 2,
        visibleMediaId: "post-3",
        cellKey: "post-1",
        playerMediaId: "post-1",
        surfaceMediaId: "post-1",
        audioMediaId: "post-1",
      })
    ).toBe(false);
  });
});

describe("duplicate post IDs", () => {
  it("strips duplicate post IDs without reordering first-seen items", () => {
    const first = video("clip-a", 11, "https://cdn.example/a.mp4");
    const second = video("clip-b", 12, "https://cdn.example/b.mp4");
    const dupFirst = video("clip-a-again", 11, "https://cdn.example/a-dup.mp4");
    const third = video("clip-c", 13, "https://cdn.example/c.mp4");
    const page = [first, second, dupFirst, third, { ...second, id: "clip-b-page2" }];
    const deduped = dedupeWatchVideosPreserveOrder(page);
    expect(deduped.map((item) => watchMediaIdentity(item))).toEqual([
      "post-11",
      "post-12",
      "post-13",
    ]);
    expect(deduped.map((item) => item.src)).toEqual([
      "https://cdn.example/a.mp4",
      "https://cdn.example/b.mp4",
      "https://cdn.example/c.mp4",
    ]);
    const merged = mergeWatchVideos(
      [first, second],
      [dupFirst, third, { ...first, id: "page-2-first" }]
    );
    expect(merged.map((item) => watchMediaIdentity(item))).toEqual([
      "post-11",
      "post-12",
      "post-13",
    ]);
    expect(merged[0]?.src).toBe("https://cdn.example/a.mp4");
  });
});

describe("recycled cell source replacement", () => {
  it("cannot keep a stale player or src after key/post change", () => {
    const stale = resolveWatchBoundCellSource({
      cellMediaId: "post-2",
      cellSrc: "https://cdn.example/2.mp4",
      playerMediaId: "post-1",
      playerSrc: "https://cdn.example/1.mp4",
    });
    expect(stale.mustReplace).toBe(true);
    expect(stale.mediaId).toBe("post-2");
    expect(stale.src).toBe("https://cdn.example/2.mp4");
    expect(
      shouldReplaceWatchCellSource({
        cellMediaId: "post-3",
        cellSrc: "file:///cache/post-3.mp4",
        playerMediaId: "post-3",
        playerSrc: "https://cdn.example/3.mp4",
      })
    ).toBe(true);
    expect(
      shouldReplaceWatchCellSource({
        cellMediaId: "post-3",
        cellSrc: "file:///cache/post-3.mp4",
        playerMediaId: "post-3",
        playerSrc: "file:///cache/post-3.mp4",
      })
    ).toBe(false);
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
        playerMediaId: "post-1",
        visibleMediaId: "post-2",
      })
    ).toBe(false);
  });
});

describe("Android surface attach", () => {
  it("does not mount an off-screen next TextureView", () => {
    expect(
      shouldAttachWatchSurface({
        loadPlayer: true,
        preparePlayer: true,
        itemReady: true,
        warmNextSurface: false,
        isNextItem: false,
        platform: "android",
      })
    ).toBe(true);
    expect(
      shouldAttachWatchSurface({
        loadPlayer: false,
        preparePlayer: true,
        itemReady: true,
        warmNextSurface: false,
        isNextItem: true,
        platform: "android",
      })
    ).toBe(false);
    expect(
      shouldAttachWatchSurface({
        loadPlayer: false,
        preparePlayer: true,
        itemReady: true,
        warmNextSurface: true,
        platform: "android",
      })
    ).toBe(false);
  });
});

describe("legacy one-cell-late checks", () => {
  it("still rejects audio N with picture N-1", () => {
    expect(
      isOneCellLateBinding({ visibleIndex: 1, surfaceIndex: 0 })
    ).toBe(true);
    expect(
      isWatchCellBindingAligned({
        visibleIndex: 1,
        visibleMediaId: "post-2",
        activeIndex: 1,
        activeMediaId: "post-2",
        playerMediaId: "post-2",
        surfaceMediaId: "post-1",
      })
    ).toBe(false);
  });
});
