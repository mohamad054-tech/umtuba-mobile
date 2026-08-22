import { afterEach, describe, expect, it } from "vitest";

import { VIDEO_SIGNED_URL_TTL_SECONDS } from "@/src/contracts/video";

import {
  createSignedUrlCache,
  isSignedUrlFresh,
  SIGNED_URL_REFRESH_SKEW_SECONDS,
  watchSignedUrlCache,
} from "./signedUrlCache";

describe("signed URL cache", () => {
  afterEach(() => {
    watchSignedUrlCache.clear();
  });

  it("reuses a valid URL and refreshes near expiry", () => {
    const cache = createSignedUrlCache();
    const now = 1_000_000;
    cache.set("a/clip.mp4", "https://signed/a", now);
    expect(cache.peek("a/clip.mp4", now + 1_000)).toBe("https://signed/a");
    const almostExpired =
      now +
      (VIDEO_SIGNED_URL_TTL_SECONDS - SIGNED_URL_REFRESH_SKEW_SECONDS + 1) *
        1000;
    expect(cache.peek("a/clip.mp4", almostExpired)).toBeNull();
    expect(
      isSignedUrlFresh(
        { url: "https://x", expiresAtMs: now + 30_000 },
        now
      )
    ).toBe(false);
  });

  it("dedupes the same media path and stays bounded", () => {
    const cache = createSignedUrlCache(3);
    cache.set("a/1.mp4", "https://s/1");
    cache.set("a/1.mp4", "https://s/1b");
    expect(cache.size()).toBe(1);
    expect(cache.peek("a/1.mp4")).toBe("https://s/1b");
    cache.set("a/2.mp4", "https://s/2");
    cache.set("a/3.mp4", "https://s/3");
    cache.set("a/4.mp4", "https://s/4");
    expect(cache.size()).toBe(3);
    expect(cache.peek("a/1.mp4")).toBeNull();
  });

  it("invalidates after 403 / expiry recovery", () => {
    const cache = createSignedUrlCache();
    cache.set("a/clip.mp4", "https://expired");
    cache.invalidate("a/clip.mp4");
    expect(cache.peek("a/clip.mp4")).toBeNull();
  });
});
