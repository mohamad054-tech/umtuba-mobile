import { describe, expect, it } from "vitest";

import {
  buildMessageMediaPath,
  isOwnedMessageMediaPath,
  MESSAGE_MEDIA_BUCKET,
} from "./media";
import { canSendPrivateVisual } from "./privacy";
import {
  shouldMintVisualSignedUrl,
  visualReplayBlocked,
} from "./visualMessage";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

describe("view-once signed URL contract", () => {
  it("does not mint a fresh signed URL after the recipient opened", () => {
    expect(
      shouldMintVisualSignedUrl({
        visualOpenedAt: "2026-09-02T10:05:00.000Z",
        senderId: USER_A,
        currentUserId: USER_B,
      })
    ).toBe(false);
    expect(
      visualReplayBlocked({ viewed: true, isMine: false })
    ).toBe(true);
    expect(
      shouldMintVisualSignedUrl({
        visualOpenedAt: "2026-09-02T10:05:00.000Z",
        senderId: USER_A,
        currentUserId: USER_B,
        expirationPolicy: "keep_in_conversation",
      })
    ).toBe(true);
    expect(
      visualReplayBlocked({
        viewed: true,
        isMine: false,
        expirationPolicy: "keep_in_conversation",
      })
    ).toBe(false);
  });

  it("allows the first recipient open and sender preview", () => {
    expect(
      shouldMintVisualSignedUrl({
        visualOpenedAt: null,
        senderId: USER_A,
        currentUserId: USER_B,
      })
    ).toBe(true);
    expect(
      shouldMintVisualSignedUrl({
        visualOpenedAt: "2026-09-02T10:05:00.000Z",
        senderId: USER_A,
        currentUserId: USER_A,
      })
    ).toBe(true);
    expect(
      visualReplayBlocked({ viewed: true, isMine: true })
    ).toBe(false);
  });
});

describe("UM Streak blocking", () => {
  it("blocks private visual send when the peer is blocked", () => {
    expect(canSendPrivateVisual({ blocked: true }).allowed).toBe(false);
    expect(canSendPrivateVisual({ blocked: false }).allowed).toBe(true);
  });
});

describe("private message-media path", () => {
  it("keeps visual uploads out of public UM Life buckets", () => {
    const path = buildMessageMediaPath({
      userId: USER_A,
      conversationId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      fileId: "file-1",
      extension: "jpg",
    });
    expect(MESSAGE_MEDIA_BUCKET).toBe("message-media");
    expect(path).toBe(
      `${USER_A}/cccccccc-cccc-cccc-cccc-cccccccccccc/file-1.jpg`
    );
    expect(path.startsWith("post-videos/")).toBe(false);
    expect(
      isOwnedMessageMediaPath(
        USER_A,
        "cccccccc-cccc-cccc-cccc-cccccccccccc",
        path
      )
    ).toBe(true);
  });
});
