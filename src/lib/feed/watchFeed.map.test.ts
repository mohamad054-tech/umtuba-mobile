import { describe, expect, it } from "vitest";

import { mapRowToWatchVideo, type VideoPostRow } from "./watchFeed";

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
