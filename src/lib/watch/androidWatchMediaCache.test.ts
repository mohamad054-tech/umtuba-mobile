import { describe, expect, it, vi } from "vitest";

vi.mock("expo-video", () => ({
  setVideoCacheSizeAsync: async () => undefined,
}));

import type { WatchVideo } from "@/src/contracts/watch";
import {
  ANDROID_WATCH_CACHE_TARGET,
  ANDROID_WATCH_FORWARD_READY_TARGET,
  ANDROID_WATCH_MAX_BUFFER_BYTES,
  ANDROID_WATCH_VIDEO_CACHE_BYTES,
  createMemoryWatchMediaCachePort,
  emptyWatchCacheManifest,
  isValidWatchCacheEntry,
  peekAndroidWatchCacheHits,
  planAndroidWatchCacheWindow,
  resolveAndroidWatchBufferOptions,
  shouldRedownloadWatchCache,
  syncAndroidWatchRollingCache,
  watchCacheFileName,
} from "./androidWatchMediaCache";

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

describe("resolveAndroidWatchBufferOptions", () => {
  it("bounds Android buffers and leaves iOS untouched", () => {
    const android = resolveAndroidWatchBufferOptions("android");
    expect(android?.preferredForwardBufferDuration).toBe(8);
    expect(android?.maxBufferBytes).toBe(ANDROID_WATCH_MAX_BUFFER_BYTES);
    expect(ANDROID_WATCH_VIDEO_CACHE_BYTES).toBe(192 * 1024 * 1024);
    expect(resolveAndroidWatchBufferOptions("ios")).toBeNull();
  });
});

