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
  createFileSystemWatchMediaCachePort,
  createMemoryWatchMediaCachePort,
  type ExpoWatchFileSystemLike,
} from "./androidWatchMediaCache";
import {
  WATCH_OFFLINE_DURABLE_ROOT,
  WATCH_OFFLINE_MANIFEST_FILE,
  WATCH_OFFLINE_MANIFEST_TARGET,
  WATCH_OFFLINE_VIDEOS_DIR,
  clearWatchOfflineManifestForAccount,
  hashWatchOfflineAccountId,
  loadWatchOfflineManifest,
  offlineBootstrapUsesFileUrisOnly,
  persistWatchOfflineManifest,
  rememberWatchedOfflineVideo,
  resolveWatchStartupFeed,
  sanitizeWatchOfflineAccountId,
  watchOfflineAccountDirName,
  watchOfflineDurableVideoUri,
  watchOfflineManifestBackupUri,
  watchOfflineManifestTempUri,
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
  entries: Array<[string, string]>,
  cacheRoot = "file:///cache/",
  documentRoot = "file:///documents/"
): ReturnType<typeof createMemoryWatchMediaCachePort> {
  const port = createMemoryWatchMediaCachePort(cacheRoot, documentRoot);
  for (const [uri, text] of entries) {
    port.files.set(uri, text);
  }
  return port;
}

function manifestUri(
  port: ReturnType<typeof createMemoryWatchMediaCachePort>,
  accountId: string
) {
  return watchOfflineManifestUri(port.documentDirectory(), accountId);
}

function durableVideoUri(
  port: ReturnType<typeof createMemoryWatchMediaCachePort>,
  accountId: string,
  index: number
) {
  return watchOfflineDurableVideoUri(
    port.documentDirectory(),
    accountId,
    `post-${index}`
  );
}

