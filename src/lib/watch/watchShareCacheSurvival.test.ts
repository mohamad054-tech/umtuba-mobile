import { describe, expect, it, vi } from "vitest";

vi.mock("expo-video", () => ({
  setVideoCacheSizeAsync: async () => undefined,
}));

import type { WatchVideo } from "@/src/contracts/watch";
import {
  resolveWatchInPlaceOverlayClose,
  shouldDismissWatchShareOnHardwareBack,
  watchShareDismissPreservesActiveItem,
  watchShareOverlayUsesHostWindow,
  watchShareSheetRemountsWatch,
} from "@/src/lib/social/watchShareSheet";
import {
  ANDROID_WATCH_CACHE_MANIFEST_NAME,
  ANDROID_WATCH_CACHE_TARGET,
  createMemoryWatchMediaCachePort,
  peekAndroidWatchCacheHits,
  syncAndroidWatchRollingCache,
} from "./androidWatchMediaCache";
import { preserveWatchPostAcrossLayoutSession } from "./watchViewport";

function video(
  index: number,
  src = `https://cdn.example/${index}.mp4`
): WatchVideo {
  return {
    id: `clip-${index}`,
    postId: index,
    src,
    title: "t",
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

function snapshotManifest(port: ReturnType<typeof createMemoryWatchMediaCachePort>) {
  return port.files.get(`file:///cache/${ANDROID_WATCH_CACHE_MANIFEST_NAME}`) ?? null;
}

describe("Share overlay does not mutate rolling Watch cache", () => {
  it("keeps the same cache index, active post, and file:// hits after Cancel/Back", async () => {
    const port = createMemoryWatchMediaCachePort();
    const videos = [1, 2, 3, 4, 5].map((i) => video(i));
    const activeIndex = 0;
    const activePostId = videos[activeIndex]?.postId ?? null;

    const seeded = await syncAndroidWatchRollingCache({
      platform: "android",
      videos,
      activeIndex,
      port,
    });
    expect(ANDROID_WATCH_CACHE_TARGET).toBe(5);
    expect(seeded.cachedIds).toEqual([
      "post-1",
      "post-2",
      "post-3",
      "post-4",
      "post-5",
    ]);
    expect(watchShareOverlayUsesHostWindow()).toBe(true);
    expect(watchShareSheetRemountsWatch()).toBe(false);

    const manifestBeforeOpen = snapshotManifest(port);
    const filesBeforeOpen = new Map(port.files);
    const downloadsBeforeOpen = port.downloads.length;
    const hitsBeforeOpen = await peekAndroidWatchCacheHits({ videos, port });
    expect(hitsBeforeOpen).toHaveLength(5);
    expect(hitsBeforeOpen.every((hit) => hit.uri.startsWith("file://"))).toBe(
      true
    );

    // Opening Share is a host-window overlay. It must not remount Watch
    // or rewrite the rolling-cache index / media files.
    expect(watchShareSheetRemountsWatch()).toBe(false);
    expect(snapshotManifest(port)).toBe(manifestBeforeOpen);
    expect([...port.files.entries()]).toEqual([...filesBeforeOpen.entries()]);
    expect(port.downloads.length).toBe(downloadsBeforeOpen);

    expect(shouldDismissWatchShareOnHardwareBack(true)).toBe(true);
    expect(
      resolveWatchInPlaceOverlayClose({
        commentsOpen: false,
        shareSheetOpen: true,
      })
    ).toBe("share");
    expect(watchShareDismissPreservesActiveItem()).toBe(true);

    const activeAfterCancel = preserveWatchPostAcrossLayoutSession({
      activePostId,
      videos,
      fallbackIndex: activeIndex,
    });
    expect(activeAfterCancel).toBe(activeIndex);
    expect(videos[activeAfterCancel]?.postId).toBe(1);

    const hitsAfterDismiss = await peekAndroidWatchCacheHits({
      videos,
      port,
    });
    expect(hitsAfterDismiss.map((hit) => hit.mediaId)).toEqual(
      hitsBeforeOpen.map((hit) => hit.mediaId)
    );
    expect(hitsAfterDismiss.map((hit) => hit.uri)).toEqual(
      hitsBeforeOpen.map((hit) => hit.uri)
    );
    expect(hitsAfterDismiss.every((hit) => hit.uri.startsWith("file://"))).toBe(
      true
    );
    expect(snapshotManifest(port)).toBe(manifestBeforeOpen);
    expect(port.downloads.length).toBe(downloadsBeforeOpen);

    const afterReturn = await syncAndroidWatchRollingCache({
      platform: "android",
      videos,
      activeIndex: activeAfterCancel,
      port,
    });
    expect(afterReturn.cachedIds).toEqual(seeded.cachedIds);
    expect(afterReturn.hits).toEqual(seeded.cachedIds);
    expect(afterReturn.evicted).toEqual([]);
    expect(afterReturn.misses).toEqual([]);
    expect(port.downloads.length).toBe(downloadsBeforeOpen);
  });
});
