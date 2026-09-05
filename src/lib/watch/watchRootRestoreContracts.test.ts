import { describe, expect, it, vi } from "vitest";

vi.mock("expo-video", () => ({
  setVideoCacheSizeAsync: async () => undefined,
}));

import type { WatchVideo } from "@/src/contracts/watch";
import {
  ANDROID_WATCH_CACHE_TARGET,
  createMemoryWatchMediaCachePort,
  planAndroidWatchCacheWindow,
} from "./androidWatchMediaCache";
import {
  resolveMostVisibleWatchIndex,
  resolveWatchActiveIndexFromViewableItems,
  resolveWatchOwnedIndex,
  shouldPlayWithUserPause,
} from "./playbackPolicy";
import {
  createWatchActiveIndexArbiter,
  decideWatchActiveIndexClaim,
  decideWatchViewabilityEvidence,
} from "./watchActiveIndexArbiter";
import {
  shouldStartPlaybackAfterAsset,
  watchWindowPreparedIndexes,
} from "./playerLifecycle";
import {
  WATCH_DOUBLE_TAP_WINDOW_MS,
  createWatchTapClassifier,
  shouldTreatWatchPointerAsSwipe,
} from "./watchGestures";
import {
  inspectLocalWatchPlaybackFile,
  isolatePrefetchFailureFromActiveCell,
  resolveRetainedWatchPlaybackSrc,
  shouldEvictWatchDurableOldest,
} from "./watchRetainedPlaybackFallback";
import {
  watchShareDismissPreservesActiveItem,
  watchShareSheetRemountsWatch,
} from "@/src/lib/social/watchShareSheet";

const HTTPS = "https://cdn.example/1.mp4";
const FILE = "file:///cache/post-1.mp4";

function video(src = HTTPS): WatchVideo {
  return {
    id: "clip-1",
    postId: 1,
    src,
    title: "title-1",
    caption: "caption-1",
    location: { city: "Lagos", country: "NG" },
    music: "track",
    aiSummary: "",
    translation: "",
    author: { id: "creator-1", name: "Creator 1", username: "@c1", avatar: "C" },
    stats: { likes: 1, comments: 1, shares: 0, saves: 0, views: 10 },
    likedByMe: false,
    savedByMe: false,
    source: "supabase",
    durationMs: 12_000,
  };
}

