import { describe, expect, it } from "vitest";

import { validateVideoDuration } from "@/src/contracts/video";
import {
  beginUpload,
  completePublish,
  failUpload,
  initialCreateJourneyState,
} from "@/src/lib/video/createJourney";
import {
  applyAcceptedPick,
  applyRejectedPick,
  bindRetryToCurrentAsset,
  canPublishCreateDraft,
  createAssetFingerprint,
  evaluateCreateAsset,
  isStaleCreateAttempt,
  nextCreateAttemptId,
  resetCreateDraftAfterPublish,
  shouldResetCreateOnBlur,
  type CreateBoundAsset,
} from "@/src/lib/video/createUploadState";

function validAsset(
  overrides: Partial<CreateBoundAsset> = {}
): CreateBoundAsset {
  return {
    id: "asset-a",
    uri: "file:///tmp/a.mp4",
    fileName: "a.mp4",
    mimeType: "video/mp4",
    byteSize: 1_000_000,
    durationMs: 12_500,
    ...overrides,
  };
}

describe("create upload state lifecycle", () => {
  it("resets per-upload draft after a successful publish", () => {
    let journey = beginUpload(initialCreateJourneyState(), {
      attemptId: "asset-a:1",
      assetId: "asset-a",
    })!;
    journey = completePublish(journey, 99);

    expect(journey.phase).toBe("success");
    expect(journey.publishedPostId).toBe(99);
    expect(journey.uploadedPath).toBeNull();
    expect(journey.attemptId).toBeNull();
    expect(journey.boundAssetId).toBeNull();
    expect(resetCreateDraftAfterPublish()).toEqual({
      asset: null,
      caption: "",
      ugcAck: false,
    });
    expect(shouldResetCreateOnBlur(journey.phase)).toBe(true);
    expect(
      canPublishCreateDraft({
        asset: validAsset(),
        journey,
        ugcAck: true,
        caption: "ok",
      })
    ).toBe(false);
  });

  it("rejected pick clears previous upload/publish binding", () => {
    let journey = beginUpload(initialCreateJourneyState(), {
      attemptId: "asset-a:1",
      assetId: "asset-a",
    })!;
    journey = failUpload(journey, new Error("network"));
    journey.uploadedPath = "user/old.mp4";
    journey.publishedPostId = 7;

    const next = applyRejectedPick(
      journey,
      "The video must be smaller than 50 MB.",
      "long-clip.mp4"
    );

    expect(next.phase).toBe("error");
    expect(next.error).toMatch(/50 MB/i);
    expect(next.uploadedPath).toBeNull();
    expect(next.publishedPostId).toBeNull();
    expect(next.attemptId).toBeNull();
    expect(next.boundAssetId).toBeNull();
    expect(next.rejectedAssetLabel).toBe("long-clip.mp4");
    expect(evaluateCreateAsset(null).ok).toBe(false);
    expect(
      canPublishCreateDraft({
        asset: null,
        journey: next,
        ugcAck: true,
        caption: "ok",
      })
    ).toBe(false);
    expect(
      bindRetryToCurrentAsset({
        asset: null,
        journey: next,
        nonce: 2,
      }).ok
    ).toBe(false);
  });

  it("accepted pick replaces journey so the new asset cannot inherit the old upload", () => {
    let journey = beginUpload(initialCreateJourneyState(), {
      attemptId: "asset-a:1",
      assetId: "asset-a",
    })!;
    journey.uploadedPath = "user/old.mp4";
    const next = applyAcceptedPick(journey);
    expect(next.phase).toBe("ready");
    expect(next.uploadedPath).toBeNull();
    expect(next.boundAssetId).toBeNull();
    expect(next.error).toBeNull();
  });

  it("retry binds only to the current valid asset identity", () => {
    const previous = validAsset({
      id: "asset-a",
      uri: "file:///tmp/a.mp4",
    });
    const current = validAsset({
      id: "asset-b",
      uri: "file:///tmp/b.mp4",
      fileName: "b.mp4",
    });
    const journey = initialCreateJourneyState();

    expect(createAssetFingerprint(previous)).not.toBe(
      createAssetFingerprint(current)
    );

    const bound = bindRetryToCurrentAsset({
      asset: current,
      journey,
      nonce: 4,
    });
    expect(bound.ok).toBe(true);
    if (bound.ok) {
      expect(bound.asset.id).toBe("asset-b");
      expect(bound.asset.uri).toBe("file:///tmp/b.mp4");
      expect(bound.attemptId).toBe(nextCreateAttemptId("asset-b", 4));
    }

    expect(
      bindRetryToCurrentAsset({
        asset: validAsset({ durationMs: 0 }),
        journey,
        nonce: 5,
      }).ok
    ).toBe(false);
  });

  it("stale attempt callbacks cannot complete a newer selection", () => {
    const first = nextCreateAttemptId("asset-a", 1);
    const second = nextCreateAttemptId("asset-b", 2);
    expect(isStaleCreateAttempt(second, first)).toBe(true);
    expect(isStaleCreateAttempt(second, second)).toBe(false);
    expect(isStaleCreateAttempt(null, first)).toBe(true);
  });

  it("disables publish when the current asset fails the same validators as the UI warning", () => {
    const journey = initialCreateJourneyState();
    const oversized = validAsset({ byteSize: 51 * 1024 * 1024 });
    const invalidDuration = validAsset({ durationMs: 0 });

    expect(evaluateCreateAsset(oversized).ok).toBe(false);
    expect(evaluateCreateAsset(oversized)).toMatchObject({
      message: expect.stringMatching(/50 MB/i),
    });
    expect(evaluateCreateAsset(invalidDuration).ok).toBe(false);
    expect(validateVideoDuration(0).ok).toBe(false);
    expect(validateVideoDuration(12_500).ok).toBe(true);
    expect(validateVideoDuration(null).ok).toBe(true);

    expect(
      canPublishCreateDraft({
        asset: oversized,
        journey,
        ugcAck: true,
        caption: "ok",
      })
    ).toBe(false);
    expect(
      canPublishCreateDraft({
        asset: invalidDuration,
        journey,
        ugcAck: true,
        caption: "ok",
      })
    ).toBe(false);
    expect(
      canPublishCreateDraft({
        asset: validAsset(),
        journey,
        ugcAck: true,
        caption: "ok",
      })
    ).toBe(true);
  });
});
