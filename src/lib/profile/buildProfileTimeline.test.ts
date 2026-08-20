import { describe, expect, it } from "vitest";

import { buildProfileTimeline } from "./buildProfileTimeline";

describe("buildProfileTimeline", () => {
  it("mixes text, image, and video posts newest first", () => {
    const items = buildProfileTimeline(
      [
        {
          postId: 1,
          postType: "text",
          content: "Hello",
          imageUrl: null,
          createdAt: "2026-08-18T00:00:00Z",
        },
        {
          postId: 2,
          postType: "image",
          content: "Park",
          imageUrl: "https://cdn.example/p.jpg",
          createdAt: "2026-08-20T00:00:00Z",
        },
      ],
      [
        {
          postId: 3,
          title: "Clip",
          likes: 0,
          views: 0,
          posterUrl: "https://cdn.example/v.jpg",
          createdAt: "2026-08-19T00:00:00Z",
        },
      ]
    );

    expect(items.map((item) => item.kind)).toEqual(["image", "video", "text"]);
    expect(items[0]).toMatchObject({ postId: 2, kind: "image" });
    expect(items[1]).toMatchObject({ postId: 3, kind: "video" });
    expect(items[2]).toMatchObject({ postId: 1, kind: "text" });
  });

  it("does not invent rows when both lists are empty", () => {
    expect(buildProfileTimeline([], [])).toEqual([]);
  });
});
