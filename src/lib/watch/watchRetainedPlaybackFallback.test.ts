import { describe, expect, it, vi } from "vitest";

vi.mock("expo-video", () => ({
  setVideoCacheSizeAsync: async () => undefined,
}));

import type { WatchVideo } from "@/src/contracts/watch";
import { shouldApplyResolvedWatchSrc } from "@/src/lib/feed/watchPlaybackPrep";

import {
  ANDROID_WATCH_CACHE_MANIFEST_NAME,
  createMemoryWatchMediaCachePort,
  peekAndroidWatchCacheHits,
  planAndroidWatchCacheWindow,
  syncAndroidWatchRollingCache,
} from "./androidWatchMediaCache";
import {
  applyRetainedLocalSourcesToFeed,
  loadWatchOfflineManifest,
  reconcileWatchFeedWithOfflineManifest,
  rememberWatchedOfflineVideo,
  resolveWatchStartupFeed,
  watchOfflineDurableVideoUri,
  watchOfflineManifestUri,
} from "./watchOfflineManifest";
import {
  isolatePrefetchFailureFromActiveCell,
  ordinaryAdvanceKeepsNeighbor,
  remoteWatchPlaybackFallbackSrc,
  resolveRetainedWatchPlaybackSrc,
  retainedWatchEntryMatchesFeedItem,
  shouldApplyLocalWatchUriToVideo,
  shouldEvictWatchDurableOldest,
  shouldSurfacePrefetchFailureOnActiveCell,
} from "./watchRetainedPlaybackFallback";

function video(
  index: number,
  src = `https://cdn.example/${index}.mp4`
): WatchVideo {
  return {
    id: `clip-${index}`,
    postId: index,
    src,
    title: `title-${index}`,
    caption: `caption-${index}`,
    location: { city: "Lagos", country: "NG" },
    music: "track",
    aiSummary: "",
    translation: "",
    author: {
      id: `creator-${index}`,
      name: `Creator ${index}`,
      username: `@c${index}`,
      avatar: "C",
    },
    stats: {
      likes: index,
      comments: 1,
      shares: 0,
      saves: 0,
      views: 10,
    },
    likedByMe: false,
    savedByMe: false,
    source: "supabase",
    durationMs: 12_000 + index,
  };
}

async function retain(
  port: ReturnType<typeof createMemoryWatchMediaCachePort>,
  accountId: string,
  index: number,
  now: number
) {
  const item = video(index);
  const localUri = `file:///cache/umtuba-watch-media/post-${index}.mp4`;
  port.files.set(localUri, `bytes-${index}`);
  return rememberWatchedOfflineVideo({
    accountId,
    video: item,
    localUri,
    remoteUri: item.src,
    now,
    port,
  });
}

function rollingManifest(port: ReturnType<typeof createMemoryWatchMediaCachePort>) {
  return port.files.get(`file:///cache/${ANDROID_WATCH_CACHE_MANIFEST_NAME}`) ?? null;
}

describe("STALE_FILE_FALLBACK_TEST", () => {
  it("keeps signed HTTPS and never supplies a missing file:// to the player", async () => {
    const port = createMemoryWatchMediaCachePort();
    await retain(port, "acct-a", 1, 1000);
    const durable = watchOfflineDurableVideoUri(
      port.documentDirectory(),
      "acct-a",
      "post-1"
    )!;
    port.files.delete(durable);

    const feedItem = video(1, "https://cdn.example/signed-1.mp4");
    const resolved = await resolveRetainedWatchPlaybackSrc({
      video: feedItem,
      retained: {
        postId: 1,
        videoId: "clip-1",
        mediaId: "post-1",
        localUri: durable,
        remoteUri: "https://cdn.example/1.mp4",
      },
      port,
    });
    expect(resolved.usedLocal).toBe(false);
    expect(resolved.invalidated).toBe(true);
    expect(resolved.reason).toBe("missing-file");
    expect(resolved.src).toBe("https://cdn.example/signed-1.mp4");
    expect(resolved.src.startsWith("file://")).toBe(false);

    const startup = await resolveWatchStartupFeed({
      accountId: "acct-a",
      port,
      fetchFeed: async () => ({
        videos: [feedItem],
        nextCursor: null,
      }),
    });
    expect(startup.source).toBe("feed");
    expect(startup.videos[0]?.src).toBe("https://cdn.example/signed-1.mp4");
    expect(startup.videos[0]?.src.startsWith("file://")).toBe(false);

    const applied: string[] = [];
    await syncAndroidWatchRollingCache({
      platform: "android",
      videos: [feedItem],
      activeIndex: 0,
      port,
      onResolved: (_id, uri) => applied.push(uri),
    });
    expect(applied.every((uri) => uri.startsWith("file://"))).toBe(true);
    for (const uri of applied) {
      expect(port.files.has(uri)).toBe(true);
      expect((port.files.get(uri) ?? "").length).toBeGreaterThan(0);
    }
  });
});

