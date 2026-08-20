import { describe, expect, it, vi } from "vitest";

import { listProfilePosts, mapProfilePostRow } from "./listProfilePosts";

describe("mapProfilePostRow", () => {
  it("maps text posts without inventing images", () => {
    const item = mapProfilePostRow({
      id: 9,
      post_type: "text",
      content: "Hello",
      image_url: null,
      created_at: "2026-08-20T00:00:00Z",
    });
    expect(item).toEqual({
      postId: 9,
      postType: "text",
      content: "Hello",
      imageUrl: null,
      createdAt: "2026-08-20T00:00:00Z",
    });
  });

  it("maps image posts and drops non-http urls", () => {
    const item = mapProfilePostRow({
      id: 10,
      post_type: "image",
      content: "Park",
      image_url: "https://cdn.example/p.jpg",
      created_at: "2026-08-20T00:00:00Z",
    });
    expect(item?.imageUrl).toBe("https://cdn.example/p.jpg");
    expect(
      mapProfilePostRow({
        id: 11,
        post_type: "image",
        image_url: "javascript:alert(1)",
      })?.imageUrl
    ).toBeNull();
  });

  it("drops videos and invalid ids", () => {
    expect(mapProfilePostRow({ id: 0, post_type: "text" })).toBeNull();
    expect(mapProfilePostRow({ id: 3, post_type: "video" })).toBeNull();
  });
});

describe("listProfilePosts", () => {
  it("queries text and image posts for the profile owner only", async () => {
    const limit = vi.fn(async () => ({
      data: [
        {
          id: 7,
          post_type: "text",
          content: "Hi",
          image_url: null,
          created_at: "",
        },
      ],
      error: null,
    }));
    const order = vi.fn(() => ({ limit }));
    const inType = vi.fn(() => ({ order }));
    const eqUser = vi.fn(() => ({ in: inType }));
    const from = vi.fn(() => ({
      select: vi.fn(() => ({ eq: eqUser })),
    }));
    const page = await listProfilePosts({ from } as never, "user-1");
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-1");
    expect(inType).toHaveBeenCalledWith("post_type", ["text", "image"]);
    expect(page.posts).toHaveLength(1);
    expect(page.posts[0]?.postId).toBe(7);
  });
});
