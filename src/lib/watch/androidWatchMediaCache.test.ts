import { describe, expect, it, vi } from "vitest";

vi.mock("expo-video", () => ({
  setVideoCacheSizeAsync: async () => undefined,
}));

import {
  ANDROID_WATCH_MAX_BUFFER_BYTES,
  ANDROID_WATCH_VIDEO_CACHE_BYTES,
  resolveAndroidWatchBufferOptions,
} from "./androidWatchMediaCache";

describe("resolveAndroidWatchBufferOptions", () => {
  it("bounds Android buffers and leaves iOS untouched", () => {
    const android = resolveAndroidWatchBufferOptions("android");
    expect(android?.preferredForwardBufferDuration).toBe(8);
    expect(android?.maxBufferBytes).toBe(ANDROID_WATCH_MAX_BUFFER_BYTES);
    expect(ANDROID_WATCH_VIDEO_CACHE_BYTES).toBe(192 * 1024 * 1024);
    expect(resolveAndroidWatchBufferOptions("ios")).toBeNull();
  });
});
