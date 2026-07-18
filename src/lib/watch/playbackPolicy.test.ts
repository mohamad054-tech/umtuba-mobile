import { describe, expect, it } from "vitest";

import type { WatchVideo } from "@/src/contracts/watch";
import {
  isLikelyExpiredPlaybackUrl,
  mergeWatchVideos,
  resolveMuteLabel,
  sanitizePlaybackError,
  shouldLoadPlayer,
  shouldPlayVideo,
  watchItemKey,
} from "./playbackPolicy";

function video(id: string, postId: number | null = null): WatchVideo {
  return {
    id,
    postId,
    src: "https://cdn.example/v.mp4",
    title: "t",
    caption: "",
    location: { city: "", country: "" },
    music: "",
    aiSummary: "",
    translation: "",
    author: { id: null, name: "a", username: "@a", avatar: "A" },
    stats: { likes: 0, comments: 0, shares: 0, saves: 0, views: 0 },
    likedByMe: false,
    savedByMe: false,
    source: "supabase",
  };
}

describe("shouldPlayVideo", () => {
  it("plays only when active, focused, and app active", () => {
    expect(
      shouldPlayVideo({
        isActive: true,
        appState: "active",
        screenFocused: true,
      })
    ).toBe(true);
  });

  it("pauses when backgrounded even if active", () => {
    expect(
      shouldPlayVideo({
        isActive: true,
        appState: "background",
        screenFocused: true,
      })
    ).toBe(false);
  });

  it("pauses inactive cards", () => {
    expect(
      shouldPlayVideo({
        isActive: false,
        appState: "active",
        screenFocused: true,
      })
    ).toBe(false);
  });

  it("pauses when screen loses focus", () => {
    expect(
      shouldPlayVideo({
        isActive: true,
        appState: "active",
        screenFocused: false,
      })
    ).toBe(false);
  });
});

describe("shouldLoadPlayer", () => {
  it("loads current and adjacent only", () => {
    expect(shouldLoadPlayer(2, 2)).toBe(true);
    expect(shouldLoadPlayer(1, 2)).toBe(true);
    expect(shouldLoadPlayer(3, 2)).toBe(true);
    expect(shouldLoadPlayer(0, 2)).toBe(false);
    expect(shouldLoadPlayer(4, 2)).toBe(false);
  });
});

describe("mergeWatchVideos", () => {
  it("dedupes by video id", () => {
    const a = video("post-1", 1);
    const b = video("post-2", 2);
    const dup = video("post-1", 1);
    expect(mergeWatchVideos([a], [dup, b]).map((v) => v.id)).toEqual([
      "post-1",
      "post-2",
    ]);
  });
});

describe("watchItemKey", () => {
  it("prefers post id", () => {
    expect(watchItemKey(video("x", 7))).toBe("post-7");
    expect(watchItemKey(video("legacy"))).toBe("legacy");
  });
});

describe("sanitizePlaybackError", () => {
  it("never surfaces raw HTTP / storage errors", () => {
    expect(sanitizePlaybackError({ message: "HTTP 403 Forbidden" })).toBe(
      "Unable to play this video. Try again."
    );
    expect(
      sanitizePlaybackError({ message: "supabase storage signed url failed" })
    ).toBe("Unable to play this video. Try again.");
    expect(sanitizePlaybackError({ message: "Video unavailable" })).toBe(
      "Video unavailable"
    );
  });
});

describe("isLikelyExpiredPlaybackUrl", () => {
  it("detects expired / forbidden signatures", () => {
    expect(isLikelyExpiredPlaybackUrl("403 Forbidden")).toBe(true);
    expect(isLikelyExpiredPlaybackUrl("URL signature expired")).toBe(true);
    expect(isLikelyExpiredPlaybackUrl("codec unsupported")).toBe(false);
  });
});

describe("resolveMuteLabel", () => {
  it("reflects mute state", () => {
    expect(resolveMuteLabel(true)).toBe("Unmute video");
    expect(resolveMuteLabel(false)).toBe("Mute video");
  });
});

describe("expo-av Watch dependency", () => {
  it("package.json no longer lists expo-av; expo-video remains", async () => {
    const pkg = await import("../../../package.json");
    const deps = (pkg as { default?: { dependencies?: Record<string, string> } })
      .default?.dependencies ??
      (pkg as { dependencies?: Record<string, string> }).dependencies;
    expect(deps?.["expo-av"]).toBeUndefined();
    expect(deps?.["expo-video"]).toBeTruthy();
  });
});
