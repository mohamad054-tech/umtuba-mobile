import { describe, expect, it } from "vitest";

import { deepLinkToHref, parseDeepLink } from "./deepLinks";

describe("parseDeepLink", () => {
  it("parses watch with post id", () => {
    const parsed = parseDeepLink("umtuba://watch?post=42");
    expect(parsed.target).toEqual({ type: "watch", postId: 42 });
  });

  it("parses https invite and extracts referral", () => {
    const parsed = parseDeepLink("https://umtuba.com/invite/ABC123XY");
    expect(parsed.target).toEqual({ type: "invite", code: "ABC123XY" });
    expect(parsed.referralCode).toBe("ABC123XY");
  });

  it("parses profile, live, rewards, notifications", () => {
    expect(parseDeepLink("umtuba://profile/alice").target).toEqual({
      type: "profile",
      username: "alice",
    });
    expect(parseDeepLink("https://www.umtuba.com/live/room1").target).toEqual({
      type: "live",
      roomId: "room1",
    });
    expect(parseDeepLink("umtuba://rewards").target.type).toBe("rewards");
    expect(parseDeepLink("umtuba://notifications").target.type).toBe(
      "notifications"
    );
  });

  it("parses signup ref query", () => {
    const parsed = parseDeepLink("umtuba://signup?ref=ZZZZ9999");
    expect(parsed.target).toEqual({ type: "signup", ref: "ZZZZ9999" });
    expect(parsed.referralCode).toBe("ZZZZ9999");
  });

  it("parses password-reset deep links", () => {
    expect(parseDeepLink("umtuba://forgot-password").target.type).toBe(
      "forgot-password"
    );
    expect(parseDeepLink("umtuba://auth/update-password").target.type).toBe(
      "update-password"
    );
  });

  it("parses messages conversation deep links", () => {
    const conversationId = "11111111-1111-4111-8111-111111111111";
    const messageId = "22222222-2222-4222-8222-222222222222";
    const parsed = parseDeepLink(
      `umtuba://messages?conversation=${conversationId}&message=${messageId}`
    );
    expect(parsed.target).toEqual({
      type: "messages",
      conversationId,
      messageId,
      creatorId: null,
    });
  });
});

describe("deepLinkToHref", () => {
  it("maps targets to expo routes", () => {
    expect(deepLinkToHref({ type: "watch", postId: 7 })).toBe(
      "/(tabs)/watch?post=7"
    );
    expect(deepLinkToHref({ type: "invite", code: "ABC123" })).toBe(
      "/invite/ABC123"
    );
    expect(deepLinkToHref({ type: "rewards" })).toBe("/rewards");
    expect(deepLinkToHref({ type: "forgot-password" })).toBe(
      "/(auth)/forgot-password"
    );
    expect(deepLinkToHref({ type: "update-password" })).toBe(
      "/(auth)/forgot-password"
    );
    expect(
      deepLinkToHref({
        type: "messages",
        conversationId: "11111111-1111-4111-8111-111111111111",
        messageId: null,
        creatorId: null,
      })
    ).toBe("/messages/11111111-1111-4111-8111-111111111111");
  });
});
