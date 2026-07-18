import { describe, expect, it } from "vitest";

import {
  extractHashtags,
  isOwnedVideoPath,
  validateCaption,
  validateVideoDuration,
  validateVideoFile,
} from "@/src/contracts/video";
import {
  clampUploadPercent,
  createAbortError,
  isAbortError,
  processingProgressAfterUpload,
  processingProgressWhilePublishing,
} from "@/src/lib/video/createProgress";
import {
  applyUploadProgress,
  beginUpload,
  canStartPublish,
  canStartUpload,
  completePublish,
  completeUpload,
  failPublish,
  failUpload,
  initialCreateJourneyState,
} from "@/src/lib/video/createJourney";
import { signedPlaybackRefreshContract } from "@/src/lib/video/publishVideoPost";
import { getErrorMessage } from "@/src/contracts/validation";

describe("picker validation", () => {
  it("rejects unsupported formats and oversized files", () => {
    expect(
      validateVideoFile({
        mimeType: "image/png",
        byteSize: 1000,
        fileName: "x.png",
      }).ok
    ).toBe(false);
    expect(
      validateVideoFile({
        mimeType: "video/mp4",
        byteSize: 51 * 1024 * 1024,
        fileName: "big.mp4",
      }).ok
    ).toBe(false);
    expect(
      validateVideoFile({
        mimeType: "",
        byteSize: 1200,
        fileName: "clip.mov",
      })
    ).toEqual({ ok: true, mimeType: "video/quicktime" });
  });

  it("validates caption and duration honestly", () => {
    expect(validateCaption("a".repeat(1001)).ok).toBe(false);
    expect(validateCaption("ok").ok).toBe(true);
    expect(validateVideoDuration(null).ok).toBe(true);
    expect(validateVideoDuration(0).ok).toBe(false);
    expect(validateVideoDuration(1500).ok).toBe(true);
  });

  it("extracts hashtags from caption without a separate privacy model", () => {
    expect(extractHashtags("Hello #Travel #UMTUBA_rocks")).toEqual([
      "#Travel",
      "#UMTUBA_rocks",
    ]);
  });
});

describe("upload journey", () => {
  it("prevents duplicate uploads while busy", () => {
    let state = initialCreateJourneyState();
    const started = beginUpload(state);
    expect(started).not.toBeNull();
    state = started!;
    expect(canStartUpload(state)).toBe(false);
    expect(beginUpload(state)).toBeNull();
  });

  it("tracks progress updates and completes upload", () => {
    let state = beginUpload(initialCreateJourneyState())!;
    state = applyUploadProgress(state, 42.7);
    expect(state.uploadPercent).toBe(43);
    state = completeUpload(state, "user/abc.mp4");
    expect(state.phase).toBe("queued");
    expect(state.uploadPercent).toBe(100);
    expect(state.uploadedPath).toBe("user/abc.mp4");
    expect(processingProgressAfterUpload().processingPercent).toBeNull();
  });

  it("cancel / abort surfaces cancelled message", () => {
    const state = beginUpload(initialCreateJourneyState())!;
    const next = failUpload(state, createAbortError());
    expect(isAbortError(createAbortError())).toBe(true);
    expect(next.error).toMatch(/cancelled/i);
    expect(next.uploadBusy).toBe(false);
  });

  it("upload failure keeps honest fallback", () => {
    const state = beginUpload(initialCreateJourneyState())!;
    const next = failUpload(state, new Error(""));
    expect(next.phase).toBe("error");
    expect(next.error).toMatch(/could not be uploaded/i);
  });
});

describe("publish journey", () => {
  it("prevents double publish while busy", () => {
    let state = completeUpload(
      beginUpload(initialCreateJourneyState())!,
      "uid/file.mp4"
    );
    expect(canStartPublish(state)).toBe(false);
    state = completePublish(state);
    expect(state.phase).toBe("success");
    expect(state.publishBusy).toBe(false);
  });

  it("publish failure sanitizes technical errors", () => {
    const state = beginUpload(initialCreateJourneyState())!;
    const next = failPublish(
      state,
      new Error(getErrorMessage({ message: "SQL relation posts" }, "fallback"))
    );
    expect(next.error).toBe("fallback");
  });

  it("processing stays indeterminate until ready", () => {
    expect(processingProgressWhilePublishing().processingPercent).toBeNull();
  });
});

describe("ownership and signed refresh contract", () => {
  it("rejects paths outside owner folder", () => {
    expect(isOwnedVideoPath("uid", "uid/clip.mp4")).toBe(true);
    expect(isOwnedVideoPath("uid", "other/clip.mp4")).toBe(false);
    expect(isOwnedVideoPath("uid", "uid/../x.mp4")).toBe(false);
  });

  it("exposes playback signed URL TTL for refresh", () => {
    const contract = signedPlaybackRefreshContract();
    expect(contract.bucket).toBe("post-videos");
    expect(contract.ttlSeconds).toBe(15 * 60);
  });

  it("clamps progress and treats session-looking errors as user-facing", () => {
    expect(clampUploadPercent(150)).toBe(100);
    expect(
      getErrorMessage(
        { message: "Invalid Refresh Token" },
        "Please sign in to publish a video."
      )
    ).toBe("Please sign in to publish a video.");
  });
});
