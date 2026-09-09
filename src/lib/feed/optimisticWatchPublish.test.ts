import { afterEach, describe, expect, it } from "vitest";

import { WATCH_ENGINE_COMMIT_FRACTION } from "@/src/lib/watch/engine/gesture";
import { WATCH_ENGINE_SNAP_DURATION_MS } from "@/src/lib/watch/engine/snap";

import {
  applyOptimisticWatchRecordsToList,
  beginOptimisticRetry,
  createOptimisticWatchRecord,
  insertOptimisticWatchRecord,
  markOptimisticFailed,
  markOptimisticLocalVisible,
  reconcileOptimisticWithServer,
  resetOptimisticWatchPublishForTests,
  shouldFocusNewOptimisticItem,
} from "./optimisticWatchPublish";

const author = {
  id: "user-1",
  name: "Ada",
  username: "ada",
  avatar: "A",
};

const asset = {
  uri: "file:///tmp/clip.mp4",
  fileName: "clip.mp4",
  mimeType: "video/mp4",
  byteSize: 12_000,
  durationMs: 4000,
  width: 1080,
  height: 1920,
};

function seed(clientId = "optimistic-a") {
  const record = createOptimisticWatchRecord({
    clientId,
    localUri: asset.uri,
    caption: "hello",
    asset,
    author,
    now: 1_000,
  });
  insertOptimisticWatchRecord(record);
  return record;
}

afterEach(() => {
  resetOptimisticWatchPublishForTests();
});

describe("optimistic Watch publish item", () => {
  it("appears in Watch before upload complete", () => {
    const record = seed();
    const list = applyOptimisticWatchRecordsToList([]);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(record.clientId);
    expect(list[0]?.src).toBe("file:///tmp/clip.mp4");
    expect(list[0]?.postId).toBeNull();
    expect(record.phase).toBe("uploading");
    expect(record.timestamps.t0).toBe(1_000);
    expect(record.timestamps.t3).toBeNull();
  });

  it("reconciles the same logical item after server commit", () => {
    const record = seed();
    const next = reconcileOptimisticWithServer(record, {
      postId: 77,
      videoPath: "user-1/clip.mp4",
      remoteSrc: "https://cdn.example/signed.mp4",
      now: 2_000,
    });
    expect(next.video.id).toBe(record.clientId);
    expect(next.video.src).toBe(record.localUri);
    expect(next.video.postId).toBeNull();
    expect(next.serverPostId).toBe(77);
    expect(next.phase).toBe("ready");
    expect(next.handoffComplete).toBe(true);
    expect(next.playerRecreatedOnHandoff).toBe(false);
    expect(next.remoteSrc).toBe("https://cdn.example/signed.mp4");
  });

  it("does not insert a duplicate when the feed later returns the server post", () => {
    const record = seed();
    const ready = reconcileOptimisticWithServer(record, {
      postId: 77,
      videoPath: "user-1/clip.mp4",
      remoteSrc: "https://cdn.example/signed.mp4",
      now: 2_000,
    });
    insertOptimisticWatchRecord(ready);
    const list = applyOptimisticWatchRecordsToList([
      {
        ...ready.video,
        id: "post-77",
        postId: 77,
        src: "https://cdn.example/signed.mp4",
      },
      {
        ...ready.video,
        id: "post-12",
        postId: 12,
        src: "https://cdn.example/other.mp4",
      },
    ]);
    expect(list.map((row) => row.id)).toEqual([record.clientId, "post-12"]);
    expect(list.filter((row) => row.postId === 77)).toHaveLength(0);
  });

  it("keeps a failed local preview and resets the same item on retry", () => {
    seed();
    const failed = markOptimisticFailed("optimistic-a", "network down");
    expect(failed?.phase).toBe("failed");
    expect(failed?.video.src).toBe("file:///tmp/clip.mp4");
    expect(failed?.serverPostId).toBeNull();
    const retried = beginOptimisticRetry("optimistic-a", 3_000);
    expect(retried?.phase).toBe("uploading");
    expect(retried?.error).toBeNull();
    expect(retried?.video.id).toBe("optimistic-a");
    expect(retried?.video.src).toBe("file:///tmp/clip.mp4");
  });

  it("hands off local to remote without changing media identity or src", () => {
    const record = seed();
    markOptimisticLocalVisible(record.clientId, 1_100);
    const next = reconcileOptimisticWithServer(record, {
      postId: 9,
      videoPath: "user-1/ready.mp4",
      remoteSrc: "https://cdn.example/ready.mp4",
      now: 4_000,
    });
    expect(next.video.id).toBe(record.video.id);
    expect(next.video.src).toBe(record.localUri);
    expect(next.remoteSrc).toBe("https://cdn.example/ready.mp4");
    expect(next.playerRecreatedOnHandoff).toBe(false);
    expect(shouldFocusNewOptimisticItem([next], next.video.id)).toBe(false);
  });
});

describe("locked Watch baseline contracts", () => {
  it("keeps engine commit 0.1 and snap 120ms", () => {
    expect(WATCH_ENGINE_COMMIT_FRACTION).toBe(0.1);
    expect(WATCH_ENGINE_SNAP_DURATION_MS).toBe(120);
  });
});
