import { describe, expect, it } from "vitest";

import { isMessengerBackendMissing } from "@/src/lib/messenger/backend";
import {
  conversationPreviewText,
  parseConversation,
  trustedUnreadCount,
} from "@/src/lib/messenger/conversationParse";
import {
  canOpenMessengerDestination,
  conversationThreadHref,
  mapMessengerDestination,
} from "@/src/lib/messenger/mapDestination";
import { mapMessengerMessageRow } from "@/src/lib/messenger/mapMessage";
import { formatMessageTime } from "@/src/lib/messenger/types";

describe("parseConversation", () => {
  it("parses trusted fields and skips invented identity", () => {
    const item = parseConversation({
      id: "11111111-1111-4111-8111-111111111111",
      peerId: "22222222-2222-4222-8222-222222222222",
      peerName: "Ada",
      unreadCount: 2,
      lastMessagePreview: "Hello",
      lastMessageAt: "2026-07-26T10:00:00.000Z",
      muted: true,
      peerAvatarUrl: "https://cdn.example/a.png",
    });
    expect(item).toMatchObject({
      peerName: "Ada",
      unreadCount: 2,
      muted: true,
      lastMessagePreview: "Hello",
    });
    expect(item?.peerAvatarUrl).toBe("https://cdn.example/a.png");
  });

  it("fails closed without id/peer and rejects bad avatar urls", () => {
    expect(
      parseConversation({
        id: "",
        peerId: "22222222-2222-4222-8222-222222222222",
      })
    ).toBeNull();
    expect(
      parseConversation({
        id: "11111111-1111-4111-8111-111111111111",
        peerId: "",
      })
    ).toBeNull();
    const item = parseConversation({
      id: "11111111-1111-4111-8111-111111111111",
      peerId: "22222222-2222-4222-8222-222222222222",
      peerAvatarUrl: "javascript:alert(1)",
    });
    expect(item?.peerAvatarUrl).toBeNull();
    expect(item?.peerName).toBe("Direct message");
  });
});

describe("conversation preview / unread", () => {
  it("uses typing and trusted unread only", () => {
    const base = parseConversation({
      id: "11111111-1111-4111-8111-111111111111",
      peerId: "22222222-2222-4222-8222-222222222222",
      peerName: "Ada",
      lastMessagePreview: "Hi",
      unreadCount: 3,
    })!;
    expect(conversationPreviewText(base)).toBe("Hi");
    expect(
      conversationPreviewText({ ...base, isTyping: true })
    ).toBe("Typing…");
    expect(
      conversationPreviewText({ ...base, lastMessagePreview: "" })
    ).toBe("No messages yet");
    expect(trustedUnreadCount(base)).toBe(3);
    expect(trustedUnreadCount({ ...base, unreadCount: 0 })).toBeNull();
  });
});

describe("messenger destinations", () => {
  it("maps inbox/thread hrefs and rejects unsupported", () => {
    expect(mapMessengerDestination("/(tabs)/messages")).toBe(
      "/(tabs)/messages"
    );
    expect(
      conversationThreadHref("11111111-1111-4111-8111-111111111111")
    ).toBe("/messages/11111111-1111-4111-8111-111111111111");
    expect(
      canOpenMessengerDestination(
        "https://umtuba.com/messages/11111111-1111-4111-8111-111111111111"
      )
    ).toBe(true);
    expect(mapMessengerDestination("https://evil.example/messages")).toBeNull();
    expect(mapMessengerDestination("/messages/not-a-uuid")).toBeNull();
    expect(conversationThreadHref("bad")).toBeNull();
    expect(mapMessengerDestination("/messages/streak-camera")).toBe(
      "/messages/streak-camera"
    );
  });
});

describe("unavailable backend detection", () => {
  it("detects missing table/function errors", () => {
    expect(
      isMessengerBackendMissing("Could not find the table conversation_participants")
    ).toBe(true);
    expect(isMessengerBackendMissing("network timeout")).toBe(false);
  });
});

describe("message preview / time formatting", () => {
  it("formats valid times and fails closed on invalid", () => {
    expect(formatMessageTime(null)).toBe("");
    expect(formatMessageTime("not-a-date")).toBe("");
    const recent = new Date(Date.now() - 30_000).toISOString();
    expect(formatMessageTime(recent)).toBe("Just now");
  });

  it("maps unsupported message types without inventing content", () => {
    const mapped = mapMessengerMessageRow(
      {
        id: "m1",
        conversation_id: "c1",
        sender_id: "u1",
        body: null,
        message_type: "sticker",
        created_at: "2026-07-26T10:00:00.000Z",
        deleted_at: null,
        client_id: null,
      },
      "u1"
    );
    expect(mapped.text).toBe("Unsupported message");
    expect(mapped.visual).toBeNull();
  });

  it("maps private visual messages without minting a preview URL", () => {
    const mapped = mapMessengerMessageRow(
      {
        id: "m2",
        conversation_id: "c1",
        sender_id: "u2",
        body: "hello",
        message_type: "image",
        created_at: "2026-07-26T10:00:00.000Z",
        deleted_at: null,
        client_id: null,
        visual_opened_at: null,
        visual_expiration_policy: "view_once",
      },
      "u1"
    );
    expect(mapped.visual).toMatchObject({
      mediaType: "image",
      caption: "hello",
      viewed: false,
      previewUrl: null,
      expirationPolicy: "view_once",
    });
    expect(mapped.text).toBe("hello");
  });

  it("maps keep-in-conversation visuals without forcing view-once", () => {
    const mapped = mapMessengerMessageRow(
      {
        id: "m3",
        conversation_id: "c1",
        sender_id: "u2",
        body: "keep",
        message_type: "video",
        created_at: "2026-07-26T10:00:00.000Z",
        deleted_at: null,
        client_id: null,
        visual_opened_at: "2026-07-26T10:01:00.000Z",
        visual_expiration_policy: "keep_in_conversation",
      },
      "u1"
    );
    expect(mapped.visual).toMatchObject({
      mediaType: "video",
      caption: "keep",
      viewed: true,
      previewUrl: null,
      expirationPolicy: "keep_in_conversation",
    });
  });
});
