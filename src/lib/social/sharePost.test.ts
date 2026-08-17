import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Share: {
    share: vi.fn(),
    dismissedAction: "dismissedAction",
    sharedAction: "sharedAction",
  },
}));

vi.mock("expo-sharing", () => ({
  isAvailableAsync: vi.fn(async () => true),
  shareAsync: vi.fn(async () => undefined),
}));

vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  downloadAsync: vi.fn(),
  deleteAsync: vi.fn(),
}));

import { Share } from "react-native";

import {
  WATCH_SHARE_CHOICES,
  buildMobilePostShareUrl,
  createShareAttempt,
  isCanonicalMobilePostShareUrl,
  isLocalOrCreateAssetUri,
  isSafeShareFileUri,
  readOptimizedPlaybackPath,
  resolveBoundSharePostId,
  resolveShareableStoragePath,
  shareIdentitySwitched,
  shareWatchPost,
  shareWatchPostFile,
  shareWatchPostLink,
  tempShareFileName,
  urlLeaksCredentialsOrSignedParams,
  type ShareDownloadPort,
  type ShareFilePort,
  type ShareLinkPort,
} from "./sharePost";

describe("WATCH_SHARE_CHOICES", () => {
  it("exposes exactly two shared catalog modes", () => {
    expect(WATCH_SHARE_CHOICES).toEqual([
      { mode: "link", key: "watch.shareVideoLink" },
      { mode: "file", key: "watch.shareVideoFile" },
    ]);
  });
});

describe("buildMobilePostShareUrl", () => {
  it("builds the canonical watch URL for the given post only", () => {
    expect(buildMobilePostShareUrl(42)).toBe("https://umtuba.com/watch?post=42");
    expect(buildMobilePostShareUrl(7)).toBe("https://umtuba.com/watch?post=7");
    expect(buildMobilePostShareUrl(0)).toBeNull();
    expect(buildMobilePostShareUrl(-1)).toBeNull();
    expect(buildMobilePostShareUrl(1.5)).toBeNull();
  });

  it("accepts only the permanent umtuba.com watch contract", () => {
    expect(isCanonicalMobilePostShareUrl("https://umtuba.com/watch?post=42")).toBe(
      true
    );
    expect(isCanonicalMobilePostShareUrl("https://umtuba.com/")).toBe(false);
    expect(isCanonicalMobilePostShareUrl("https://umtuba.com/watch")).toBe(false);
    expect(
      isCanonicalMobilePostShareUrl("https://cdn.example/watch?post=42")
    ).toBe(false);
    expect(
      isCanonicalMobilePostShareUrl(
        "https://umtuba.com/watch?post=42&token=abc"
      )
    ).toBe(false);
  });
});

describe("signed URL leak guard", () => {
  it("rejects signed storage URLs, tokens, and service-role material", () => {
    expect(
      urlLeaksCredentialsOrSignedParams(
        "https://xyz.supabase.co/storage/v1/object/sign/post-videos/a.mp4?token=secret"
      )
    ).toBe(true);
    expect(
      urlLeaksCredentialsOrSignedParams(
        "https://bucket.s3.amazonaws.com/a.mp4?X-Amz-Signature=1&X-Amz-Credential=AKIA"
      )
    ).toBe(true);
    expect(
      urlLeaksCredentialsOrSignedParams(
        "https://umtuba.com/watch?post=1&apikey=service_role"
      )
    ).toBe(true);
    expect(
      urlLeaksCredentialsOrSignedParams("https://umtuba.com/watch?post=1")
    ).toBe(false);
    expect(
      isSafeShareFileUri(
        "https://xyz.supabase.co/storage/v1/object/sign/post-videos/a.mp4?token=secret"
      )
    ).toBe(false);
    expect(isSafeShareFileUri("file:///cache/umtuba-share-1.mp4")).toBe(true);
  });

  it("rejects Create/upload local leftovers as share sources", () => {
    expect(isLocalOrCreateAssetUri("file:///tmp/create-pick.mp4")).toBe(true);
    expect(isLocalOrCreateAssetUri("content://media/external/video/123")).toBe(
      true
    );
    expect(isLocalOrCreateAssetUri("ph://asset-id")).toBe(true);
    expect(isLocalOrCreateAssetUri("user/clip.mp4")).toBe(false);
  });
});

