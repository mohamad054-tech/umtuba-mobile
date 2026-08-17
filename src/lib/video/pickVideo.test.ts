import { afterEach, describe, expect, it, vi } from "vitest";

const getInfoAsync = vi.fn();

vi.mock("expo-file-system/legacy", () => ({
  getInfoAsync: (...args: unknown[]) => getInfoAsync(...args),
}));

vi.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: vi.fn(),
  launchCameraAsync: vi.fn(),
  getMediaLibraryPermissionsAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
  requestCameraPermissionsAsync: vi.fn(),
  getCameraPermissionsAsync: vi.fn(),
}));

vi.mock("expo-media-library", () => ({
  presentPermissionsPicker: vi.fn(async () => undefined),
  presentPermissionsPickerAsync: vi.fn(async () => undefined),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  Linking: { openSettings: vi.fn(async () => undefined) },
}));

vi.mock("@/src/lib/permissions/foundation", () => ({
  inspectMediaLibraryPermission: vi.fn(async () => ({
    kind: "mediaLibrary",
    granted: true,
    canAskAgain: true,
    explanation: "test",
    accessPrivileges: "all",
  })),
  requestMediaLibraryPermission: vi.fn(async () => ({
    kind: "mediaLibrary",
    granted: true,
    canAskAgain: true,
    explanation: "test",
    accessPrivileges: "all",
  })),
}));

import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { Linking, Platform } from "react-native";
import {
  inspectMediaLibraryPermission,
  requestMediaLibraryPermission,
} from "@/src/lib/permissions/foundation";
import {
  classifyLibraryAccess,
  DENIED_LIBRARY_ACCESS_MESSAGE,
  expandLimitedVideoLibraryAccess,
  formatPickedDurationSecondsLabel,
  inferPickedVideoMimeType,
  libraryAccessMessage,
  LIMITED_LIBRARY_ACCESS_MESSAGE,
  mediaLibraryGrantRequiredForPicker,
  pickerDurationToMs,
  pickVideoFromLibrary,
  resolvePickedVideoByteSize,
  shouldBlockVideoLibraryPicker,
  VIDEO_LIBRARY_PICKER_OPTIONS,
} from "@/src/lib/video/pickVideo";

describe("inferPickedVideoMimeType", () => {
  it("keeps allowed MIME from the picker", () => {
    expect(
      inferPickedVideoMimeType({
        mimeType: "video/webm",
        fileName: "clip.bin",
        uri: "content://media/external/video/media/42",
      })
    ).toBe("video/webm");
  });

  it("infers from filename when MIME is empty", () => {
    expect(
      inferPickedVideoMimeType({
        mimeType: "",
        fileName: "holiday.mov",
        uri: "file:///tmp/holiday.mov",
      })
    ).toBe("video/quicktime");
  });

  it("defaults Android content:// videos without MIME/extension to mp4", () => {
    expect(
      inferPickedVideoMimeType({
        mimeType: null,
        fileName: null,
        uri: "content://com.android.providers.media.documents/document/video%3A1001",
      })
    ).toBe("video/mp4");
  });

  it("defaults application/octet-stream content URIs to mp4", () => {
    expect(
      inferPickedVideoMimeType({
        mimeType: "application/octet-stream",
        fileName: "1001",
        uri: "content://media/external/video/media/1001",
      })
    ).toBe("video/mp4");
  });

  it("leaves unsupported video/* for validateVideoFile to reject", () => {
    expect(
      inferPickedVideoMimeType({
        mimeType: "video/3gpp",
        fileName: "old.3gp",
        uri: "content://media/external/video/media/9",
      })
    ).toBe("video/3gpp");
  });

  it("leaves non-video MIME for validateVideoFile to reject", () => {
    expect(
      inferPickedVideoMimeType({
        mimeType: "image/jpeg",
        fileName: "photo.jpg",
        uri: "content://media/external/images/media/1",
      })
    ).toBe("image/jpeg");
  });
});

