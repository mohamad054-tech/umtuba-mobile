import { describe, expect, it } from "vitest";

import {
  resolveWatchEngineSource,
  shouldReplaceWatchEngineSource,
  watchEngineSourceIsPlayable,
} from "./sourceResolver";

const RETAINED = {
  uri: "file:///cache/a.mp4",
  exists: true,
  bytes: 4096,
  complete: true,
};

describe("resolveWatchEngineSource", () => {
  it("uses a valid retained local file first", () => {
    const next = resolveWatchEngineSource({
      mediaId: "post-1",
      retained: RETAINED,
      remoteUrl: "https://cdn.example/a.mp4",
    });
    expect(next.kind).toBe("local-retained");
    expect(next.uri).toBe(RETAINED.uri);
  });

  it("uses forward-cache local when retained is gone", () => {
    const next = resolveWatchEngineSource({
      mediaId: "post-1",
      retained: { ...RETAINED, exists: false, bytes: 0 },
      forwardCache: RETAINED,
      remoteUrl: "https://cdn.example/a.mp4",
    });
    expect(next.kind).toBe("local-forward");
  });

  it("falls back to a current remote after eviction", () => {
    const next = resolveWatchEngineSource({
      mediaId: "post-1",
      retained: { uri: "file:///gone.mp4", exists: false, bytes: 0, complete: false },
      remoteUrl: "https://cdn.example/a.mp4",
    });
    expect(next.kind).toBe("remote");
    expect(next.uri).toBe("https://cdn.example/a.mp4");
    expect(watchEngineSourceIsPlayable(next)).toBe(true);
  });

  it("never returns a deleted, zero-byte, or partial local URI", () => {
    for (const retained of [
      { uri: "file:///missing.mp4", exists: false, bytes: 12, complete: true },
      { uri: "file:///zero.mp4", exists: true, bytes: 0, complete: true },
      { uri: "file:///part.mp4", exists: true, bytes: 12, complete: false },
    ]) {
      const next = resolveWatchEngineSource({
        mediaId: "post-1",
        retained,
        remoteUrl: "https://cdn.example/a.mp4",
      });
      expect(next.uri.startsWith("file://")).toBe(false);
      expect(next.kind).toBe("remote");
    }
  });

  it("asks for a refresh when the signed remote expired", () => {
    const next = resolveWatchEngineSource({
      mediaId: "post-1",
      remoteUrl: "https://cdn.example/expired.mp4",
      remoteExpired: true,
    });
    expect(next.kind).toBe("unresolved");
    expect(next.needsRefresh).toBe(true);
    expect(next.rejected).toBe("stale-remote");
    expect(next.uri).toBe("");
  });

  it("replaces a stale file URI with a recovered remote", () => {
    expect(
      shouldReplaceWatchEngineSource({
        currentUri: "file:///deleted.mp4",
        next: resolveWatchEngineSource({
          mediaId: "post-1",
          remoteUrl: "https://cdn.example/a.mp4",
        }),
      })
    ).toBe(true);
  });
});
