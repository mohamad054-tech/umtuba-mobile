import { describe, expect, it } from "vitest";

import {
  mapRowToWatchVideo,
  promoteFocusedWatchRow,
  type VideoPostRow,
} from "./watchFeed";

const baseRow: VideoPostRow = {
  id: 99,
  user_id: "11111111-1111-4111-8111-111111111111",
  content: "Hello from UMTUBA #travel",
  post_type: "video",
  author_name: "Ada",
  author_username: "ada",
  author_avatar: "A",
  image_url: null,
  video_url: null,
  video_path: "user/clip.mp4",
  likes: 3,
  comments: 1,
  shares: 0,
  saves: 2,
  views: 10,
  created_at: "2026-01-01T00:00:00Z",
};

describe("mapRowToWatchVideo", () => {
  it("maps row + playback url into WatchVideo", () => {
    const video = mapRowToWatchVideo({
      row: baseRow,
      playbackUrl: "https://cdn.example/signed.mp4",
      likedByMe: true,
      savedByMe: false,
    });

    expect(video.id).toBe("post-99");
    expect(video.postId).toBe(99);
    expect(video.src).toBe("https://cdn.example/signed.mp4");
    expect(video.author.username).toBe("@ada");
    expect(video.likedByMe).toBe(true);
    expect(video.savedByMe).toBe(false);
    expect(video.stats.likes).toBe(3);
    expect(video.source).toBe("supabase");
  });

  it("does not mark liked from a global like count", () => {
    const video = mapRowToWatchVideo({
      row: { ...baseRow, likes: 99 },
      playbackUrl: "https://cdn.example/signed.mp4",
      likedByMe: false,
      savedByMe: false,
    });
    expect(video.likedByMe).toBe(false);
    expect(video.stats.likes).toBe(99);
  });

  it("prefixes username with @ when missing", () => {
    const video = mapRowToWatchVideo({
      row: { ...baseRow, author_username: "@already" },
      playbackUrl: "https://x/y.mp4",
      likedByMe: false,
      savedByMe: true,
    });
    expect(video.author.username).toBe("@already");
    expect(video.savedByMe).toBe(true);
  });
});

describe("promoteFocusedWatchRow", () => {
  it("moves an in-page focused post to the front", () => {
    const rows = [{ id: 1 }, { id: 42 }, { id: 3 }];
    expect(promoteFocusedWatchRow(rows, null, 42).map((row) => row.id)).toEqual([
      42, 1, 3,
    ]);
  });

  it("prepends a fetched focused post that is missing from the page", () => {
    const rows = [{ id: 1 }, { id: 2 }];
    expect(
      promoteFocusedWatchRow(rows, { id: 99 }, 99).map((row) => row.id)
    ).toEqual([99, 1, 2]);
  });

  it("leaves the page unchanged without a valid focus id", () => {
    const rows = [{ id: 1 }, { id: 2 }];
    expect(promoteFocusedWatchRow(rows, { id: 99 }, null)).toEqual(rows);
    expect(promoteFocusedWatchRow(rows, null, 0)).toEqual(rows);
  });
});