describe("ZERO_BYTE_FALLBACK_TEST", () => {
  it("rejects a zero-byte retained file and falls back to HTTPS", async () => {
    const port = createMemoryWatchMediaCachePort();
    const localUri = "file:///documents/umtuba-watch-retained/empty.mp4";
    port.files.set(localUri, "");
    const feedItem = video(2, "https://cdn.example/signed-2.mp4");
    const resolved = await resolveRetainedWatchPlaybackSrc({
      video: feedItem,
      retained: {
        postId: 2,
        videoId: "clip-2",
        mediaId: "post-2",
        localUri,
        remoteUri: "https://cdn.example/2.mp4",
      },
      port,
    });
    expect(resolved.usedLocal).toBe(false);
    expect(resolved.invalidated).toBe(true);
    expect(resolved.reason).toBe("zero-byte");
    expect(resolved.src).toBe("https://cdn.example/signed-2.mp4");

    const applied = await applyRetainedLocalSourcesToFeed({
      feed: [feedItem],
      retained: [
        {
          postId: 2,
          videoId: "clip-2",
          mediaId: "post-2",
          title: "t",
          caption: "",
          location: { city: "", country: "" },
          music: "",
          aiSummary: "",
          translation: "",
          author: feedItem.author,
          stats: feedItem.stats,
          likedByMe: false,
          savedByMe: false,
          source: "supabase",
          remoteUri: "https://cdn.example/2.mp4",
          localUri,
          cachedAt: 1,
          lastWatchedAt: 1,
        },
      ],
      port,
    });
    expect(applied.videos[0]?.src).toBe("https://cdn.example/signed-2.mp4");
    expect(applied.prunedMediaIds).toEqual(["post-2"]);
    expect(
      shouldApplyResolvedWatchSrc(localUri, "https://cdn.example/signed-2.mp4", {
        currentLocalUsable: false,
      })
    ).toBe(true);
  });
});

describe("WRONG_POST_URI_REJECTED_TEST", () => {
  it("never applies another post's retained local URI", async () => {
    const port = createMemoryWatchMediaCachePort();
    await retain(port, "acct-a", 1, 1000);
    const post1Local = watchOfflineDurableVideoUri(
      port.documentDirectory(),
      "acct-a",
      "post-1"
    )!;
    const post2 = video(2, "https://cdn.example/signed-2.mp4");
    expect(
      retainedWatchEntryMatchesFeedItem(
        { postId: 1, videoId: "clip-1", mediaId: "post-1" },
        post2
      )
    ).toBe(false);
    expect(
      shouldApplyLocalWatchUriToVideo({
        video: post2,
        candidateMediaId: "post-1",
        candidatePostId: 1,
        candidateUri: post1Local,
        fileUsable: true,
      })
    ).toBe(false);

    const resolved = await resolveRetainedWatchPlaybackSrc({
      video: post2,
      retained: {
        postId: 1,
        videoId: "clip-1",
        mediaId: "post-1",
        localUri: post1Local,
        remoteUri: "https://cdn.example/1.mp4",
      },
      port,
    });
    expect(resolved.reason).toBe("identity-mismatch");
    expect(resolved.src).toBe("https://cdn.example/signed-2.mp4");

    const confused = reconcileWatchFeedWithOfflineManifest(
      [video(2, "https://cdn.example/signed-2.mp4")],
      [{ ...video(1, post1Local), id: "clip-2" }]
    );
    expect(confused[0]?.src).toBe("https://cdn.example/signed-2.mp4");
  });
});

