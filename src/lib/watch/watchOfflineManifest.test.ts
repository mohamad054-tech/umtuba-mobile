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
import { createMemoryWatchMediaCachePort } from "./androidWatchMediaCache";
import {
  WATCH_OFFLINE_MANIFEST_TARGET,
  clearWatchOfflineManifestForAccount,
  loadWatchOfflineManifest,
  offlineBootstrapUsesFileUrisOnly,
  persistWatchOfflineManifest,
  rememberWatchedOfflineVideo,
  resolveWatchStartupFeed,
  watchOfflineManifestUri,
  watchVideosFromOfflineManifest,
} from "./watchOfflineManifest";

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
    likedByMe: index === 1,
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

function snapshotPort(
  port: ReturnType<typeof createMemoryWatchMediaCachePort>
): Array<[string, string]> {
  return [...port.files.entries()];
}

function restorePort(
  entries: Array<[string, string]>
): ReturnType<typeof createMemoryWatchMediaCachePort> {
  const port = createMemoryWatchMediaCachePort();
  for (const [uri, text] of entries) {
    port.files.set(uri, text);
  }
  return port;
}

describe("Watch retained-five offline manifest", () => {
  it("persists five real entries with card metadata and local files", async () => {
    const port = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(port, "acct-a", i, i * 1000);
    }
    const manifest = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port,
    });
    expect(WATCH_OFFLINE_MANIFEST_TARGET).toBe(5);
    expect(manifest.entries).toHaveLength(5);
    expect(manifest.accountId).toBe("acct-a");
    expect(manifest.entries.map((row) => row.postId).sort()).toEqual([
      1, 2, 3, 4, 5,
    ]);
    for (const entry of manifest.entries) {
      expect(entry.caption).toMatch(/^caption-/);
      expect(entry.author.name).toMatch(/^Creator /);
      expect(entry.remoteUri.startsWith("https://")).toBe(true);
      expect(entry.localUri.startsWith("file://")).toBe(true);
      expect(entry.cachedAt).toBeGreaterThan(0);
      expect(entry.lastWatchedAt).toBeGreaterThan(0);
      expect(entry.durationMs).toBeGreaterThan(0);
    }
    const dest = watchOfflineManifestUri("file:///cache/", "acct-a");
    expect(dest).toBeTruthy();
    expect(port.files.has(dest!)).toBe(true);
    expect(port.files.has(`${dest!}.tmp`)).toBe(false);
  });

  it("restores the same five after a process-restart re-read", async () => {
    const live = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(live, "acct-a", i, i * 1000);
    }
    const before = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port: live,
    });
    const restarted = restorePort(snapshotPort(live));
    const after = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port: restarted,
    });
    expect(after.entries).toHaveLength(5);
    expect(after.entries.map((row) => row.postId).sort()).toEqual(
      before.entries.map((row) => row.postId).sort()
    );
    expect(after.entries.map((row) => row.localUri).sort()).toEqual(
      before.entries.map((row) => row.localUri).sort()
    );
    expect(after.accountId).toBe("acct-a");
  });

  it("returns the retained five when the remote feed fails", async () => {
    const port = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(port, "acct-a", i, i * 1000);
    }
    const startup = await resolveWatchStartupFeed({
      accountId: "acct-a",
      port,
      fetchFeed: async () => {
        throw new Error("network down");
      },
    });
    expect(startup.source).toBe("offline");
    expect(startup.page).toBeNull();
    expect(startup.videos).toHaveLength(5);
    expect(startup.videos.map((row) => row.postId).sort()).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("offline bootstrap uses file:// URIs only", async () => {
    const port = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(port, "acct-a", i, i * 1000);
    }
    const startup = await resolveWatchStartupFeed({
      accountId: "acct-a",
      port,
      fetchFeed: async () => {
        throw new Error("offline");
      },
    });
    expect(offlineBootstrapUsesFileUrisOnly(startup.videos)).toBe(true);
    expect(
      startup.videos.every((row) => row.src.startsWith("file://"))
    ).toBe(true);
    expect(
      startup.videos.every((row) => !row.src.startsWith("https://"))
    ).toBe(true);
  });

  it("removes only the invalid entry when its local file is missing", async () => {
    const port = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(port, "acct-a", i, i * 1000);
    }
    port.files.delete("file:///cache/umtuba-watch-media/post-3.mp4");
    const manifest = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port,
    });
    expect(manifest.entries).toHaveLength(4);
    expect(manifest.entries.map((row) => row.postId).sort()).toEqual([
      1, 2, 4, 5,
    ]);
    const restarted = restorePort(snapshotPort(port));
    const again = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port: restarted,
    });
    expect(again.entries.map((row) => row.postId).sort()).toEqual([1, 2, 4, 5]);
  });

  it("evicts only the oldest when a sixth watched video is retained", async () => {
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
    expect(port.files.has("file:///cache/umtuba-watch-media/post-1.mp4")).toBe(
      false
    );
    expect(port.files.has("file:///cache/umtuba-watch-media/post-6.mp4")).toBe(
      true
    );
  });

  it("Share/Cancel leaves the offline manifest unchanged", async () => {
    const port = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(port, "acct-a", i, i * 1000);
    }
    const dest = watchOfflineManifestUri("file:///cache/", "acct-a");
    const before = dest ? port.files.get(dest) : null;
    const filesBefore = snapshotPort(port);

    expect(watchShareOverlayUsesHostWindow()).toBe(true);
    expect(watchShareSheetRemountsWatch()).toBe(false);
    expect(shouldDismissWatchShareOnHardwareBack(true)).toBe(true);
    expect(
      resolveWatchInPlaceOverlayClose({
        commentsOpen: false,
        shareSheetOpen: true,
      })
    ).toBe("share");
    expect(watchShareDismissPreservesActiveItem()).toBe(true);

    expect(dest ? port.files.get(dest) : null).toBe(before);
    expect(snapshotPort(port)).toEqual(filesBefore);
    const after = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port,
    });
    expect(after.entries).toHaveLength(5);
  });

  it("does not expose account A cache to account B", async () => {
    const port = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(port, "acct-a", i, i * 1000);
    }
    const accountB = await loadWatchOfflineManifest({
      accountId: "acct-b",
      port,
    });
    expect(accountB.entries).toHaveLength(0);
    const bStartup = await resolveWatchStartupFeed({
      accountId: "acct-b",
      port,
      fetchFeed: async () => {
        throw new Error("offline");
      },
    });
    expect(bStartup.videos).toEqual([]);
    expect(bStartup.source).toBe("offline");

    const accountA = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port,
    });
    expect(accountA.entries).toHaveLength(5);

    await clearWatchOfflineManifestForAccount({ accountId: "acct-a", port });
    const afterLogout = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port,
    });
    expect(afterLogout.entries).toHaveLength(0);
    const aUri = watchOfflineManifestUri("file:///cache/", "acct-a");
    const bUri = watchOfflineManifestUri("file:///cache/", "acct-b");
    expect(aUri).not.toBe(bUri);
    expect(port.files.has(aUri!)).toBe(false);
  });

  it("online feed reconcile prefers verified local src for retained posts", async () => {
    const port = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(port, "acct-a", i, i * 1000);
    }
    const remote = [1, 2, 3, 4, 5, 6].map((i) => video(i));
    const startup = await resolveWatchStartupFeed({
      accountId: "acct-a",
      port,
      fetchFeed: async () => ({ videos: remote, nextCursor: null }),
    });
    expect(startup.source).toBe("feed");
    expect(startup.videos).toHaveLength(6);
    expect(startup.videos[0]?.src.startsWith("file://")).toBe(true);
    expect(startup.videos[4]?.src.startsWith("file://")).toBe(true);
    expect(startup.videos[5]?.src).toBe("https://cdn.example/6.mp4");
  });

  it("writes the manifest atomically through a temp file", async () => {
    const port = createMemoryWatchMediaCachePort();
    const item = video(1);
    const localUri = "file:///cache/umtuba-watch-media/post-1.mp4";
    port.files.set(localUri, "bytes-1");
    const remembered = await rememberWatchedOfflineVideo({
      accountId: "acct-a",
      video: item,
      localUri,
      remoteUri: item.src,
      now: 1000,
      port,
    });
    const dest = watchOfflineManifestUri("file:///cache/", "acct-a");
    expect(dest).toBeTruthy();
    expect(port.files.has(`${dest!}.tmp`)).toBe(false);
    expect(port.files.get(dest!)?.includes('"accountId":"acct-a"')).toBe(true);
    await persistWatchOfflineManifest({
      accountId: "acct-a",
      manifest: remembered.manifest,
      port,
    });
    expect(port.files.has(`${dest!}.tmp`)).toBe(false);
    expect(
      watchVideosFromOfflineManifest(remembered.manifest)[0]?.src.startsWith(
        "file://"
      )
    ).toBe(true);
  });
});