describe("Android Watch rolling cache target 5", () => {
  it("keeps five upcoming videos ready and replenishes one on advance", () => {
    expect(ANDROID_WATCH_FORWARD_READY_TARGET).toBe(5);
    expect(ANDROID_WATCH_CACHE_TARGET).toBe(5);
    const videos = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => video(i));
    const first = planAndroidWatchCacheWindow({
      videos,
      activeIndex: 0,
      manifest: emptyWatchCacheManifest(),
    });
    expect(first.target).toBe(5);
    expect(first.keepIds).toEqual([
      "post-1",
      "post-2",
      "post-3",
      "post-4",
      "post-5",
      "post-6",
    ]);
    expect(first.downloadIds).toEqual(first.keepIds);
    expect(watchCacheFileName("post-2")).toBe("post-2.mp4");

    const afterAdvance = planAndroidWatchCacheWindow({
      videos,
      activeIndex: 1,
      manifest: {
        target: 5,
        entries: first.keepIds.map((mediaId, i) => ({
          mediaId,
          videoId: `clip-${i + 1}`,
          uri: `file:///cache/${mediaId}.mp4`,
          bytes: 12,
          cachedAt: i,
        })),
      },
    });
    expect(afterAdvance.keepIds).toEqual([
      "post-1",
      "post-2",
      "post-3",
      "post-4",
      "post-5",
      "post-6",
      "post-7",
    ]);
    expect(afterAdvance.hits).toEqual([
      "post-1",
      "post-2",
      "post-3",
      "post-4",
      "post-5",
      "post-6",
    ]);
    expect(afterAdvance.downloadIds).toEqual(["post-7"]);
    expect(afterAdvance.evictIds).toEqual([]);

    const warmed = planAndroidWatchCacheWindow({
      videos,
      activeIndex: 2,
      manifest: {
        target: 5,
        entries: afterAdvance.keepIds.map((mediaId, i) => ({
          mediaId,
          videoId: `clip-${i + 1}`,
          uri: `file:///cache/${mediaId}.mp4`,
          bytes: 12,
          cachedAt: i,
        })),
      },
    });
    expect(warmed.keepIds).toEqual([
      "post-2",
      "post-3",
      "post-4",
      "post-5",
      "post-6",
      "post-7",
      "post-8",
    ]);
    expect(warmed.hits).toEqual([
      "post-2",
      "post-3",
      "post-4",
      "post-5",
      "post-6",
      "post-7",
    ]);
    expect(warmed.downloadIds).toEqual(["post-8"]);
    expect(warmed.evictIds).toEqual(["post-1"]);
  });

  it("starts from a cached first item and does not redownload a valid hit", async () => {
    const port = createMemoryWatchMediaCachePort();
    const first = video(1, "https://cdn.example/1.mp4");
    const seeded = await syncAndroidWatchRollingCache({
      platform: "android",
      videos: [1, 2, 3, 4, 5].map((i) => video(i)),
      activeIndex: 0,
      port,
    });
    expect(seeded.cachedIds).toHaveLength(5);
    expect(seeded.target).toBe(5);
    const downloadsAfterSeed = port.downloads.length;

    const hits = await peekAndroidWatchCacheHits({
      videos: [first],
      port,
    });
    expect(hits[0]?.uri.startsWith("file://")).toBe(true);
    expect(hits[0]?.mediaId).toBe("post-1");

    const again = await syncAndroidWatchRollingCache({
      platform: "android",
      videos: [1, 2, 3, 4, 5].map((i) =>
        video(i, hits.find((hit) => hit.mediaId === `post-${i}`)?.uri)
      ),
      activeIndex: 0,
      port,
    });
    expect(again.hits).toContain("post-1");
    expect(port.downloads.length).toBe(downloadsAfterSeed);
    expect(
      shouldRedownloadWatchCache({
        fileExists: true,
        entry: {
          mediaId: "post-1",
          videoId: "clip-1",
          uri: "file:///cache/post-1.mp4",
          bytes: 8,
          cachedAt: 1,
        },
      })
    ).toBe(false);
    expect(
      isValidWatchCacheEntry({
        mediaId: "post-1",
        videoId: "clip-1",
        uri: "https://cdn.example/1.mp4",
        bytes: 8,
        cachedAt: 1,
      })
    ).toBe(false);
  });

  it("downloads only the replacement video after a one-step advance", async () => {
    const port = createMemoryWatchMediaCachePort();
    const videos = [1, 2, 3, 4, 5, 6, 7].map((i) => video(i));
    const seeded = await syncAndroidWatchRollingCache({
      platform: "android",
      videos,
      activeIndex: 0,
      port,
    });
    expect(seeded.cachedIds).toEqual([
      "post-1",
      "post-2",
      "post-3",
      "post-4",
      "post-5",
      "post-6",
    ]);
    const downloadsAfterSeed = port.downloads.length;
    const rolled = await syncAndroidWatchRollingCache({
      platform: "android",
      videos,
      activeIndex: 1,
      port,
    });
    expect(rolled.evicted).toEqual([]);
    expect(rolled.cachedIds).toEqual([
      "post-1",
      "post-2",
      "post-3",
      "post-4",
      "post-5",
      "post-6",
      "post-7",
    ]);
    expect(port.downloads.length).toBe(downloadsAfterSeed + 1);
    expect(port.downloads.at(-1)).toBe("https://cdn.example/7.mp4");
  });

  it("evicts the oldest retained item and caches the next on advance", async () => {
    const port = createMemoryWatchMediaCachePort();
    const applied: string[] = [];
    await syncAndroidWatchRollingCache({
      platform: "android",
      videos: [1, 2, 3, 4, 5, 6].map((i) => video(i)),
      activeIndex: 0,
      port,
      onResolved: (videoId, uri) => applied.push(`${videoId}:${uri}`),
    });
    const rolled = await syncAndroidWatchRollingCache({
      platform: "android",
      videos: [1, 2, 3, 4, 5, 6].map((i) => video(i)),
      activeIndex: 2,
      port,
    });
    expect(rolled.evicted).toEqual(["post-1"]);
    expect(rolled.cachedIds).toEqual([
      "post-2",
      "post-3",
      "post-4",
      "post-5",
      "post-6",
    ]);
    expect(rolled.cachedIds).not.toContain("post-1");
    expect(applied.some((row) => row.startsWith("clip-1:file://"))).toBe(true);
  });

  it("keeps retained local URIs playable after a network-less sync", async () => {
    const port = createMemoryWatchMediaCachePort();
    await syncAndroidWatchRollingCache({
      platform: "android",
      videos: [1, 2, 3, 4, 5].map((i) => video(i)),
      activeIndex: 0,
      port,
    });
    const offlineVideos = [1, 2, 3, 4, 5].map((i) =>
      video(i, `file:///cache/umtuba-watch-media/post-${i}.mp4`)
    );
    const hits = await peekAndroidWatchCacheHits({
      videos: offlineVideos,
      port,
    });
    expect(hits).toHaveLength(5);
    const offline = await syncAndroidWatchRollingCache({
      platform: "android",
      videos: offlineVideos,
      activeIndex: 0,
      port,
    });
    expect(offline.cachedIds).toHaveLength(5);
    expect(offline.misses).toEqual([]);
  });
});