describe("MANIFEST_PRUNE_TEST", () => {
  it("startup reconciliation drops stale retained entries and keeps remote src", async () => {
    const port = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(port, "acct-a", i, i * 1000);
    }
    port.files.delete(
      watchOfflineDurableVideoUri(port.documentDirectory(), "acct-a", "post-3")!
    );
    const startup = await resolveWatchStartupFeed({
      accountId: "acct-a",
      port,
      fetchFeed: async () => ({
        videos: [1, 2, 3, 4, 5].map((i) =>
          video(i, `https://cdn.example/signed-${i}.mp4`)
        ),
        nextCursor: null,
      }),
    });
    expect(startup.videos[2]?.src).toBe("https://cdn.example/signed-3.mp4");
    expect(startup.videos[2]?.src.startsWith("file://")).toBe(false);
    expect(startup.videos[0]?.src.startsWith("file://")).toBe(true);
    const after = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port,
    });
    expect(after.entries.map((row) => row.postId).sort()).toEqual([1, 2, 4, 5]);
    expect(after.entries.some((row) => row.mediaId === "post-3")).toBe(false);
  });
});

describe("PREFETCH_ACTIVE_ERROR_ISOLATION_TEST", () => {
  it("prefetch failure does not replace or display an error on the active cell", async () => {
    const active = video(1, "https://cdn.example/signed-1.mp4");
    const isolated = isolatePrefetchFailureFromActiveCell({
      failedMediaId: "post-2",
      activeMediaId: "post-1",
      activeSrc: active.src,
      activeError: null,
    });
    expect(isolated.src).toBe("https://cdn.example/signed-1.mp4");
    expect(isolated.error).toBeNull();
    expect(isolated.displayError).toBe(false);
    expect(
      shouldSurfacePrefetchFailureOnActiveCell({
        failedMediaId: "post-2",
        activeMediaId: "post-1",
      })
    ).toBe(false);
    expect(
      shouldSurfacePrefetchFailureOnActiveCell({
        failedMediaId: "post-1",
        activeMediaId: "post-1",
      })
    ).toBe(false);

    const port = createMemoryWatchMediaCachePort();
    port.download = async () => {
      throw new Error("prefetch failed");
    };
    const applied: string[] = [];
    const result = await syncAndroidWatchRollingCache({
      platform: "android",
      videos: [active, video(2)],
      activeIndex: 0,
      port,
      onResolved: (_id, uri) => applied.push(uri),
    });
    expect(applied).toEqual([]);
    expect(result.misses.length).toBeGreaterThan(0);
    expect(active.src).toBe("https://cdn.example/signed-1.mp4");
  });
});

describe("N_MINUS_ONE_RETENTION_TEST", () => {
  it("does not delete N-1 during ordinary 0→1 or 1→2", async () => {
    const port = createMemoryWatchMediaCachePort();
    const videos = [1, 2, 3, 4, 5, 6].map((i) => video(i));
    await syncAndroidWatchRollingCache({
      platform: "android",
      videos,
      activeIndex: 0,
      accountId: "acct-a",
      port,
    });
    const after01 = await syncAndroidWatchRollingCache({
      platform: "android",
      videos,
      activeIndex: 1,
      accountId: "acct-a",
      port,
    });
    expect(after01.evicted).not.toContain("post-1");
    expect(after01.cachedIds).toContain("post-1");
    expect(
      ordinaryAdvanceKeepsNeighbor({
        fromIndex: 0,
        toIndex: 1,
        evictedMediaIds: after01.evicted,
        neighborMediaId: "post-1",
      })
    ).toBe(true);
    const durableAfter01 = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port,
    });
    expect(durableAfter01.entries.map((row) => row.mediaId)).toEqual(
      expect.arrayContaining(["post-1"])
    );

    const after12 = await syncAndroidWatchRollingCache({
      platform: "android",
      videos,
      activeIndex: 2,
      accountId: "acct-a",
      port,
    });
    expect(after12.evicted).not.toContain("post-2");
    expect(after12.cachedIds).toContain("post-2");
    expect(
      ordinaryAdvanceKeepsNeighbor({
        fromIndex: 1,
        toIndex: 2,
        evictedMediaIds: after12.evicted,
        neighborMediaId: "post-2",
      })
    ).toBe(true);
    const durableAfter12 = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port,
    });
    expect(durableAfter12.entries.map((row) => row.mediaId)).toEqual(
      expect.arrayContaining(["post-2"])
    );

    const planned01 = planAndroidWatchCacheWindow({
      videos,
      activeIndex: 1,
    });
    expect(planned01.evictIds).not.toContain("post-1");
    const planned12 = planAndroidWatchCacheWindow({
      videos,
      activeIndex: 2,
    });
    expect(planned12.evictIds).not.toContain("post-2");
  });
});

