import { describe, expect, it, vi } from "vitest";

import { listProfileVideos, mapProfileVideoRow } from "./listProfileVideos";

describe("mapProfileVideoRow", () => {
  it("maps a published video without inventing identity", () => {
    const item = mapProfileVideoRow({
      id: 12,
      content: "Sunset",
      likes: 3,
      views: 40,
      image_url: "https://cdn.example/p.jpg",
      created_at: "2026-08-17T00:00:00Z",
    });
    expect(item).toEqual({
      postId: 12,
      title: "Sunset",
      likes: 3,
      views: 40,
      posterUrl: "https://cdn.example/p.jpg",
      createdAt: "2026-08-17T00:00:00Z",
    });
  });

  it("drops invalid ids and non-http posters", () => {
    expect(mapProfileVideoRow({ id: 0, content: "x" })).toBeNull();
    expect(
      mapProfileVideoRow({
        id: 2,
        image_url: "javascript:alert(1)",
      })?.posterUrl
    ).toBeNull();
  });
});

describe("listProfileVideos", () => {
  it("queries ready videos for the profile owner only", async () => {
    const limit = vi.fn(async () => ({
      data: [{ id: 5, content: "A", likes: 1, views: 2, image_url: null, created_at: "" }],
      error: null,
    }));
    const orderId = vi.fn(() => ({ limit }));
    const orderCreated = vi.fn(() => ({ order: orderId }));
    const not = vi.fn(() => ({ order: orderCreated }));
    const eqMedia = vi.fn(() => ({ not }));
    const eqType = vi.fn(() => ({ eq: eqMedia }));
    const eqUser = vi.fn(() => ({ eq: eqType }));
    const from = vi.fn(() => ({
      select: vi.fn(() => ({ eq: eqUser })),
    }));
    const page = await listProfileVideos({ from } as never, "user-1");
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-1");
    expect(eqType).toHaveBeenCalledWith("post_type", "video");
    expect(eqMedia).toHaveBeenCalledWith("media_status", "ready");
    expect(page.videos).toHaveLength(1);
    expect(page.videos[0]?.postId).toBe(5);
  });
});
