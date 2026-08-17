import { afterEach, describe, expect, it, vi } from "vitest";

const getInfoAsync = vi.fn();

vi.mock("expo-file-system/legacy", () => ({
  getInfoAsync: (...args: unknown[]) => getInfoAsync(...args),
}));

vi.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: vi.fn(),
  getMediaLibraryPermissionsAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

vi.mock("@/src/lib/permissions/foundation", () => ({
  requestMediaLibraryPermission: vi.fn(async () => ({
    kind: "mediaLibrary",
    granted: true,
    canAskAgain: true,
    explanation: "test",
  })),
}));

import * as ImagePicker from "expo-image-picker";
import { requestMediaLibraryPermission } from "@/src/lib/permissions/foundation";
import {
  formatPickedDurationSecondsLabel,
  inferPickedVideoMimeType,
  pickerDurationToMs,
  pickVideoFromLibrary,
  resolvePickedVideoByteSize,
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
    vi.mocked(requestMediaLibraryPermission).mockResolvedValue({
      kind: "mediaLibrary",
      granted: true,
      canAskAgain: true,
      explanation: "test",
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
    vi.mocked(requestMediaLibraryPermission).mockResolvedValue({
      kind: "mediaLibrary",
      granted: false,
      canAskAgain: true,
      explanation: "test",
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
    vi.mocked(requestMediaLibraryPermission).mockResolvedValue({
      kind: "mediaLibrary",
      granted: true,
      canAskAgain: true,
      explanation: "test",
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
    vi.mocked(requestMediaLibraryPermission).mockResolvedValue({
      kind: "mediaLibrary",
      granted: true,
      canAskAgain: true,
      explanation: "test",
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
    vi.mocked(requestMediaLibraryPermission).mockResolvedValue({
      kind: "mediaLibrary",
      granted: true,
      canAskAgain: true,
      explanation: "test",
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

  it("rejects non-finite or non-positive picker duration", () => {
    expect(pickerDurationToMs(0)).toBeNull();
    expect(pickerDurationToMs(-4)).toBeNull();
    expect(pickerDurationToMs(Number.NaN)).toBeNull();
  });
});
