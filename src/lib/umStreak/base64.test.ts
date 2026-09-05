import { describe, expect, it } from "vitest";

import { decodeBase64ToArrayBuffer } from "./base64";

describe("decodeBase64ToArrayBuffer", () => {
  it("decodes a padded ASCII payload", () => {
    const bytes = new Uint8Array(decodeBase64ToArrayBuffer("aGVsbG8="));
    expect(Array.from(bytes)).toEqual([104, 101, 108, 108, 111]);
  });

  it("decodes an unpadded JPEG-like triplet", () => {
    const bytes = new Uint8Array(decodeBase64ToArrayBuffer("/9j/"));
    expect(bytes.byteLength).toBe(3);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    expect(bytes[2]).toBe(0xff);
  });

  it("returns empty for blank input", () => {
    expect(decodeBase64ToArrayBuffer("").byteLength).toBe(0);
  });
});