describe("resolvePickedVideoByteSize", () => {
  afterEach(() => {
    getInfoAsync.mockReset();
    vi.unstubAllGlobals();
  });

  it("uses reported ImagePicker fileSize when present", async () => {
    await expect(
      resolvePickedVideoByteSize({
        uri: "content://media/external/video/media/1",
        reportedSize: 2_048_000,
      })
    ).resolves.toBe(2_048_000);
    expect(getInfoAsync).not.toHaveBeenCalled();
  });

  it("does not reject missing fileSize — probes FileSystem instead", async () => {
    getInfoAsync.mockResolvedValue({
      exists: true,
      uri: "content://media/external/video/media/1",
      size: 1_500_000,
      isDirectory: false,
      modificationTime: 0,
    });

    await expect(
      resolvePickedVideoByteSize({
        uri: "content://media/external/video/media/1",
        reportedSize: undefined,
      })
    ).resolves.toBe(1_500_000);
  });

  it("falls back to fetch blob size when FileSystem has no size", async () => {
    getInfoAsync.mockResolvedValue({
      exists: false,
      uri: "content://media/external/video/media/1",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        blob: async () => ({ size: 900_000 }),
      }))
    );

    await expect(
      resolvePickedVideoByteSize({
        uri: "content://media/external/video/media/1",
        reportedSize: 0,
      })
    ).resolves.toBe(900_000);
  });

  it("returns null only after all probes fail", async () => {
    getInfoAsync.mockRejectedValue(new Error("unsupported"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      })
    );

    await expect(
      resolvePickedVideoByteSize({
        uri: "content://media/external/video/media/1",
        reportedSize: null,
      })
    ).resolves.toBeNull();
  });
});

describe("pickVideoFromLibrary (Android content://)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    getInfoAsync.mockReset();
    vi.unstubAllGlobals();
  });

  it("does not multiply iOS millisecond duration into 8200s", async () => {
    vi.mocked(inspectMediaLibraryPermission).mockResolvedValue({
      kind: "mediaLibrary",
      granted: true,
      canAskAgain: true,
      explanation: "test",
      accessPrivileges: "all",
    });
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///tmp/IMG_0008.MOV",
          fileName: "IMG_0008.MOV",
          mimeType: "video/quicktime",
          fileSize: 9.5 * 1024 * 1024,
          duration: 8200,
          width: 1920,
          height: 1080,
        },
      ],
    } as never);

    const result = await pickVideoFromLibrary();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.asset.durationMs).toBe(8200);
      expect(formatPickedDurationSecondsLabel(result.asset.durationMs!)).toBe(
        "8s"
      );
    }
  });

  it("persists a content:// selection with missing fileSize and MIME", async () => {
    vi.mocked(inspectMediaLibraryPermission).mockResolvedValue({
      kind: "mediaLibrary",
      granted: false,
      canAskAgain: true,
      explanation: "test",
      accessPrivileges: "none",
    });
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "content://media/external/video/media/55",
          fileName: null,
          mimeType: null,
          fileSize: undefined,
          duration: 12.5,
          width: 1080,
          height: 1920,
        },
      ],
    } as never);
    getInfoAsync.mockResolvedValue({
      exists: true,
      uri: "content://media/external/video/media/55",
      size: 3_200_000,
      isDirectory: false,
      modificationTime: 0,
    });

    const result = await pickVideoFromLibrary();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.asset.id).toEqual(expect.any(String));
      expect(result.asset).toMatchObject({
        uri: "content://media/external/video/media/55",
        fileName: "video.mp4",
        mimeType: "video/mp4",
        byteSize: 3_200_000,
        durationMs: 12500,
        width: 1080,
        height: 1920,
      });
    }
  });

  it("rejects invalid duration and exposes the rejected clip label", async () => {
    vi.mocked(inspectMediaLibraryPermission).mockResolvedValue({
      kind: "mediaLibrary",
      granted: true,
      canAskAgain: true,
      explanation: "test",
      accessPrivileges: "all",
    });
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "content://media/external/video/media/12",
          fileName: "zero.mp4",
          mimeType: "video/mp4",
          fileSize: 1_000_000,
          duration: 0,
          width: 1,
          height: 1,
        },
      ],
    } as never);

    const result = await pickVideoFromLibrary();
    expect(result.ok).toBe(false);
    if (!result.ok && !result.cancelled) {
      expect(result.message).toMatch(/duration/i);
      expect(result.rejected?.fileName).toBe("zero.mp4");
    }
  });

  it("still enforces the 50 MB limit after size resolution", async () => {
    vi.mocked(inspectMediaLibraryPermission).mockResolvedValue({
      kind: "mediaLibrary",
      granted: true,
      canAskAgain: true,
      explanation: "test",
      accessPrivileges: "all",
    });
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "content://media/external/video/media/99",
          fileName: "huge.mp4",
          mimeType: "video/mp4",
          fileSize: undefined,
          duration: 30,
          width: 1,
          height: 1,
        },
      ],
    } as never);
    getInfoAsync.mockResolvedValue({
      exists: true,
      uri: "content://media/external/video/media/99",
      size: 51 * 1024 * 1024,
      isDirectory: false,
      modificationTime: 0,
    });

    const result = await pickVideoFromLibrary();
    expect(result.ok).toBe(false);
    if (!result.ok && !result.cancelled) {
      expect(result.message).toMatch(/50 MB/i);
      expect(result.rejected?.fileName).toBe("huge.mp4");
      expect(result.rejected?.byteSize).toBe(51 * 1024 * 1024);
    }
  });

  it("returns a visible failure message when size cannot be resolved", async () => {
    vi.mocked(inspectMediaLibraryPermission).mockResolvedValue({
      kind: "mediaLibrary",
      granted: true,
      canAskAgain: true,
      explanation: "test",
      accessPrivileges: "all",
    });
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "content://media/external/video/media/7",
          fileName: null,
          mimeType: null,
          fileSize: undefined,
        },
      ],
    } as never);
    getInfoAsync.mockResolvedValue({
      exists: false,
      uri: "content://media/external/video/media/7",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("nope");
      })
    );

    const result = await pickVideoFromLibrary();
    expect(result.ok).toBe(false);
    if (!result.ok && !result.cancelled) {
      expect(result.message).toBe(
        "Could not determine the video file size after selection. Try another clip or re-export the file."
      );
      expect(result.rejected?.uri).toBe(
        "content://media/external/video/media/7"
      );
    }
  });
});

