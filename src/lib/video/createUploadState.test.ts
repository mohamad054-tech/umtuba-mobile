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
  applyAtomicAcceptedPick,
  applyAtomicRejectedPick,
  applyPickerCancel,
  applyRejectedPick,
  beginCreatePick,
  bindRetryToCurrentAsset,
  canPublishCreateDraft,
  createAssetFingerprint,
  evaluateCreateAsset,
  initialCreateDraft,
  isCreatePublishActionAllowed,
  isCreateUploadStartAllowed,
  isStaleCreateAttempt,
  nextCreateAttemptId,
  reopenCreateAfterSuccess,
  resetCreateDraftAfterPublish,
  shouldIgnoreStaleCreateCallback,
  shouldResetCreateOnBlur,
  type CreateBoundAsset,
  type CreateDraftSnapshot,
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
      activeAttemptId: null,
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

function draftWithAsset(
  asset: CreateBoundAsset,
  overrides: Partial<CreateDraftSnapshot<CreateBoundAsset>> = {}
): CreateDraftSnapshot<CreateBoundAsset> {
  return {
    asset,
    caption: "hello A",
    ugcAck: true,
    journey: initialCreateJourneyState(),
    activeAttemptId: null,
    ...overrides,
  };
}

describe("TEST_1 publish A → reopen Create → no A state", () => {
  it("clears asset, caption, validation, upload, and retry after success blur", () => {
    const published = completePublish(
      beginUpload(initialCreateJourneyState(), {
        attemptId: "asset-a:1",
        assetId: "asset-a",
      })!,
      42
    );
    const cleared = resetCreateDraftAfterPublish();
    const reopened = reopenCreateAfterSuccess(published.phase);

    expect(cleared).toEqual({
      asset: null,
      caption: "",
      ugcAck: false,
      activeAttemptId: null,
    });
    expect(reopened).not.toBeNull();
    expect(reopened).toEqual(initialCreateDraft());
    expect(reopened?.asset).toBeNull();
    expect(reopened?.caption).toBe("");
    expect(reopened?.journey.phase).toBe("ready");
    expect(reopened?.journey.error).toBeNull();
    expect(reopened?.activeAttemptId).toBeNull();
    expect(
      bindRetryToCurrentAsset({
        asset: reopened!.asset,
        journey: reopened!.journey,
        nonce: 9,
      }).ok
    ).toBe(false);
  });
});

describe("TEST_2 select A → choose B → B replaces A", () => {
  it("replaces A with B atomically and drops A's upload binding", () => {
    const assetA = validAsset();
    const assetB = validAsset({
      id: "asset-b",
      uri: "file:///tmp/b.mp4",
      fileName: "b.mp4",
    });
    let draft: CreateDraftSnapshot<CreateBoundAsset | null> = draftWithAsset(
      assetA,
      {
        journey: beginUpload(initialCreateJourneyState(), {
          attemptId: "asset-a:1",
          assetId: "asset-a",
        })!,
        activeAttemptId: "asset-a:1",
      }
    );
    draft.journey.uploadedPath = "user/a.mp4";

    const opened = beginCreatePick(draft);
    expect(opened.asset?.uri).toBe(assetA.uri);
    expect(opened.activeAttemptId).toBe("asset-a:1");

    const replaced = applyAtomicAcceptedPick(opened, assetB);
    expect(replaced.asset.id).toBe("asset-b");
    expect(replaced.asset.uri).toBe("file:///tmp/b.mp4");
    expect(replaced.journey.uploadedPath).toBeNull();
    expect(replaced.journey.boundAssetId).toBeNull();
    expect(replaced.journey.attemptId).toBeNull();
    expect(replaced.activeAttemptId).toBeNull();
    expect(createAssetFingerprint(replaced.asset)).not.toBe(
      createAssetFingerprint(assetA)
    );
  });
});

describe("TEST_3 select A → picker cancel → A remains", () => {
  it("preserves the previous valid selection when the picker is cancelled", () => {
    const assetA = validAsset();
    const draft = draftWithAsset(assetA, {
      journey: {
        ...initialCreateJourneyState(),
        phase: "error",
        error: "Upload failed",
        boundAssetId: "asset-a",
      },
      activeAttemptId: "asset-a:3",
    });

    const afterOpen = beginCreatePick(draft);
    const afterCancel = applyPickerCancel(afterOpen);

    expect(afterCancel.asset).toEqual(assetA);
    expect(afterCancel.caption).toBe("hello A");
    expect(afterCancel.journey.error).toBe("Upload failed");
    expect(afterCancel.journey.boundAssetId).toBe("asset-a");
    expect(afterCancel.activeAttemptId).toBe("asset-a:3");
  });
});

