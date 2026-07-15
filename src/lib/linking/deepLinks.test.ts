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
  });
});
