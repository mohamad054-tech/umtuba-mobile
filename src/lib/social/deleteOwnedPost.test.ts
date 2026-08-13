import { describe, expect, it, vi, beforeEach } from "vitest";

import { deletePostForOwner } from "./deleteOwnedPost";
import {
  applySuccessfulDeleteToList,
  OWN_CONTENT_DELETE_ERRORS,
  viewerMaySeeDeleteControl,
} from "./deleteOwnedPostShared";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

vi.mock("@/src/lib/video/deleteOwnedVideo", () => ({
  deleteOwnedVideoObject: vi.fn(async () => undefined),
}));

function createSupabaseMock(options: {
  load: { data: unknown; error: unknown };
  deleted?: { data: unknown; error: unknown };
}) {
  let postsCalls = 0;
  const from = vi.fn(() => {
    postsCalls += 1;
    if (postsCalls === 1) {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn(async () => options.load),
          }),
        }),
      };
    }
    return {
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn(async () =>
              options.deleted ?? { data: [{ id: 42 }], error: null }
            ),
          }),
        }),
      }),
    };
  });

  return { from };
}

describe("UAF-12 own content delete — mobile consume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the delete control only to the owner", () => {
    expect(viewerMaySeeDeleteControl(OWNER, OWNER)).toBe(true);
    expect(viewerMaySeeDeleteControl(OTHER, OWNER)).toBe(false);
    expect(viewerMaySeeDeleteControl(null, OWNER)).toBe(false);
  });

  it("rejects a non-owner after load", async () => {
    const supabase = createSupabaseMock({
      load: {
        data: {
          id: 42,
          user_id: OWNER,
          post_type: "video",
          video_path: `${OWNER}/clip.mp4`,
          thumbnail_path: null,
        },
        error: null,
      },
    });
    const result = await deletePostForOwner(supabase as never, OTHER, 42);
    expect(result).toEqual({
      ok: false,
      code: "not_owner",
      message: OWN_CONTENT_DELETE_ERRORS.notOwner,
    });
  });

  it("deletes when the signed-in user owns the post", async () => {
    const supabase = createSupabaseMock({
      load: {
        data: {
          id: 42,
          user_id: OWNER,
          post_type: "video",
          video_path: `${OWNER}/clip.mp4`,
          thumbnail_path: null,
        },
        error: null,
      },
    });
    const result = await deletePostForOwner(supabase as never, OWNER, 42);
    expect(result).toEqual({
      ok: true,
      postId: 42,
      postType: "video",
    });
  });

  it("removes the item from a list only after success", () => {
    const items = [{ id: 1 }, { id: 2 }];
    expect(
      applySuccessfulDeleteToList(items, (row) => row.id === 1, false)
    ).toEqual(items);
    expect(
      applySuccessfulDeleteToList(items, (row) => row.id === 1, true)
    ).toEqual([{ id: 2 }]);
  });
});