describe("share identity guard", () => {
  it("freezes the captured post when Watch swipes away", () => {
    const attempt = createShareAttempt(42);
    expect(attempt?.postId).toBe(42);
    expect(resolveBoundSharePostId(attempt!, 99)).toBe(42);
    expect(resolveBoundSharePostId(attempt!, 42)).toBe(42);
    expect(shareIdentitySwitched(attempt!, 42)).toBe(false);
    expect(shareIdentitySwitched(attempt!, 99)).toBe(true);
  });

  it("rejects invalid post ids", () => {
    expect(createShareAttempt(0)).toBeNull();
    expect(createShareAttempt(-3)).toBeNull();
    expect(createShareAttempt(1.2)).toBeNull();
  });
});

describe("resolveShareableStoragePath", () => {
  it("prefers the UGC optimized playback copy when present", () => {
    expect(
      resolveShareableStoragePath({
        videoPath: "owner/original.mov",
        mediaPipeline: {
          ugc_transcode: { optimized_path: "owner/clip-playback.mp4" },
        },
        localUri: "file:///tmp/stale-create.mov",
      })
    ).toEqual({
      ok: true,
      storagePath: "owner/clip-playback.mp4",
      preferred: "optimized",
    });
    expect(
      readOptimizedPlaybackPath({
        ugc_transcode: { optimized_path: "owner/clip-playback.mp4" },
      })
    ).toBe("owner/clip-playback.mp4");
  });

  it("falls back to the post video_path and ignores signed/local URLs", () => {
    expect(
      resolveShareableStoragePath({
        videoPath: "owner/clip.mp4",
        videoUrl:
          "https://xyz.supabase.co/storage/v1/object/sign/post-videos/owner/clip.mp4?token=secret",
        localUri: "content://media/external/video/9",
      })
    ).toEqual({
      ok: true,
      storagePath: "owner/clip.mp4",
      preferred: "original",
    });
    expect(
      resolveShareableStoragePath({
        videoPath:
          "https://xyz.supabase.co/storage/v1/object/sign/post-videos/a.mp4?token=x",
        videoUrl: "https://cdn.example/a.mp4?token=x",
      })
    ).toEqual({ ok: false });
  });
});

describe("shareWatchPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shares the current post URL and records that post id", async () => {
    vi.mocked(Share.share).mockResolvedValue({
      action: Share.sharedAction,
    } as never);
    const rpc = vi.fn(async () => ({
      data: { counted: true, shares: 4 },
      error: null,
    }));
    const result = await shareWatchPost({ rpc } as never, {
      postId: 88,
      title: "Clip",
      text: "Hello",
    });
    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://umtuba.com/watch?post=88",
        message: expect.stringContaining("https://umtuba.com/watch?post=88"),
      }),
      expect.any(Object)
    );
    expect(rpc).toHaveBeenCalledWith("record_post_share", {
      p_post_id: 88,
      p_viewer_key: expect.stringMatching(/^d:[0-9a-f-]+$/),
    });
    expect(result).toEqual({
      ok: true,
      shared: true,
      shares: 4,
      url: "https://umtuba.com/watch?post=88",
      mode: "link",
    });
  });

  it("does not record a share when the sheet is dismissed", async () => {
    vi.mocked(Share.share).mockResolvedValue({
      action: Share.dismissedAction,
    } as never);
    const rpc = vi.fn();
    const result = await shareWatchPost({ rpc } as never, { postId: 3 });
    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      shared: false,
      shares: 0,
      url: "https://umtuba.com/watch?post=3",
      mode: "link",
    });
  });
});

describe("shareWatchPostLink identity + leak", () => {
  it("keeps the captured post when the visible Watch item changes", async () => {
    const linkPort: ShareLinkPort = {
      share: vi.fn(async (payload) => {
        expect(payload.url).toBe("https://umtuba.com/watch?post=42");
        expect(urlLeaksCredentialsOrSignedParams(payload.url)).toBe(false);
        return { dismissed: false };
      }),
    };
    const rpc = vi.fn(async () => ({
      data: { counted: true, shares: 1 },
      error: null,
    }));
    const attempt = createShareAttempt(42)!;
    const result = await shareWatchPostLink({ rpc } as never, {
      attempt,
      visiblePostId: 99,
      linkPort,
    });
    expect(result).toMatchObject({
      ok: true,
      shared: true,
      url: "https://umtuba.com/watch?post=42",
      mode: "link",
    });
    expect(rpc).toHaveBeenCalledWith(
      "record_post_share",
      expect.objectContaining({ p_post_id: 42 })
    );
  });
});

