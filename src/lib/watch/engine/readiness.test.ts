import { describe, expect, it } from "vitest";

import { watchEnginePlayerSource, watchEnginePlayerSourceEquals } from "./playerSource";
import {
  resolveWatchEngineItemSource,
  resolveWatchEngineReadiness,
  shouldRecreateWatchEnginePlayer,
  shouldStartWatchEnginePlayback,
  watchEngineItemSourceUri,
} from "./readiness";

describe("resolveWatchEngineReadiness", () => {
  it("stays blocked until a playable source is bound to a surface", () => {
    expect(
      resolveWatchEngineReadiness({
        sourcePlayable: false,
        surfaceAttached: false,
        firstFrameReady: false,
      })
    ).toBe("blocked");
    expect(
      resolveWatchEngineReadiness({
        sourcePlayable: true,
        surfaceAttached: false,
        firstFrameReady: false,
      })
    ).toBe("blocked");
  });

  it("moves blocked → ready-buffered → ready-to-render", () => {
    expect(
      resolveWatchEngineReadiness({
        sourcePlayable: true,
        surfaceAttached: true,
        firstFrameReady: false,
      })
    ).toBe("ready-buffered");
    expect(
      resolveWatchEngineReadiness({
        sourcePlayable: true,
        surfaceAttached: true,
        firstFrameReady: true,
      })
    ).toBe("ready-to-render");
  });
});

describe("shouldStartWatchEnginePlayback", () => {
  it("does not start before the active surface is attached", () => {
    expect(
      shouldStartWatchEnginePlayback({
        wantsPlay: true,
        sourcePlayable: true,
        surfaceAttached: false,
      })
    ).toBe(false);
    expect(
      shouldStartWatchEnginePlayback({
        wantsPlay: true,
        sourcePlayable: true,
        surfaceAttached: true,
      })
    ).toBe(true);
  });
});

describe("shouldRecreateWatchEnginePlayer", () => {
  it("does not recreate for the same media identity and src", () => {
    expect(
      shouldRecreateWatchEnginePlayer({
        previousMediaId: "post-1",
        nextMediaId: "post-1",
        previousSrc: "https://cdn.example/a.mp4",
        nextSrc: "https://cdn.example/a.mp4",
      })
    ).toBe(false);
  });

  it("recreates only when identity or src actually changes", () => {
    expect(
      shouldRecreateWatchEnginePlayer({
        previousMediaId: "post-1",
        nextMediaId: "post-2",
        previousSrc: "https://cdn.example/a.mp4",
        nextSrc: "https://cdn.example/a.mp4",
      })
    ).toBe(true);
    expect(
      shouldRecreateWatchEnginePlayer({
        previousMediaId: "post-1",
        nextMediaId: "post-1",
        previousSrc: "https://cdn.example/a.mp4",
        nextSrc: "file:///cache/a.mp4",
      })
    ).toBe(true);
  });
});

describe("watchEnginePlayerSource identity", () => {
  it("treats equal uri objects as the same player source", () => {
    const first = watchEnginePlayerSource("https://cdn.example/a.mp4");
    const second = watchEnginePlayerSource("https://cdn.example/a.mp4");
    expect(first).not.toBe(second);
    expect(watchEnginePlayerSourceEquals(first, second)).toBe(true);
  });
});

describe("resolveWatchEngineItemSource", () => {
  it("resolves a remote src to a playable uri", () => {
    const next = resolveWatchEngineItemSource({
      mediaId: "post-1",
      src: "https://cdn.example/a.mp4",
    });
    expect(next.kind).toBe("remote");
    expect(watchEngineItemSourceUri({ mediaId: "post-1", src: next.uri })).toBe(
      next.uri
    );
  });

  it("does not mount an empty or unresolved src", () => {
    expect(
      watchEngineItemSourceUri({ mediaId: "post-1", src: "" })
    ).toBeNull();
  });
});
