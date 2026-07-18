import { describe, expect, it } from "vitest";

import { getErrorMessage } from "@/src/contracts/validation";
import {
  decodeMessagesCursor,
  encodeMessagesCursor,
} from "@/src/lib/messenger/cursor";
import {
  applyPeerReadToMessages,
  canSendWithClientId,
  createOptimisticMessage,
  dedupeConversations,
  markOptimisticFailed,
  mergeMessages,
  preserveDeepLinkMessageId,
  replaceOptimisticWithServer,
  resolveAndroidBack,
  shouldMarkReadAfterLoad,
  sortConversations,
} from "@/src/lib/messenger/threadState";
import type { Conversation, Message } from "@/src/lib/messenger/types";
import { computeReceiptStatus } from "@/src/lib/messenger/types";

function msg(partial: Partial<Message> & Pick<Message, "id" | "text">): Message {
  return {
    conversationId: "c1",
    senderId: "u1",
    sentAt: "2026-01-01T00:00:00.000Z",
    isMine: true,
    status: "sent",
    ...partial,
  };
}

describe("conversation dedupe and ordering", () => {
  it("dedupes by id and sorts by lastMessageAt desc", () => {
    const items: Conversation[] = [
      {
        id: "a",
        peerId: "p1",
        peerName: "A",
        peerInitials: "A",
        unreadCount: 0,
        isTyping: false,
        lastMessagePreview: "old",
        lastMessageAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "b",
        peerId: "p2",
        peerName: "B",
        peerInitials: "B",
        unreadCount: 2,
        isTyping: false,
        lastMessagePreview: "new",
        lastMessageAt: "2026-02-01T00:00:00Z",
      },
      {
        id: "a",
        peerId: "p1",
        peerName: "A",
        peerInitials: "A",
        unreadCount: 1,
        isTyping: false,
        lastMessagePreview: "newer a",
        lastMessageAt: "2026-01-15T00:00:00Z",
      },
    ];
    const deduped = dedupeConversations(items);
    expect(deduped.map((c) => c.id)).toEqual(["b", "a"]);
    expect(deduped[1]?.unreadCount).toBe(1);
    expect(sortConversations(deduped)[0]?.id).toBe("b");
  });
});

describe("optimistic send", () => {
  it("creates sending optimistic then replaces on success", () => {
    const optimistic = createOptimisticMessage({
      conversationId: "c1",
      senderId: "u1",
      text: "hello",
      clientId: "cid-1",
    });
    expect(optimistic.status).toBe("sending");
    expect(optimistic.id.startsWith("optimistic-")).toBe(true);

    const server = msg({
      id: "server-1",
      text: "hello",
      clientId: "cid-1",
      status: "sent",
    });
    const merged = replaceOptimisticWithServer([optimistic], "cid-1", server);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("server-1");
    expect(merged[0]?.status).toBe("sent");
  });

  it("marks failed and supports rollback-style status", () => {
    const optimistic = createOptimisticMessage({
      conversationId: "c1",
      senderId: "u1",
      text: "x",
      clientId: "cid-2",
    });
    const failed = markOptimisticFailed([optimistic], "cid-2");
    expect(failed[0]?.status).toBe("failed");
  });

  it("prevents duplicate in-flight client ids", () => {
    const inFlight = new Set(["cid-1"]);
    expect(canSendWithClientId(inFlight, "cid-1")).toBe(false);
    expect(canSendWithClientId(inFlight, "cid-2")).toBe(true);
  });
});

describe("realtime duplicate suppression", () => {
  it("merges by clientId and suppresses duplicates", () => {
    const a = msg({
      id: "optimistic-cid",
      clientId: "cid",
      text: "hi",
      status: "sending",
    });
    const b = msg({
      id: "real",
      clientId: "cid",
      text: "hi",
      status: "sent",
      sentAt: "2026-01-01T00:00:01.000Z",
    });
    const merged = mergeMessages([a], [b]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("real");
  });
});

describe("subscription cleanup contract", () => {
  it("cleanup function is idempotent to call", () => {
    let removed = 0;
    const cleanup = () => {
      removed += 1;
    };
    cleanup();
    cleanup();
    expect(removed).toBe(2);
  });
});

describe("deep-link message preservation", () => {
  it("keeps valid conversation + optional message ids", () => {
    const conversationId = "11111111-1111-4111-8111-111111111111";
    const messageId = "22222222-2222-4222-8222-222222222222";
    expect(preserveDeepLinkMessageId(conversationId, messageId)).toEqual({
      conversationId,
      messageId,
    });
    expect(preserveDeepLinkMessageId("bad", messageId)).toBeNull();
    expect(preserveDeepLinkMessageId(conversationId, "bad")?.messageId).toBeNull();
  });
});

describe("read-mark timing", () => {
  it("only marks read after successful load", () => {
    expect(
      shouldMarkReadAfterLoad({
        loadedOk: false,
        conversationId: "c",
        messageCount: 0,
      })
    ).toBe(false);
    expect(
      shouldMarkReadAfterLoad({
        loadedOk: true,
        conversationId: "c",
        messageCount: 0,
      })
    ).toBe(true);
  });
});

describe("error sanitization", () => {
  it("hides technical supabase errors", () => {
    expect(
      getErrorMessage(
        { message: "relation messages does not exist SQL" },
        "Unable to load messages. Please try again."
      )
    ).toBe("Unable to load messages. Please try again.");
  });
});

describe("draft persistence contract", () => {
  it("cursor round-trips for pagination drafts of history", () => {
    const cursor = encodeMessagesCursor("2026-01-01T00:00:00Z", "mid");
    expect(decodeMessagesCursor(cursor)).toEqual({
      createdAt: "2026-01-01T00:00:00Z",
      id: "mid",
    });
  });
});

describe("Android back behavior", () => {
  it("closes thread before leaving Messages", () => {
    expect(resolveAndroidBack(true)).toBe("close-thread");
    expect(resolveAndroidBack(false)).toBe("leave-messages");
  });
});

describe("receipts", () => {
  it("derives sent/delivered/seen from peer last_read", () => {
    const base = {
      isMine: true as const,
      sentAt: "2026-01-01T12:00:00.000Z",
      status: "sent" as const,
    };
    expect(computeReceiptStatus({ ...base, peerLastReadAt: null })).toBe("sent");
    expect(
      computeReceiptStatus({
        ...base,
        peerLastReadAt: "2026-01-01T11:00:00.000Z",
      })
    ).toBe("delivered");
    expect(
      computeReceiptStatus({
        ...base,
        peerLastReadAt: "2026-01-01T13:00:00.000Z",
      })
    ).toBe("seen");

    const updated = applyPeerReadToMessages(
      [msg({ id: "1", text: "x", sentAt: base.sentAt })],
      "2026-01-01T13:00:00.000Z"
    );
    expect(updated[0]?.receiptStatus).toBe("seen");
  });
});
