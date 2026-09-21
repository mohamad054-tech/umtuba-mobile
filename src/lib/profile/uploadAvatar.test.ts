import { describe, expect, it, vi } from "vitest";

vi.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: vi.fn(),
  getMediaLibraryPermissionsAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
}));

vi.mock("@/src/lib/permissions/foundation", () => ({
  requestMediaLibraryPermission: vi.fn(),
}));

import {
  AVATARS_BUCKET,
  avatarStoragePath,
  MAX_AVATAR_BYTES,
  validateAvatarFile,
} from "./uploadAvatar";

describe("uploadAvatar contract", () => {
  it("uses the same website bucket and owner-prefixed path", () => {
    expect(AVATARS_BUCKET).toBe("avatars");
    const path = avatarStoragePath("user-1", "face.png");
    expect(path.startsWith("user-1/")).toBe(true);
    expect(path.endsWith(".png")).toBe(true);
  });

  it("rejects the same types and size the website rejects", () => {
    expect(
      validateAvatarFile({ mimeType: "image/jpeg", byteSize: 1200 })
    ).toEqual({ ok: true });
    expect(
      validateAvatarFile({ mimeType: "image/svg+xml", byteSize: 100 })
    ).toEqual({ ok: false, reason: "type" });
    expect(
      validateAvatarFile({
        mimeType: "image/png",
        byteSize: MAX_AVATAR_BYTES + 1,
      })
    ).toEqual({ ok: false, reason: "size" });
  });
});