describe("pickerDurationToMs", () => {
  it("keeps ImagePicker millisecond values (IMG_0008.MOV 8200 → 8s)", () => {
    expect(pickerDurationToMs(8200)).toBe(8200);
    expect(formatPickedDurationSecondsLabel(8200)).toBe("8s");
    expect(formatPickedDurationSecondsLabel(pickerDurationToMs(8200)!)).not.toBe(
      "8200s"
    );
  });

  it("still treats sub-1000 values as seconds for legacy Android mocks", () => {
    expect(pickerDurationToMs(12.5)).toBe(12500);
    expect(pickerDurationToMs(30)).toBe(30000);
    expect(formatPickedDurationSecondsLabel(12500)).toBe("13s");
  });

  it("maps non-positive picker duration to 0 so Create can reject it", () => {
    expect(pickerDurationToMs(0)).toBe(0);
    expect(pickerDurationToMs(-4)).toBe(0);
    expect(pickerDurationToMs(Number.NaN)).toBe(0);
  });
});

describe("TEST_8 iOS picker adapter", () => {
  afterEach(() => {
    vi.clearAllMocks();
    (Platform as { OS: string }).OS = "android";
  });

  it("does not require a prior media grant on either platform", async () => {
    expect(mediaLibraryGrantRequiredForPicker("ios")).toBe(false);
    expect(mediaLibraryGrantRequiredForPicker("android")).toBe(false);

    vi.mocked(inspectMediaLibraryPermission).mockResolvedValue({
      kind: "mediaLibrary",
      granted: false,
      canAskAgain: true,
      explanation: "undetermined",
      accessPrivileges: "none",
    });

    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: true,
      assets: [],
    } as never);

    const cancelled = await pickVideoFromLibrary();
    expect(cancelled).toEqual({
      ok: false,
      cancelled: true,
      access: "not_required",
    });
    expect(requestMediaLibraryPermission).not.toHaveBeenCalled();
  });

  it("keeps iOS millisecond duration on the shared Create contract", () => {
    expect(pickerDurationToMs(8200)).toBe(8200);
    expect(formatPickedDurationSecondsLabel(8200)).toBe("8s");
  });
});

