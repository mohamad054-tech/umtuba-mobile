import { describe, expect, it } from "vitest";

import {
  isKeepInConversationPolicy,
  isPlayableVisualPreviewUrl,
  isViewOncePolicy,
  preserveKeepVisualPreviews,
  resolveVisualExpirationPolicy,
  shouldClearSiblingVisualPreview,
  toCameraViewFacing,
  visualSignedUrlTtlSeconds,
} from "./retention";

describe("UM Streak retention choice", () => {
  it("maps keep-in-conversation without silently forcing view-once", () => {
    expect(resolveVisualExpirationPolicy("keep_in_conversation")).toBe(
      "keep_in_conversation"
    );
    expect(resolveVisualExpirationPolicy("view_once")).toBe("view_once");
    expect(resolveVisualExpirationPolicy(null)).toBe("view_once");
    expect(isKeepInConversationPolicy("keep_in_conversation")).toBe(true);
    expect(isViewOncePolicy("keep_in_conversation")).toBe(false);
  });

  it("keeps keep-in-chat signed URLs longer than view-once", () => {
    expect(visualSignedUrlTtlSeconds("keep_in_conversation")).toBe(3600);
    expect(visualSignedUrlTtlSeconds("view_once")).toBe(90);
  });

  it("accepts only playable preview URLs", () => {
    expect(isPlayableVisualPreviewUrl("https://cdn.example/a.jpg")).toBe(true);
    expect(isPlayableVisualPreviewUrl("file:///cache/a.jpg")).toBe(true);
    expect(isPlayableVisualPreviewUrl("message-media/path.jpg")).toBe(false);
    expect(isPlayableVisualPreviewUrl("")).toBe(false);
  });

  it("does not wipe keep-in-chat previews when another visual opens", () => {
    expect(shouldClearSiblingVisualPreview("keep_in_conversation")).toBe(false);
    expect(shouldClearSiblingVisualPreview("view_once")).toBe(true);
    const next = preserveKeepVisualPreviews(
      [
        {
          id: "keep-1",
          visual: {
            expirationPolicy: "keep_in_conversation",
            previewUrl: "https://cdn.example/keep.jpg",
          },
        },
      ],
      [
        {
          id: "keep-1",
          visual: {
            expirationPolicy: "keep_in_conversation",
            previewUrl: null,
          },
        },
      ]
    );
    expect(next[0]?.visual?.previewUrl).toBe("https://cdn.example/keep.jpg");
  });

  it("maps UM Streak facing to CameraView facing", () => {
    expect(toCameraViewFacing("environment")).toBe("back");
    expect(toCameraViewFacing("user")).toBe("front");
  });
});
