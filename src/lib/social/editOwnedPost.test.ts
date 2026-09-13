import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertSafeUpdatePatch,
  authorizePostEdit,
  composeCaptionWithHashtags,
  engagementSnapshot,
  failPreservingLive,
  publicPostUrl,
  updatePostForOwner,
  viewerMayEditPost,
  type LoadedOwnedPost,
} from "./editOwnedPost";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

vi.mock("@/src/lib/feed/watchFeed", () => ({
  createVideoSignedUrl: vi.fn(async (_client: unknown, path: string) =>
    path.includes("broken") ? null : `https://signed.example/${path}`
  ),
}));

vi.mock("@/src/lib/video/deleteOwnedVideo", () => ({
  deleteOwnedVideoObject: vi.fn(async () => undefined),
}));

function ownedPost(overrides: Partial<LoadedOwnedPost> = {}): LoadedOwnedPost {
  return {
    id: 42,
    user_id: OWNER,
    post_type: "video",
    content: "Hello #umtuba",
    image_url: null,
    video_path: `${OWNER}/live.mp4`,
    video_mime_type: "video/mp4",
    video_byte_size: 1_000_000,
    thumbnail_path: `${OWNER}/thumbs/live.jpg`,
    article_id: null,
    media_status: "ready",
    media_duration_ms: 8000,
    media_pipeline: { hls: null, overlays: { version: 1, elements: [] } },
    likes: 11,
    comments: 4,
    shares: 2,
    saves: 7,
    views: 90,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createSupabaseMock(options: {
  load: LoadedOwnedPost | null;
  updateError?: { message: string } | null;
  articleInsertId?: string;
}) {
  const updateEq = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn(async () =>
          options.updateError
            ? { data: null, error: options.updateError }
            : { data: { id: 42 }, error: null }
        ),
      }),
    }),
  });
  const update = vi.fn(() => ({ eq: updateEq }));

  const from = vi.fn((table: string) => {
    if (table === "articles") {
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: {
                id: options.articleInsertId ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              },
              error: null,
            })),
          })),
        })),
      };
    }

    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn(async () => {
            return {
              data: options.load,
              error: options.load ? null : { message: "missing" },
            };
          }),
        }),
      }),
      update,
    };
  });

  return { from, update };
}

function lastUpdatePatch(update: { mock: { calls: unknown[] } }): Record<string, unknown> {
  const first = update.mock.calls[0];
  const patch = Array.isArray(first) ? first[0] : undefined;
  return patch && typeof patch === "object" ? (patch as Record<string, unknown>) : {};
}

describe("owner authorization", () => {
  it("allows only the owner", () => {
    expect(authorizePostEdit(OWNER, OWNER)).toEqual({ ok: true });
    expect(authorizePostEdit(null, OWNER)).toEqual({
      ok: false,
      code: "auth_required",
    });
    expect(authorizePostEdit(OTHER, OWNER)).toEqual({
      ok: false,
      code: "forbidden",
    });
    expect(viewerMayEditPost(OWNER, OWNER)).toBe(true);
    expect(viewerMayEditPost(OTHER, OWNER)).toBe(false);
  });
});

describe("identity + engagement stay on the same Post ID", () => {
  it("keeps the public URL on the numeric post id", () => {
    expect(publicPostUrl(42)).toBe("/watch?post=42");
  });

  it("snapshots engagement and refuses identity/counter writes", () => {
    const snap = engagementSnapshot(ownedPost());
    expect(snap).toEqual({
      likes: 11,
      comments: 4,
      shares: 2,
      saves: 7,
      views: 90,
    });
    expect(() => assertSafeUpdatePatch({ likes: 0 })).toThrow(/engagement/);
    expect(() => assertSafeUpdatePatch({ id: 99 })).toThrow(/identity/);
    expect(() => assertSafeUpdatePatch({ user_id: OTHER })).toThrow(/identity/);
  });

  it("merges hashtags into the caption without creating a new post", () => {
    expect(composeCaptionWithHashtags("Hello #umtuba", ["travel", "umtuba"])).toBe(
      "Hello #umtuba #travel"
    );
  });
});

