import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-image-picker", () => ({
  getMediaLibraryPermissionsAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
  requestCameraPermissionsAsync: vi.fn(),
}));

vi.mock("expo-notifications", () => ({
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  IosAuthorizationStatus: { PROVISIONAL: "provisional" },
}));

import * as ImagePicker from "expo-image-picker";
import {
  inspectMediaLibraryPermission,
  requestMediaLibraryPermission,
} from "@/src/lib/permissions/foundation";

describe("media library permission inspect vs request", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("inspects current accessPrivileges without prompting", async () => {
    vi.mocked(ImagePicker.getMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: "granted",
      expires: "never",
      accessPrivileges: "limited",
    } as never);

    const outcome = await inspectMediaLibraryPermission();
    expect(outcome).toMatchObject({
      kind: "mediaLibrary",
      granted: true,
      accessPrivileges: "limited",
    });
    expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  });

  it("request still prompts only when a grant is missing", async () => {
    vi.mocked(ImagePicker.getMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: true,
      status: "undetermined",
      expires: "never",
      accessPrivileges: "none",
    } as never);
    vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: "granted",
      expires: "never",
      accessPrivileges: "all",
    } as never);

    const outcome = await requestMediaLibraryPermission();
    expect(outcome.accessPrivileges).toBe("all");
    expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(
      1
    );
  });
});
