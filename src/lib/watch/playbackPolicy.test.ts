import { describe, expect, it } from "vitest";

import type { WatchVideo } from "@/src/contracts/watch";
import {
  DEFAULT_WATCH_AUTO_NEXT,
  DEFAULT_WATCH_MUTED,
  DEFAULT_WATCH_VOLUME,
  formatPlaybackClock,
  isLikelyExpiredPlaybackUrl,
  mergeWatchVideos,
  parseWatchAutoNextPreference,
  parseWatchMutedPreference,
  parseWatchVolumePreference,
  resolveAutoNextButtonText,
  resolveEffectiveAudio,
  resolveMuteButtonText,
  resolveMuteLabel,
  resolveNextWatchIndex,
  resolvePlayPauseFeedbackLabel,
  resolveProgressRatio,
  resolveSeekTime,
  sanitizePlaybackError,
  serializeWatchAutoNextPreference,
  serializeWatchMutedPreference,
  serializeWatchVolumePreference,
  shouldLoadPlayer,
  shouldLoopCurrentVideo,
  shouldPlayVideo,
  shouldPlayWithUserPause,
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

describe("watch mute preference", () => {
  it("defaults to unmuted when unset", () => {
    expect(DEFAULT_WATCH_MUTED).toBe(false);
    expect(parseWatchMutedPreference(null)).toBe(false);
    expect(parseWatchMutedPreference(undefined)).toBe(false);
  });

  it("round-trips muted preference strings", () => {
    expect(parseWatchMutedPreference("1")).toBe(true);
    expect(parseWatchMutedPreference("0")).toBe(false);
    expect(serializeWatchMutedPreference(true)).toBe("1");
    expect(serializeWatchMutedPreference(false)).toBe("0");
  });
});

describe("watch volume preference", () => {
  it("defaults to full in-app volume", () => {
    expect(DEFAULT_WATCH_VOLUME).toBe(1);
    expect(parseWatchVolumePreference(null)).toBe(1);
  });

  it("clamps and serializes volume", () => {
    expect(parseWatchVolumePreference("0.42")).toBe(0.42);
    expect(parseWatchVolumePreference("2")).toBe(1);
    expect(parseWatchVolumePreference("-1")).toBe(0);
    expect(serializeWatchVolumePreference(0.5)).toBe("0.5");
  });
});

describe("auto-next preference and end-of-clip policy", () => {
  it("defaults to auto-next enabled", () => {
    expect(DEFAULT_WATCH_AUTO_NEXT).toBe(true);
    expect(parseWatchAutoNextPreference(null)).toBe(true);
    expect(serializeWatchAutoNextPreference(false)).toBe("0");
  });

  it("loops when auto-next is off or on the last item", () => {
    expect(shouldLoopCurrentVideo({ autoNext: false, isLastItem: false })).toBe(
      true
    );
    expect(shouldLoopCurrentVideo({ autoNext: true, isLastItem: true })).toBe(
      true
    );
    expect(shouldLoopCurrentVideo({ autoNext: true, isLastItem: false })).toBe(
      false
    );
  });

  it("advances only when a next item exists", () => {
    expect(
      resolveNextWatchIndex({
        autoNext: true,
        activeIndex: 1,
        itemCount: 3,
      })
    ).toBe(2);
    expect(
      resolveNextWatchIndex({
        autoNext: true,
        activeIndex: 2,
        itemCount: 3,
      })
    ).toBeNull();
    expect(
      resolveNextWatchIndex({
        autoNext: false,
        activeIndex: 0,
        itemCount: 3,
      })
    ).toBeNull();
    expect(
      resolveNextWatchIndex({
        autoNext: true,
        activeIndex: 0,
        itemCount: 0,
      })
    ).toBeNull();
  });

  it("labels auto-next control", () => {
    expect(resolveAutoNextButtonText(true)).toBe("Auto-next on");
    expect(resolveAutoNextButtonText(false)).toBe("Auto-next off");
  });
});

describe("progress and play/pause helpers", () => {
  it("clamps progress ratio and seek time", () => {
    expect(resolveProgressRatio(5, 10)).toBe(0.5);
    expect(resolveProgressRatio(-1, 10)).toBe(0);
    expect(resolveProgressRatio(20, 10)).toBe(1);
    expect(resolveProgressRatio(1, 0)).toBe(0);
    expect(resolveSeekTime(0.25, 40)).toBe(10);
    expect(resolveSeekTime(2, 40)).toBe(40);
  });

  it("formats playback clock", () => {
    expect(formatPlaybackClock(0)).toBe("0:00");
    expect(formatPlaybackClock(65)).toBe("1:05");
    expect(formatPlaybackClock(3661)).toBe("1:01:01");
  });

  it("silences inactive cards without changing user mute preference semantics", () => {
    expect(
      resolveEffectiveAudio({ isActive: true, muted: false, volume: 0.7 })
    ).toEqual({ muted: false, volume: 0.7 });
    expect(
      resolveEffectiveAudio({ isActive: false, muted: false, volume: 0.7 })
    ).toEqual({ muted: true, volume: 0 });
  });

  it("combines feed autoplay with user pause", () => {
    expect(
      shouldPlayWithUserPause({
        feedShouldPlay: true,
        userPaused: false,
        isActive: true,
      })
    ).toBe(true);
    expect(
      shouldPlayWithUserPause({
        feedShouldPlay: true,
        userPaused: true,
        isActive: true,
      })
    ).toBe(false);
    expect(
      shouldPlayWithUserPause({
        feedShouldPlay: true,
        userPaused: true,
        isActive: false,
      })
    ).toBe(false);
  });

  it("labels play/pause feedback", () => {
    expect(resolvePlayPauseFeedbackLabel(true)).toBe("Paused");
    expect(resolvePlayPauseFeedbackLabel(false)).toBe("Playing");
    expect(resolveMuteButtonText(true)).toBe("Unmute");
    expect(resolveMuteButtonText(false)).toBe("Mute");
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