describe("TEST_4 valid A → replace over-duration B → Publish disabled → retry cannot upload A", () => {
  it("rejects invalid-duration B without inheriting A's URI or retry", () => {
    const assetA = validAsset();
    const overDurationB = validAsset({
      id: "asset-b",
      uri: "file:///tmp/b-long.mp4",
      fileName: "b-long.mp4",
      durationMs: 0,
    });
    const draft = draftWithAsset(assetA, {
      activeAttemptId: "asset-a:1",
    });

    const durationGate = evaluateCreateAsset(overDurationB);
    expect(durationGate.ok).toBe(false);

    const rejected = applyAtomicRejectedPick(
      beginCreatePick(draft),
      durationGate.ok ? "unexpected" : durationGate.message ?? "invalid duration",
      overDurationB.fileName
    );

    expect(rejected.asset).toBeNull();
    expect(rejected.journey.rejectedAssetLabel).toBe("b-long.mp4");
    expect(rejected.journey.attemptId).toBeNull();
    expect(rejected.journey.boundAssetId).toBeNull();
    expect(rejected.activeAttemptId).toBeNull();
    expect(
      isCreatePublishActionAllowed({
        asset: rejected.asset,
        journey: rejected.journey,
        ugcAck: true,
        caption: "ok",
      })
    ).toBe(false);
    expect(
      bindRetryToCurrentAsset({
        asset: rejected.asset,
        journey: rejected.journey,
        nonce: 8,
      }).ok
    ).toBe(false);
  });
});

describe("TEST_5 over-duration current → direct publish invocation blocked", () => {
  it("blocks Publish and upload start for the current invalid-duration asset", () => {
    const current = validAsset({ durationMs: 0 });
    const input = {
      asset: current,
      journey: initialCreateJourneyState(),
      ugcAck: true,
      caption: "ok",
    };

    expect(evaluateCreateAsset(current).ok).toBe(false);
    expect(isCreatePublishActionAllowed(input)).toBe(false);
    expect(isCreateUploadStartAllowed(input)).toBe(false);
    expect(
      bindRetryToCurrentAsset({
        asset: current,
        journey: input.journey,
        nonce: 1,
      }).ok
    ).toBe(false);
  });
});

describe("TEST_6 failed upload B → Retry → B only", () => {
  it("binds retry to the current failed asset identity, not a previous clip", () => {
    const assetB = validAsset({
      id: "asset-b",
      uri: "file:///tmp/b.mp4",
      fileName: "b.mp4",
    });
    const journey = failUpload(
      beginUpload(initialCreateJourneyState(), {
        attemptId: "asset-b:2",
        assetId: "asset-b",
      })!,
      new Error("network")
    );

    const bound = bindRetryToCurrentAsset({
      asset: assetB,
      journey,
      nonce: 3,
    });
    expect(bound.ok).toBe(true);
    if (bound.ok) {
      expect(bound.asset.id).toBe("asset-b");
      expect(bound.asset.uri).toBe("file:///tmp/b.mp4");
      expect(bound.attemptId).toBe(nextCreateAttemptId("asset-b", 3));
      expect(bound.attemptId).not.toBe("asset-a:1");
    }
  });
});

describe("TEST_7 publish A → reset → Create B → late callback A cannot mutate B", () => {
  it("ignores a late completion from A after B is the active session", () => {
    const attemptA = nextCreateAttemptId("asset-a", 1);
    const attemptB = nextCreateAttemptId("asset-b", 2);
    const afterA = completePublish(
      beginUpload(initialCreateJourneyState(), {
        attemptId: attemptA,
        assetId: "asset-a",
      })!,
      11
    );
    const reset = reopenCreateAfterSuccess(afterA.phase)!;
    expect(reset.activeAttemptId).toBeNull();

    const sessionB = beginUpload(reset.journey, {
      attemptId: attemptB,
      assetId: "asset-b",
    })!;

    expect(shouldIgnoreStaleCreateCallback(attemptB, sessionB.attemptId, attemptA)).toBe(
      true
    );
    expect(shouldIgnoreStaleCreateCallback(null, sessionB.attemptId, attemptA)).toBe(
      true
    );
    expect(isStaleCreateAttempt(attemptB, attemptA)).toBe(true);

    const ignored = shouldIgnoreStaleCreateCallback(
      attemptB,
      sessionB.attemptId,
      attemptA
    )
      ? sessionB
      : completePublish(sessionB, 11);
    expect(ignored.boundAssetId).toBe("asset-b");
    expect(ignored.attemptId).toBe(attemptB);
    expect(ignored.phase).toBe("uploading");
    expect(ignored.publishedPostId).toBeNull();
  });
});
