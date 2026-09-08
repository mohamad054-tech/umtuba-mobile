import { describe, expect, it } from "vitest";

import {
  watchEnginePlayerSource,
  watchEngineSrcSignature,
} from "./playerSource";

describe("watchEnginePlayerSource", () => {
  it("disables Expo cache for retained local files", () => {
    expect(
      watchEnginePlayerSource("file:///data/user/0/com.umtuba.app/cache/a.mp4")
    ).toEqual({
      uri: "file:///data/user/0/com.umtuba.app/cache/a.mp4",
      useCaching: false,
    });
  });

  it("keeps remote HTTPS cacheable", () => {
    expect(
      watchEnginePlayerSource("https://cdn.example/watch/post-1.mp4")
    ).toEqual({
      uri: "https://cdn.example/watch/post-1.mp4",
      useCaching: true,
    });
  });
});

describe("watchEngineSrcSignature", () => {
  it("changes when a resolved src arrives", () => {
    const before = watchEngineSrcSignature([{ id: "a", src: "" }]);
    const after = watchEngineSrcSignature([
      { id: "a", src: "https://cdn.example/a.mp4" },
    ]);
    expect(before).not.toBe(after);
  });
});