describe("full video library picker access", () => {
  afterEach(() => {
    vi.clearAllMocks();
    (Platform as { OS: string }).OS = "android";
  });

  it("classifies limited / denied / undetermined access truthfully", () => {
    expect(
      classifyLibraryAccess({
        granted: true,
        canAskAgain: true,
        accessPrivileges: "limited",
        os: "ios",
      })
    ).toBe("limited");
    expect(
      classifyLibraryAccess({
        granted: false,
        canAskAgain: false,
        accessPrivileges: "none",
        os: "ios",
      })
    ).toBe("denied");
    expect(
      classifyLibraryAccess({
        granted: false,
        canAskAgain: true,
        accessPrivileges: "none",
        os: "ios",
      })
    ).toBe("undetermined");
    expect(
      classifyLibraryAccess({
        granted: false,
        canAskAgain: true,
        accessPrivileges: "none",
        os: "android",
      })
    ).toBe("not_required");
    expect(libraryAccessMessage("limited")).toBe(LIMITED_LIBRARY_ACCESS_MESSAGE);
    expect(libraryAccessMessage("denied")).toBe(DENIED_LIBRARY_ACCESS_MESSAGE);
    expect(shouldBlockVideoLibraryPicker("denied", "ios")).toBe(true);
    expect(shouldBlockVideoLibraryPicker("limited", "ios")).toBe(false);
    expect(shouldBlockVideoLibraryPicker("denied", "android")).toBe(false);
  });

  it("opens the system video library and never requests camera or a gallery grant", async () => {
    vi.mocked(inspectMediaLibraryPermission).mockResolvedValue({
      kind: "mediaLibrary",
      granted: false,
      canAskAgain: true,
      explanation: "test",
      accessPrivileges: "none",
    });
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: true,
      assets: [],
    } as never);

    await pickVideoFromLibrary();

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaTypes: ["videos"],
        allowsEditing: false,
        allowsMultipleSelection: false,
        legacy: false,
        defaultTab: "albums",
      })
    );
    expect(VIDEO_LIBRARY_PICKER_OPTIONS.mediaTypes).toEqual(["videos"]);
    expect(requestMediaLibraryPermission).not.toHaveBeenCalled();
    expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  });

  it("returns cancelled without an asset so Create can keep A", async () => {
    vi.mocked(inspectMediaLibraryPermission).mockResolvedValue({
      kind: "mediaLibrary",
      granted: true,
      canAskAgain: true,
      explanation: "test",
      accessPrivileges: "all",
    });
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: true,
      assets: null,
    } as never);

    const cancelled = await pickVideoFromLibrary();
    expect(cancelled).toEqual({
      ok: false,
      cancelled: true,
      access: "not_required",
    });
    expect("asset" in cancelled).toBe(false);
  });

  it("replace B returns only the exact selected video identity", async () => {
    vi.mocked(inspectMediaLibraryPermission).mockResolvedValue({
      kind: "mediaLibrary",
      granted: true,
      canAskAgain: true,
      explanation: "test",
      accessPrivileges: "all",
    });
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///tmp/b.mp4",
          fileName: "b.mp4",
          mimeType: "video/mp4",
          fileSize: 2_000_000,
          duration: 4000,
          width: 720,
          height: 1280,
        },
      ],
    } as never);

    const result = await pickVideoFromLibrary();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.asset.uri).toBe("file:///tmp/b.mp4");
      expect(result.asset.fileName).toBe("b.mp4");
      expect(result.asset.durationMs).toBe(4000);
      expect(result.asset.byteSize).toBe(2_000_000);
      expect(result.asset.id).toEqual(expect.any(String));
    }
  });

  it("still opens the picker when iOS access is LIMITED and reports limited state", async () => {
    (Platform as { OS: string }).OS = "ios";
    vi.mocked(inspectMediaLibraryPermission).mockResolvedValue({
      kind: "mediaLibrary",
      granted: true,
      canAskAgain: true,
      explanation: "limited",
      accessPrivileges: "limited",
    });
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: true,
      assets: [],
    } as never);

    const result = await pickVideoFromLibrary();
    expect(result).toEqual({
      ok: false,
      cancelled: true,
      access: "limited",
    });
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    expect(libraryAccessMessage("limited")).toMatch(/selected/i);
  });

  it("blocks iOS denied access without opening an empty picker", async () => {
    (Platform as { OS: string }).OS = "ios";
    vi.mocked(inspectMediaLibraryPermission).mockResolvedValue({
      kind: "mediaLibrary",
      granted: false,
      canAskAgain: false,
      explanation: "denied",
      accessPrivileges: "none",
    });

    const result = await pickVideoFromLibrary();
    expect(result.ok).toBe(false);
    if (!result.ok && !result.cancelled) {
      expect(result.reason).toBe("library_denied");
      expect(result.message).toBe(DENIED_LIBRARY_ACCESS_MESSAGE);
      expect(result.access).toBe("denied");
    }
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
    expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  });

  it("expands LIMITED access through the system limited-library picker", async () => {
    (Platform as { OS: string }).OS = "ios";
    vi.mocked(inspectMediaLibraryPermission)
      .mockResolvedValueOnce({
        kind: "mediaLibrary",
        granted: true,
        canAskAgain: true,
        explanation: "limited",
        accessPrivileges: "limited",
      })
      .mockResolvedValueOnce({
        kind: "mediaLibrary",
        granted: true,
        canAskAgain: true,
        explanation: "all",
        accessPrivileges: "all",
      });

    const expanded = await expandLimitedVideoLibraryAccess();
    expect(MediaLibrary.presentPermissionsPicker).toHaveBeenCalledWith(["video"]);
    expect(Linking.openSettings).not.toHaveBeenCalled();
    expect(expanded).toEqual({ opened: true, access: "all" });
  });
});