describe("shareWatchPostFile", () => {
  const signed =
    "https://xyz.supabase.co/storage/v1/object/sign/post-videos/owner/clip-playback.mp4?token=secret";

  function filePorts(overrides?: {
    shareFile?: ShareFilePort["shareFile"];
    download?: ShareDownloadPort["download"];
  }) {
    const deleted: string[] = [];
    const filePort: ShareFilePort = {
      isAvailable: async () => true,
      shareFile:
        overrides?.shareFile ??
        (async (payload) => {
          expect(isSafeShareFileUri(payload.fileUri)).toBe(true);
          expect(payload.fileUri).not.toBe(signed);
          expect(urlLeaksCredentialsOrSignedParams(payload.fileUri)).toBe(false);
          return { dismissed: false };
        }),
    };
    const downloadPort: ShareDownloadPort = {
      cacheDirectory: () => "file:///cache/",
      download:
        overrides?.download ??
        (async (_source, dest) => ({ uri: dest, status: 200 })),
      delete: async (uri) => {
        deleted.push(uri);
      },
    };
    return { filePort, downloadPort, deleted };
  }

  function supabaseForPost(row: Record<string, unknown>, rpc = vi.fn(async () => ({
    data: { counted: true, shares: 2 },
    error: null,
  }))) {
    return {
      rpc,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: row, error: null })),
          })),
        })),
      })),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(async () => ({
            data: { signedUrl: signed },
            error: null,
          })),
        })),
      },
    };
  }

  it("downloads the authoritative file and never shares the signed URL", async () => {
    const { filePort, downloadPort, deleted } = filePorts();
    const supabase = supabaseForPost({
      id: 42,
      post_type: "video",
      media_status: "ready",
      video_path: "owner/original.mov",
      video_url: signed,
      media_pipeline: {
        ugc_transcode: { optimized_path: "owner/clip-playback.mp4" },
      },
    });
    const attempt = createShareAttempt(42)!;
    const result = await shareWatchPostFile(supabase as never, {
      attempt,
      visiblePostId: 77,
      localUri: "file:///tmp/stale-create.mov",
      filePort,
      downloadPort,
    });
    expect(result).toEqual({
      ok: true,
      shared: true,
      shares: 2,
      url: "https://umtuba.com/watch?post=42",
      mode: "file",
    });
    expect(supabase.storage.from).toHaveBeenCalledWith("post-videos");
    expect(deleted).toEqual([
      `file:///cache/${tempShareFileName(attempt.attemptId, "owner/clip-playback.mp4")}`,
    ]);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "record_post_share",
      expect.objectContaining({ p_post_id: 42 })
    );
  });

  it("fails truthfully when the post is not shareable and still cleans up nothing leaked", async () => {
    const { filePort, downloadPort, deleted } = filePorts();
    const supabase = supabaseForPost({
      id: 5,
      post_type: "video",
      media_status: "processing",
      video_path: "owner/clip.mp4",
      video_url: null,
      media_pipeline: null,
    });
    const result = await shareWatchPostFile(supabase as never, {
      attempt: createShareAttempt(5)!,
      filePort,
      downloadPort,
      labels: { mediaUnavailable: "Media unavailable" },
    });
    expect(result).toEqual({
      ok: false,
      code: "media_unavailable",
      message: "Media unavailable",
    });
    expect(deleted).toEqual([]);
  });

  it("treats cancel as a non-share and deletes the temp file", async () => {
    const { filePort, downloadPort, deleted } = filePorts({
      shareFile: async () => {
        throw new Error("User canceled");
      },
    });
    const supabase = supabaseForPost({
      id: 8,
      post_type: "video",
      media_status: "ready",
      video_path: "owner/clip.mp4",
      video_url: null,
      media_pipeline: null,
    });
    const attempt = createShareAttempt(8)!;
    const result = await shareWatchPostFile(supabase as never, {
      attempt,
      filePort,
      downloadPort,
    });
    expect(result).toEqual({
      ok: true,
      shared: false,
      shares: 0,
      url: "https://umtuba.com/watch?post=8",
      mode: "file",
    });
    expect(deleted).toHaveLength(1);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("does not silently substitute a URL when the downloaded URI is still signed", async () => {
    const { filePort, downloadPort } = filePorts({
      download: async () => ({ uri: signed, status: 200 }),
    });
    const shareFile = vi.fn();
    const result = await shareWatchPostFile(
      supabaseForPost({
        id: 3,
        post_type: "video",
        media_status: "ready",
        video_path: "owner/clip.mp4",
        video_url: null,
        media_pipeline: null,
      }) as never,
      {
        attempt: createShareAttempt(3)!,
        filePort: { ...filePort, shareFile },
        downloadPort,
      }
    );
    expect(shareFile).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("share_failed");
  });
});