function stubExpoFileSystem(input: {
  cacheDirectory: string;
  documentDirectory: string;
}): ExpoWatchFileSystemLike {
  return {
    cacheDirectory: input.cacheDirectory,
    documentDirectory: input.documentDirectory,
    getInfoAsync: async () => ({ exists: false }),
    downloadAsync: async (_sourceUrl, destUri) => ({ uri: destUri, status: 200 }),
    deleteAsync: async () => undefined,
    moveAsync: async () => undefined,
    copyAsync: async () => undefined,
    makeDirectoryAsync: async () => undefined,
    readAsStringAsync: async () => "",
    writeAsStringAsync: async () => undefined,
  };
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
      expect(entry.localUri.startsWith(port.documentDirectory()!)).toBe(true);
      expect(entry.cachedAt).toBeGreaterThan(0);
      expect(entry.lastWatchedAt).toBeGreaterThan(0);
      expect(entry.durationMs).toBeGreaterThan(0);
    }
    const dest = manifestUri(port, "acct-a");
    expect(dest).toBeTruthy();
    expect(dest?.startsWith(port.documentDirectory()!)).toBe(true);
    expect(port.files.has(dest!)).toBe(true);
    expect(port.files.has(`${dest!}.tmp`)).toBe(false);
    expect(port.files.has(`${dest!}.bak`)).toBe(false);
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

  it("removes only the invalid entry when its durable file is missing", async () => {
    const port = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(port, "acct-a", i, i * 1000);
    }
    port.files.delete(durableVideoUri(port, "acct-a", 3)!);
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

  it("evicts only the oldest durable file when a sixth watched video is retained", async () => {
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
    expect(port.files.has(durableVideoUri(port, "acct-a", 1)!)).toBe(false);
    expect(port.files.has(durableVideoUri(port, "acct-a", 6)!)).toBe(true);
    expect(port.files.has("file:///cache/umtuba-watch-media/post-1.mp4")).toBe(
      true
    );
  });

  it("Share/Cancel leaves the offline manifest unchanged", async () => {
    const port = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(port, "acct-a", i, i * 1000);
    }
    const dest = manifestUri(port, "acct-a");
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
    const aUri = manifestUri(port, "acct-a");
    const bUri = manifestUri(port, "acct-b");
    expect(aUri).not.toBe(bUri);
    expect(port.files.has(aUri!)).toBe(false);
    expect(port.files.has(durableVideoUri(port, "acct-a", 1)!)).toBe(false);
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
    const dest = manifestUri(port, "acct-a");
    expect(dest).toBeTruthy();
    expect(port.files.has(`${dest!}.tmp`)).toBe(false);
    expect(port.files.has(`${dest!}.bak`)).toBe(false);
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

describe("Watch durable documentDirectory store", () => {
  it("production FileSystem adapter path builders bind documentDirectory (expo-file-system cannot run in vitest)", () => {
    const expoCache = "file:///data/user/0/com.umtuba.app/cache/";
    const expoDocuments = "file:///data/user/0/com.umtuba.app/files/";
    const port = createFileSystemWatchMediaCachePort(
      stubExpoFileSystem({
        cacheDirectory: expoCache,
        documentDirectory: expoDocuments,
      })
    );
    expect(port.documentDirectory()).toBe(expoDocuments);
    expect(port.cacheDirectory()).toBe(expoCache);

    const email = "owner+qa@umtuba.com";
    const dest = watchOfflineManifestUri(port.documentDirectory(), email);
    const videoUri = watchOfflineDurableVideoUri(
      port.documentDirectory(),
      email,
      "post-41"
    );
    const folder = watchOfflineAccountDirName(email);
    expect(dest).toBe(
      `${expoDocuments}${WATCH_OFFLINE_DURABLE_ROOT}${folder}/${WATCH_OFFLINE_MANIFEST_FILE}`
    );
    expect(videoUri).toBe(
      `${expoDocuments}${WATCH_OFFLINE_DURABLE_ROOT}${folder}/${WATCH_OFFLINE_VIDEOS_DIR}post-41.mp4`
    );
    expect(dest?.includes(expoCache)).toBe(false);
    expect(videoUri?.includes(expoCache)).toBe(false);
    expect(dest?.includes(email)).toBe(false);
    expect(videoUri?.includes(email)).toBe(false);
    expect(dest?.includes("owner")).toBe(false);
    expect(folder).toBe(
      `acct-${hashWatchOfflineAccountId(sanitizeWatchOfflineAccountId(email)!)}`
    );
    expect(folder?.includes("@")).toBe(false);
    expect(WATCH_OFFLINE_DURABLE_ROOT).toBe("umtuba-watch-retained/");
  });

  it("durable filesystem port restart: empty cacheDirectory still restores retained five from documentDirectory", async () => {
    const live = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(live, "acct-a", i, i * 1000);
    }
    const durableOnly = snapshotPort(live).filter(([uri]) =>
      uri.startsWith(live.documentDirectory()!)
    );
    expect(durableOnly.length).toBeGreaterThan(5);
    const restarted = restorePort(durableOnly);
    restarted.files.forEach((_value, uri) => {
      expect(uri.startsWith("file:///cache/")).toBe(false);
    });
    const after = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port: restarted,
    });
    expect(after.entries).toHaveLength(5);
    expect(
      after.entries.every((row) =>
        row.localUri.startsWith(restarted.documentDirectory()!)
      )
    ).toBe(true);
    for (let i = 1; i <= 5; i += 1) {
      expect(restarted.files.has(durableVideoUri(restarted, "acct-a", i)!)).toBe(
        true
      );
    }
  });

  it("primary manifest corruption recovers from backup", async () => {
    const port = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(port, "acct-a", i, i * 1000);
    }
    const dest = manifestUri(port, "acct-a")!;
    const backup = watchOfflineManifestBackupUri(
      port.documentDirectory(),
      "acct-a"
    )!;
    port.files.set(backup, port.files.get(dest)!);
    port.files.set(dest, "{not-json");
    const recovered = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port,
    });
    expect(recovered.entries).toHaveLength(5);
    expect(recovered.entries.map((row) => row.postId).sort()).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(tryJson(port.files.get(dest))).toBe(true);
  });

  it("interrupted promotion recovers without losing the previous manifest", async () => {
    const port = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(port, "acct-a", i, i * 1000);
    }
    const dest = manifestUri(port, "acct-a")!;
    const backup = watchOfflineManifestBackupUri(
      port.documentDirectory(),
      "acct-a"
    )!;
    const temp = watchOfflineManifestTempUri(port.documentDirectory(), "acct-a")!;
    const previous = port.files.get(dest)!;
    port.files.set(backup, previous);
    port.files.set(
      temp,
      JSON.stringify({
        version: 1,
        accountId: "acct-a",
        target: 5,
        entries: [],
      })
    );
    port.files.delete(dest);
    const recovered = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port,
    });
    expect(recovered.entries).toHaveLength(5);
    expect(recovered.entries.map((row) => row.postId).sort()).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(tryJson(port.files.get(dest))).toBe(true);
  });

  it("purgeable cache directory empty still restores retained five", async () => {
    const port = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(port, "acct-a", i, i * 1000);
    }
    for (const uri of [...port.files.keys()]) {
      if (uri.startsWith(port.cacheDirectory()!)) port.files.delete(uri);
    }
    expect(
      [...port.files.keys()].some((uri) => uri.startsWith("file:///cache/"))
    ).toBe(false);
    const restored = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port,
    });
    expect(restored.entries).toHaveLength(5);
    const startup = await resolveWatchStartupFeed({
      accountId: "acct-a",
      port,
      fetchFeed: async () => {
        throw new Error("offline");
      },
    });
    expect(startup.videos).toHaveLength(5);
    expect(offlineBootstrapUsesFileUrisOnly(startup.videos)).toBe(true);
  });

  it("five durable video files exist after restart", async () => {
    const live = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(live, "acct-a", i, i * 1000);
    }
    const restarted = restorePort(snapshotPort(live));
    const after = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port: restarted,
    });
    const durableVideos = [...restarted.files.keys()].filter((uri) =>
      uri.includes(`/${WATCH_OFFLINE_VIDEOS_DIR}`)
    );
    expect(after.entries).toHaveLength(5);
    expect(durableVideos).toHaveLength(5);
    expect(
      durableVideos.every((uri) => uri.startsWith(restarted.documentDirectory()!))
    ).toBe(true);
  });

  it("logout deletes only that account retained directory", async () => {
    const port = createMemoryWatchMediaCachePort();
    for (let i = 1; i <= 5; i += 1) {
      await retain(port, "acct-a", i, i * 1000);
      await retain(port, "acct-b", i + 10, i * 1000);
    }
    await clearWatchOfflineManifestForAccount({ accountId: "acct-a", port });
    const afterA = await loadWatchOfflineManifest({
      accountId: "acct-a",
      port,
    });
    const afterB = await loadWatchOfflineManifest({
      accountId: "acct-b",
      port,
    });
    expect(afterA.entries).toHaveLength(0);
    expect(afterB.entries).toHaveLength(5);
    expect(port.files.has(manifestUri(port, "acct-a")!)).toBe(false);
    expect(port.files.has(manifestUri(port, "acct-b")!)).toBe(true);
    expect(port.files.has(durableVideoUri(port, "acct-b", 11)!)).toBe(true);
    expect(
      [...port.files.keys()].some(
        (uri) =>
          uri.startsWith(port.documentDirectory()!) &&
          uri.includes(watchOfflineAccountDirName("acct-a")!)
      )
    ).toBe(false);
  });
});

function tryJson(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}