describe("watch root restore contracts", () => {
  it("0→1 owns the native page, not the first listed viewable", () => {
    expect(
      resolveMostVisibleWatchIndex([
        { index: 0, isViewable: true, percentVisible: 18 },
        { index: 1, isViewable: true, percentVisible: 91 },
      ])
    ).toBe(1);
    expect(
      resolveWatchOwnedIndex({
        nativePage: 1,
        mostVisibleIndex: 0,
        currentIndex: 1,
        nativeOffsetKnown: true,
      })
    ).toBe(1);
    expect(
      resolveWatchOwnedIndex({
        nativePage: 0,
        mostVisibleIndex: 0,
        currentIndex: 1,
        nativeOffsetKnown: false,
      })
    ).toBe(1);
  });

  it("first manual 0→1 follows the first 80%-visible item", () => {
    expect(
      resolveWatchActiveIndexFromViewableItems({
        viewableIndexes: [1],
        nowMs: 1_000,
        lockUntilMs: 0,
      })
    ).toBe(1);
    expect(
      resolveWatchActiveIndexFromViewableItems({
        viewableIndexes: [1],
        nowMs: 1_000,
        lockUntilMs: 2_000,
      })
    ).toBeNull();
  });

  it("single tap pauses the active video and a second tap resumes it", () => {
    vi.useFakeTimers();
    let userPaused = false;
    const classifier = createWatchTapClassifier({ nowMs: () => Date.now() });
    const toggle = () => {
      userPaused = !userPaused;
    };
    classifier.tap({ onSingle: toggle, onDouble: () => undefined });
    vi.advanceTimersByTime(WATCH_DOUBLE_TAP_WINDOW_MS);
    expect(
      shouldPlayWithUserPause({
        feedShouldPlay: true,
        userPaused,
        isActive: true,
      })
    ).toBe(false);
    classifier.tap({ onSingle: toggle, onDouble: () => undefined });
    vi.advanceTimersByTime(WATCH_DOUBLE_TAP_WINDOW_MS);
    expect(
      shouldPlayWithUserPause({
        feedShouldPlay: true,
        userPaused,
        isActive: true,
      })
    ).toBe(true);
    vi.useRealTimers();
  });

  it("double-tap like does not toggle pause", () => {
    vi.useFakeTimers();
    let now = 8_000;
    const onSingle = vi.fn();
    const onDouble = vi.fn();
    const classifier = createWatchTapClassifier({ nowMs: () => now });
    classifier.tap({ onSingle, onDouble });
    now += 90;
    classifier.tap({ onSingle, onDouble });
    vi.advanceTimersByTime(WATCH_DOUBLE_TAP_WINDOW_MS + 20);
    expect(onDouble).toHaveBeenCalledTimes(1);
    expect(onSingle).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("swipe is not a tap", () => {
    expect(shouldTreatWatchPointerAsSwipe({ movedPx: 0 })).toBe(false);
    expect(shouldTreatWatchPointerAsSwipe({ movedPx: 24 })).toBe(true);
  });

  it("missing retained file falls back to HTTPS and is pruned", async () => {
    const port = createMemoryWatchMediaCachePort();
    const missing = await inspectLocalWatchPlaybackFile(port, FILE);
    expect(missing).toEqual({ usable: false, reason: "missing" });
    const resolved = await resolveRetainedWatchPlaybackSrc({
      video: video(HTTPS),
      retained: {
        postId: 1,
        videoId: "clip-1",
        mediaId: "post-1",
        localUri: FILE,
        remoteUri: HTTPS,
      },
      port,
    });
    expect(resolved.src).toBe(HTTPS);
    expect(resolved.usedLocal).toBe(false);
    expect(resolved.invalidated).toBe(true);
    expect(resolved.reason).toBe("missing-file");
  });

  it("zero-byte retained file falls back to HTTPS and is pruned", async () => {
    const port = createMemoryWatchMediaCachePort();
    port.files.set(FILE, "");
    const zero = await inspectLocalWatchPlaybackFile(port, FILE);
    expect(zero).toEqual({ usable: false, reason: "zero-byte" });
    const resolved = await resolveRetainedWatchPlaybackSrc({
      video: video(HTTPS),
      retained: {
        postId: 1,
        videoId: "clip-1",
        mediaId: "post-1",
        localUri: FILE,
        remoteUri: HTTPS,
      },
      port,
    });
    expect(resolved.src).toBe(HTTPS);
    expect(resolved.usedLocal).toBe(false);
    expect(resolved.invalidated).toBe(true);
    expect(resolved.reason).toBe("zero-byte");
  });

  it("valid retained file remains file://", async () => {
    const port = createMemoryWatchMediaCachePort();
    port.files.set(FILE, "payload-bytes");
    const resolved = await resolveRetainedWatchPlaybackSrc({
      video: video(HTTPS),
      retained: {
        postId: 1,
        videoId: "clip-1",
        mediaId: "post-1",
        localUri: FILE,
        remoteUri: HTTPS,
      },
      port,
    });
    expect(resolved.src).toBe(FILE);
    expect(resolved.usedLocal).toBe(true);
    expect(resolved.invalidated).toBe(false);
  });

  it("five retained videos stay in the rolling window", () => {
    const videos = [1, 2, 3, 4, 5, 6].map((n) => ({
      id: `v${n}`,
      postId: n,
      src: `https://cdn.example/${n}.mp4`,
    }));
    const plan = planAndroidWatchCacheWindow({
      videos,
      activeIndex: 0,
      target: ANDROID_WATCH_CACHE_TARGET,
    });
    expect(plan.target).toBe(5);
    expect(plan.keepIds).toHaveLength(5);
    expect(
      shouldEvictWatchDurableOldest({
        retainedCountBefore: 5,
        incomingIsNew: true,
        incomingStored: true,
        target: 5,
      })
    ).toBe(true);
  });

  it("cache isolation cannot write activeIndex or claim the player", () => {
    let activeIndex = 2;
    const plan = planAndroidWatchCacheWindow({
      videos: [1, 2, 3, 4].map((n) => ({
        id: `v${n}`,
        postId: n,
        src: `https://cdn.example/${n}.mp4`,
      })),
      activeIndex,
    });
    expect(activeIndex).toBe(2);
    expect(plan.keepIds.length).toBeGreaterThan(0);
    const isolated = isolatePrefetchFailureFromActiveCell({
      failedMediaId: "prefetch",
      activeMediaId: "post-3",
      activeSrc: HTTPS,
      activeError: null,
    });
    expect(isolated.src).toBe(HTTPS);
    expect(isolated.displayError).toBe(false);
    expect(activeIndex).toBe(2);
  });

  it("Share/Cancel preserves the current video", () => {
    expect(watchShareSheetRemountsWatch()).toBe(false);
    expect(watchShareDismissPreservesActiveItem()).toBe(true);
  });

  it("back swipe keeps the previous item in the prepare window", () => {
    expect(watchWindowPreparedIndexes(2, 5, "android")).toEqual([1, 2, 3]);
    expect(watchWindowPreparedIndexes(1, 5, "android")).toEqual([0, 1, 2]);
    expect(
      shouldStartPlaybackAfterAsset({
        nativeReady: true,
        jsReady: true,
        isActive: true,
        shouldPlay: true,
        playerAlive: true,
        ownerGeneration: 4,
        commandGeneration: 4,
        surfaceAttached: true,
      })
    ).toBe(true);
    expect(
      shouldStartPlaybackAfterAsset({
        nativeReady: true,
        jsReady: true,
        isActive: true,
        shouldPlay: true,
        playerAlive: true,
        ownerGeneration: 4,
        commandGeneration: 4,
        surfaceAttached: false,
      })
    ).toBe(false);
  });

  it("off-screen first-frame does not authorize audio", () => {
    expect(
      shouldStartPlaybackAfterAsset({
        nativeReady: true,
        jsReady: true,
        isActive: false,
        shouldPlay: true,
        playerAlive: true,
        ownerGeneration: 2,
        commandGeneration: 2,
        surfaceAttached: true,
      })
    ).toBe(false);
    expect(
      shouldStartPlaybackAfterAsset({
        nativeReady: true,
        jsReady: true,
        isActive: true,
        shouldPlay: true,
        playerAlive: true,
        ownerGeneration: 2,
        commandGeneration: 2,
        surfaceAttached: false,
      })
    ).toBe(false);
  });

  it("delayed viewability cannot revert settled page 1 to 0", () => {
    let arbiter = createWatchActiveIndexArbiter();
    arbiter = decideWatchActiveIndexClaim({
      arbiter,
      reason: "bootstrap",
      requestedIndex: 0,
      navigationGeneration: 0,
    }).next;
    arbiter = decideWatchActiveIndexClaim({
      arbiter,
      reason: "handoff-commit",
      requestedIndex: 1,
      navigationGeneration: arbiter.navigationGeneration,
      nativeSettledPage: 1,
    }).next;
    expect(decideWatchViewabilityEvidence().mayClaimActiveIndex).toBe(false);
    expect(
      decideWatchActiveIndexClaim({
        arbiter,
        reason: "bootstrap",
        requestedIndex: 0,
        navigationGeneration: arbiter.navigationGeneration,
      }).accept
    ).toBe(false);
    expect(arbiter.activeIndex).toBe(1);
  });

  it("ready/status cannot override a user pause latch", () => {
    expect(
      shouldPlayWithUserPause({
        feedShouldPlay: true,
        userPaused: true,
        isActive: true,
      })
    ).toBe(false);
    expect(
      shouldStartPlaybackAfterAsset({
        nativeReady: true,
        jsReady: true,
        isActive: true,
        shouldPlay: false,
        playerAlive: true,
        ownerGeneration: 3,
        commandGeneration: 3,
        surfaceAttached: true,
      })
    ).toBe(false);
  });
});
