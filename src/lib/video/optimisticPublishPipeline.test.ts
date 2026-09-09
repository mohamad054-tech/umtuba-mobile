import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyOptimisticWatchRecordsToList,
  createOptimisticWatchRecord,
  insertOptimisticWatchRecord,
  resetOptimisticWatchPublishForTests,
} from "@/src/lib/feed/optimisticWatchPublish";
import {
  retryOptimisticPublish,
  runOptimisticPublishPipeline,
  type OptimisticPublishDeps,
} from "@/src/lib/video/optimisticPublishPipeline";

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

function seed() {
  const record = createOptimisticWatchRecord({
    clientId: "optimistic-pipe",
    localUri: asset.uri,
    caption: "hello",
    asset,
    author,
    now: 10,
  });
  insertOptimisticWatchRecord(record);
  return record;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function deps(overrides: Partial<OptimisticPublishDeps> = {}): OptimisticPublishDeps {
  return {
    now: () => 100,
    expectedUserId: "user-1",
    getAccessToken: async () => "token",
    assertUserId: async () => "user-1",
    upload: async () => ({
      path: "user-1/clip.mp4",
      mimeType: "video/mp4",
      byteSize: 12_000,
    }),
    publish: async () => ({ ok: true, postId: 44 }),
    peekSignedUrl: () => "https://cdn.example/signed.mp4",
    deleteOwnedObject: vi.fn(async () => undefined),
    queueOrphan: vi.fn(async () => undefined),
    clearOrphan: vi.fn(async () => undefined),
    ...overrides,
  };
}

afterEach(() => {
  resetOptimisticWatchPublishForTests();
});

describe("optimistic publish pipeline", () => {
  it("keeps the local Watch item visible while upload is still in flight", async () => {
    seed();
    const upload = deferred<{
      path: string;
      mimeType: string;
      byteSize: number;
    }>();
    const started = runOptimisticPublishPipeline(
      "optimistic-pipe",
      deps({ upload: () => upload.promise })
    );
    const during = applyOptimisticWatchRecordsToList([]);
    expect(during[0]?.src).toBe("file:///tmp/clip.mp4");
    expect(during[0]?.id).toBe("optimistic-pipe");
    upload.resolve({
      path: "user-1/clip.mp4",
      mimeType: "video/mp4",
      byteSize: 12_000,
    });
    const finished = await started;
    expect(finished?.phase).toBe("ready");
    expect(finished?.video.id).toBe("optimistic-pipe");
    expect(finished?.video.src).toBe("file:///tmp/clip.mp4");
    expect(finished?.serverPostId).toBe(44);
  });

  it("cleans up a partial object, stays failed, and retries the same item", async () => {
    seed();
    const deleteOwnedObject = vi.fn(async () => undefined);
    const failed = await runOptimisticPublishPipeline(
      "optimistic-pipe",
      deps({
        upload: async () => {
          throw new Error("network down");
        },
        deleteOwnedObject,
      })
    );
    expect(failed?.phase).toBe("failed");
    expect(failed?.video.src).toBe("file:///tmp/clip.mp4");
    expect(deleteOwnedObject).not.toHaveBeenCalled();

    const afterUploadFail = await runOptimisticPublishPipeline(
      "optimistic-pipe",
      deps({
        upload: async () => ({
          path: "user-1/partial.mp4",
          mimeType: "video/mp4",
          byteSize: 12_000,
        }),
        publish: async () => ({
          ok: false,
          code: "publish_failed",
          message: "db down",
          videoPath: "user-1/partial.mp4",
        }),
        deleteOwnedObject,
      })
    );
    expect(afterUploadFail?.phase).toBe("failed");
    expect(deleteOwnedObject).toHaveBeenCalledWith("user-1", "user-1/partial.mp4");

    const retried = await retryOptimisticPublish(
      "optimistic-pipe",
      deps({
        upload: async () => ({
          path: "user-1/retry.mp4",
          mimeType: "video/mp4",
          byteSize: 12_000,
        }),
        publish: async () => ({ ok: true, postId: 88 }),
        peekSignedUrl: () => "https://cdn.example/retry.mp4",
      })
    );
    expect(retried?.phase).toBe("ready");
    expect(retried?.video.id).toBe("optimistic-pipe");
    expect(retried?.serverPostId).toBe(88);
    expect(retried?.video.src).toBe("file:///tmp/clip.mp4");
  });
});