describe("DURABLE_FIVE_TEST", () => {
  it("keeps five distinct retained videos with real non-zero files", async () => {
    const port = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(port, "acct-a", i, i * 1000);
    }
    const manifest = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port,
    });
    expect(manifest.entries).toHaveLength(5);
    for (const entry of manifest.entries) {
      expect(port.files.has(entry.localUri)).toBe(true);
      expect((port.files.get(entry.localUri) ?? "").length).toBeGreaterThan(0);
    }
  });
});

describe("SIXTH_EVICTION_TEST", () => {
  it("evicts only the oldest after a sixth distinct video is stored", async () => {
    expect(
      shouldEvictWatchDurableOldest({
        retainedCountBefore: 5,
        incomingIsNew: true,
        incomingStored: true,
      })
    ).toBe(true);
    expect(
      shouldEvictWatchDurableOldest({
        retainedCountBefore: 5,
        incomingIsNew: true,
        incomingStored: false,
      })
    ).toBe(false);
    expect(
      shouldEvictWatchDurableOldest({
        retainedCountBefore: 4,
        incomingIsNew: true,
        incomingStored: true,
      })
    ).toBe(false);

    const port = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(port, "acct-a", i, i * 1000);
    }
    const sixth = await retain(port, "acct-a", 6, 6000);
    expect(sixth.evicted.map((row) => row.postId)).toEqual([1]);
    const manifest = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port,
    });
    expect(manifest.entries).toHaveLength(5);
    expect(manifest.entries.map((row) => row.postId).sort()).toEqual([
      2, 3, 4, 5, 6,
    ]);
    expect(
      port.files.has(
        watchOfflineDurableVideoUri(port.documentDirectory(), "acct-a", "post-1")!
      )
    ).toBe(false);
    expect(
      port.files.has(
        watchOfflineDurableVideoUri(port.documentDirectory(), "acct-a", "post-6")!
      )
    ).toBe(true);
  });
});

describe("INTERRUPTED_DOWNLOAD_TEST", () => {
  it("does not write a manifest entry before a non-zero destination file exists", async () => {
    const port = createMemoryWatchMediaCachePort();
    port.download = async (_src, destUri) => {
      port.files.set(destUri, "");
      return { uri: destUri, status: 200 };
    };
    const result = await syncAndroidWatchRollingCache({
      platform: "android",
      videos: [video(1)],
      activeIndex: 0,
      port,
    });
    expect(result.cachedIds).toEqual([]);
    expect(result.misses).toContain("post-1");
    const raw = rollingManifest(port);
    if (raw) {
      const parsed = JSON.parse(raw) as { entries: Array<{ mediaId: string }> };
      expect(parsed.entries.some((row) => row.mediaId === "post-1")).toBe(false);
    }
    expect(
      [...port.files.keys()].some((uri) => uri.endsWith("post-1.mp4"))
    ).toBe(false);

    const interrupted = createMemoryWatchMediaCachePort();
    const before = await rememberWatchedOfflineVideo({
      accountId: "acct-a",
      video: video(1),
      localUri: "file:///cache/umtuba-watch-media/missing.mp4",
      remoteUri: "https://cdn.example/1.mp4",
      now: 1,
      port: interrupted,
    });
    expect(before.manifest.entries).toHaveLength(0);
    expect(
      interrupted.files.has(watchOfflineManifestUri(
        interrupted.documentDirectory(),
        "acct-a"
      )!)
    ).toBe(false);
  });
});

describe("retained playback helpers", () => {
  it("falls back to retained remote HTTPS when the card src is already a stale file://", () => {
    expect(
      remoteWatchPlaybackFallbackSrc(
        { src: "file:///missing.mp4" },
        { remoteUri: "https://cdn.example/1.mp4" }
      )
    ).toBe("https://cdn.example/1.mp4");
  });

  it("peek does not return a missing rolling-cache file:// hit", async () => {
    const port = createMemoryWatchMediaCachePort();
    await syncAndroidWatchRollingCache({
      platform: "android",
      videos: [video(1)],
      activeIndex: 0,
      port,
    });
    const dest = "file:///cache/umtuba-watch-media/post-1.mp4";
    port.files.delete(dest);
    const hits = await peekAndroidWatchCacheHits({
      videos: [video(1)],
      port,
    });
    expect(hits).toEqual([]);
    const raw = rollingManifest(port);
    const parsed = raw
      ? (JSON.parse(raw) as { entries: Array<{ mediaId: string }> })
      : { entries: [] };
    expect(parsed.entries.some((row) => row.mediaId === "post-1")).toBe(false);
  });
});
