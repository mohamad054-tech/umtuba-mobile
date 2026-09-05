import { describe, expect, it } from "vitest";

import { inferMessageMediaMime } from "./media";

describe("inferMessageMediaMime", () => {
  it("normalizes image/jpg to the allowed image/jpeg contract", () => {
    expect(
      inferMessageMediaMime({
        mimeType: "image/jpg",
        fileName: "cam.jpg",
        uri: "file:///cache/cam.jpg",
        mediaType: "image",
      })
    ).toBe("image/jpeg");
  });
});
