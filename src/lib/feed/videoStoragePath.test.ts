import { describe, expect, it } from "vitest";

import {
  isPlayableWatchSrc,
  normalizeVideoStoragePath,
  shouldMountWatchPlayer,
} from "./videoStoragePath";

describe("normalizeVideoStoragePath", () => {
  it("accepts the owned object path used at publish", () => {
    expect(normalizeVideoStoragePath("user-1/clip.mp4")).toEqual({
      ok: true,
      path: "user-1/clip.mp4",
    });
  });

  it("strips a leading slash that would 403 Storage sign", () => {
    expect(normalizeVideoStoragePath("/user-1/clip.mp4")).toEqual({
      ok: true,
      path: "user-1/clip.mp4",
    });
  });

  it("strips a repeated bucket prefix", () => {
    expect(normalizeVideoStoragePath("post-videos/user-1/clip.mp4")).toEqual({
      ok: true,
      path: "user-1/clip.mp4",
    });
  });

  it("rejects traversal, backslashes, query strings, and URLs", () => {
    expect(normalizeVideoStoragePath("../secret.mp4").ok).toBe(false);
    expect(normalizeVideoStoragePath("user\\clip.mp4").ok).toBe(false);
    expect(normalizeVideoStoragePath("user/clip.mp4?token=x").ok).toBe(false);
    const asUrl = normalizeVideoStoragePath("https://example.com/clip.mp4");
    expect(asUrl.ok).toBe(false);
    if (!asUrl.ok) expect(asUrl.reason).toBe("not-object-path");
    expect(normalizeVideoStoragePath("").ok).toBe(false);
  });
});

describe("shouldMountWatchPlayer", () => {
  it("does not create a VideoAsset until a playable URL exists", () => {
    expect(
      shouldMountWatchPlayer({ shouldLoadPlayer: true, src: "" })
    ).toBe(false);
    expect(
      shouldMountWatchPlayer({
        shouldLoadPlayer: true,
        src: "https://signed.example/v.mp4",
      })
    ).toBe(true);
    expect(
      shouldMountWatchPlayer({
        shouldLoadPlayer: false,
        src: "https://signed.example/v.mp4",
      })
    ).toBe(false);
  });

  it("is not a 10-player model — mount still requires the platform load window", () => {
    const srcs = Array.from({ length: 10 }, (_, i) => ({
      shouldLoadPlayer: i <= 1,
      src: `https://signed.example/${i}.mp4`,
    }));
    expect(srcs.filter((item) => shouldMountWatchPlayer(item))).toHaveLength(2);
    expect(isPlayableWatchSrc("https://x/y")).toBe(true);
    expect(isPlayableWatchSrc("")).toBe(false);
  });
});