describe("updatePostForOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a non-owner and does not update", async () => {
    const supabase = createSupabaseMock({
      load: ownedPost(),
    });
    const result = await updatePostForOwner(supabase as never, OTHER, 42, {
      content: "Hacked",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("forbidden");
      expect(result.livePreserved).toBe(true);
    }
    expect(supabase.update).not.toHaveBeenCalled();
  });

  it("updates caption on the same id and never writes engagement", async () => {
    const supabase = createSupabaseMock({ load: ownedPost() });
    const result = await updatePostForOwner(supabase as never, OWNER, 42, {
      content: "Updated caption #alpha",
    });
    expect(result).toMatchObject({
      ok: true,
      postId: 42,
      publicUrl: "/watch?post=42",
    });
    const patch = lastUpdatePatch(supabase.update);
    expect(patch.content).toBe("Updated caption #alpha");
    expect(patch).not.toHaveProperty("likes");
    expect(patch).not.toHaveProperty("comments");
    expect(patch).not.toHaveProperty("views");
    expect(patch).not.toHaveProperty("id");
    expect(patch).not.toHaveProperty("user_id");
    expect(patch).not.toHaveProperty("created_at");
  });

  it("leaves the live video path when a replacement fails validation", async () => {
    const supabase = createSupabaseMock({ load: ownedPost() });
    const result = await updatePostForOwner(supabase as never, OWNER, 42, {
      media: {
        kind: "replace_video",
        candidatePath: `${OWNER}/broken.mp4`,
        mimeType: "video/mp4",
        byteSize: 1000,
        validated: false,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("media_failed");
      expect(result.livePreserved).toBe(true);
    }
    expect(supabase.update).not.toHaveBeenCalled();
  });

  it("atomically switches a validated revision and retains the previous path in pipeline", async () => {
    const supabase = createSupabaseMock({ load: ownedPost() });
    const result = await updatePostForOwner(supabase as never, OWNER, 42, {
      media: {
        kind: "replace_video",
        candidatePath: `${OWNER}/rev2.mp4`,
        mimeType: "video/mp4",
        byteSize: 2000,
        validated: true,
      },
      trim: { inMs: 0, outMs: 3000 },
    });
    expect(result).toMatchObject({ ok: true, postId: 42, mediaSwitched: true });
    const patch = lastUpdatePatch(supabase.update);
    expect(patch.video_path).toBe(`${OWNER}/rev2.mp4`);
    const pipeline = patch.media_pipeline as Record<string, unknown>;
    expect((pipeline.edit as { previousVideoPath?: string }).previousVideoPath).toBe(
      `${OWNER}/live.mp4`
    );
    expect(pipeline.overlays).toEqual({ version: 1, elements: [] });
    expect((pipeline.playback as { inMs?: number; outMs?: number }).inMs).toBe(0);
    expect((pipeline.playback as { inMs?: number; outMs?: number }).outMs).toBe(3000);
  });

  it("can append an article to a published video without changing Post ID", async () => {
    const supabase = createSupabaseMock({ load: ownedPost() });
    const result = await updatePostForOwner(supabase as never, OWNER, 42, {
      articleTitle: "Full story",
      articleBody: "Body text for the published post.",
    });
    expect(result).toMatchObject({ ok: true, postId: 42 });
    const patch = lastUpdatePatch(supabase.update);
    expect(patch.article_id).toBeTruthy();
  });

  it("edits a draft on the same row", async () => {
    const supabase = createSupabaseMock({
      load: ownedPost({ media_status: "draft", content: "Draft caption" }),
    });
    const result = await updatePostForOwner(supabase as never, OWNER, 42, {
      content: "Draft updated",
    });
    expect(result).toMatchObject({ ok: true, postId: 42 });
  });
});

describe("failed edit helper", () => {
  it("always marks the live post as preserved", () => {
    const failed = failPreservingLive("media_failed", "nope");
    expect(failed.livePreserved).toBe(true);
    expect(failed.ok).toBe(false);
  });
});
