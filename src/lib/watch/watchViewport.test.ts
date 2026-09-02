import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

vi.mock("expo-video", () => ({
  setVideoCacheSizeAsync: async () => undefined,
}));

import { ANDROID_WATCH_CACHE_TARGET } from "./androidWatchMediaCache";
import {
  resolveWatchIndexFromScrollOffset,
  resolveWatchScrollOffset,
} from "./playbackPolicy";
import {
  resolveWatchInPlaceOverlayClose,
  watchShareDismissPreservesActiveItem,
  watchShareSheetRemountsWatch,
} from "@/src/lib/social/watchShareSheet";
import {
  findWatchIndexByPostIdentity,
  preserveWatchPostAcrossLayoutSession,
  reconcileWatchActiveIndex,
  resolveFrozenWatchViewport,
  resolveWatchNativePage,
  resolveWatchPagingMetrics,
  shouldApplyTextureViewSizeToItemHeight,
  shouldScrollOnItemHeightJitter,
} from "./watchViewport";

const FROZEN_HEIGHT = 1720;
const FROZEN_WIDTH = 884;

function videos() {
  return [
    { id: "clip-1", postId: 11 },
    { id: "clip-2", postId: 12 },
    { id: "clip-3", postId: 13 },
    { id: "clip-4", postId: 14 },
    { id: "clip-5", postId: 15 },
  ];
}

describe("5 TextureView size changes do not move snap points", () => {
  it("keeps frozen itemHeight and snap interval when TextureView resizes", () => {
    const metrics = resolveWatchPagingMetrics(FROZEN_HEIGHT);
    expect(metrics?.itemHeight).toBe(FROZEN_HEIGHT);
    expect(metrics?.snapToInterval).toBe(FROZEN_HEIGHT);
    expect(metrics?.getItemLayout(0)).toEqual({
      length: FROZEN_HEIGHT,
      offset: 0,
      index: 0,
    });
    expect(metrics?.getItemLayout(2)).toEqual({
      length: FROZEN_HEIGHT,
      offset: FROZEN_HEIGHT * 2,
      index: 2,
    });
    expect(shouldApplyTextureViewSizeToItemHeight()).toBe(false);
    expect(shouldScrollOnItemHeightJitter()).toBe(false);
    const afterTexture = resolveFrozenWatchViewport({
      frozenHeight: FROZEN_HEIGHT,
      frozenWidth: FROZEN_WIDTH,
      measuredHeight: 2121,
      measuredWidth: FROZEN_WIDTH,
    });
    expect(afterTexture.isNewSession).toBe(false);
    expect(afterTexture.height).toBe(FROZEN_HEIGHT);
    expect(afterTexture.heightChanged).toBe(false);
    const squareTexture = resolveFrozenWatchViewport({
      frozenHeight: FROZEN_HEIGHT,
      frozenWidth: FROZEN_WIDTH,
      measuredHeight: 968,
      measuredWidth: FROZEN_WIDTH,
    });
    expect(squareTexture.height).toBe(FROZEN_HEIGHT);
    expect(
      resolveWatchPagingMetrics(squareTexture.height ?? 0)?.snapToInterval
    ).toBe(FROZEN_HEIGHT);
  });
});

describe("6 swipe 1 → 2 keeps native page and activeIndex at 1", () => {
  it("settles both indexes on video 2", () => {
    const offset = resolveWatchScrollOffset(1, FROZEN_HEIGHT);
    expect(offset).toBe(FROZEN_HEIGHT);
    const nativePage = resolveWatchNativePage(offset!, FROZEN_HEIGHT, 5);
    const activeIndex = reconcileWatchActiveIndex({
      nativePage,
      activeIndex: 0,
      itemCount: 5,
    });
    expect(nativePage).toBe(1);
    expect(activeIndex).toBe(1);
    expect(nativePage).toBe(activeIndex);
  });
});

describe("7 swipe 2 → 3 keeps native page and activeIndex at 2", () => {
  it("settles both indexes on video 3, not video 1", () => {
    const offset = resolveWatchScrollOffset(2, FROZEN_HEIGHT);
    expect(offset).toBe(FROZEN_HEIGHT * 2);
    const nativePage = resolveWatchIndexFromScrollOffset(
      offset!,
      FROZEN_HEIGHT,
      5
    );
    const activeIndex = reconcileWatchActiveIndex({
      nativePage,
      activeIndex: 1,
      itemCount: 5,
    });
    expect(nativePage).toBe(2);
    expect(activeIndex).toBe(2);
    expect(nativePage).toBe(activeIndex);
    expect(
      reconcileWatchActiveIndex({
        nativePage: 0,
        activeIndex: 2,
        itemCount: 5,
      })
    ).toBe(0);
  });
});

describe("8 Fold/unfold preserves the active post", () => {
  it("opens a new layout session and keeps the same post id", () => {
    const unfolded = resolveFrozenWatchViewport({
      frozenHeight: FROZEN_HEIGHT,
      frozenWidth: FROZEN_WIDTH,
      measuredHeight: 1768,
      measuredWidth: 1768,
    });
    expect(unfolded.isNewSession).toBe(true);
    expect(unfolded.height).toBe(1768);
    const keep = preserveWatchPostAcrossLayoutSession({
      activePostId: 13,
      videos: videos(),
      fallbackIndex: 2,
    });
    expect(keep).toBe(2);
    expect(findWatchIndexByPostIdentity(videos(), 13)).toBe(2);
    expect(videos()[keep]?.postId).toBe(13);
  });
});

describe("9 Share Cancel/Back preserves the same post", () => {
  it("dismisses in place without remounting or changing the active item", () => {
    expect(watchShareDismissPreservesActiveItem()).toBe(true);
    expect(watchShareSheetRemountsWatch()).toBe(false);
    expect(
      resolveWatchInPlaceOverlayClose({
        commentsOpen: false,
        shareSheetOpen: true,
      })
    ).toBe("share");
    const activeBefore = preserveWatchPostAcrossLayoutSession({
      activePostId: 12,
      videos: videos(),
      fallbackIndex: 1,
    });
    const activeAfterCancel = preserveWatchPostAcrossLayoutSession({
      activePostId: 12,
      videos: videos(),
      fallbackIndex: activeBefore,
    });
    expect(activeAfterCancel).toBe(activeBefore);
    expect(videos()[activeAfterCancel]?.postId).toBe(12);
  });
});

describe("10 five-video rolling cache is unchanged", () => {
  it("keeps ANDROID_WATCH_CACHE_TARGET at 5", () => {
    expect(ANDROID_WATCH_CACHE_TARGET).toBe(5);
  });
});
