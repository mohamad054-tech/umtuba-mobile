import { describe, expect, it } from "vitest";

import {
  isAllowedPushUrl,
  parsePushPayload,
  resolvePushNavigationHref,
} from "@/src/lib/push/parsePayload";
import { notificationToHref } from "@/src/lib/push/navigation";
import {
  deepLinkToHref,
  parseDeepLink,
} from "@/src/lib/linking/deepLinks";

const resolver = {
  resolveUrl: (url: string) => {
    const parsed = parseDeepLink(url);
    if (parsed.target.type === "unknown") return null;
    return deepLinkToHref(parsed.target);
  },
};

describe("parsePushPayload", () => {
  it("parses generic category and deep link fields without hardcoding types", () => {
    const payload = parsePushPayload({
      title: "Hello",
      body: "World",
      data: {
        category: "future.custom.event",
        url: "umtuba://messages?conversation=11111111-1111-4111-8111-111111111111",
        customFlag: "1",
      },
    });

    expect(payload.category).toBe("future.custom.event");
    expect(payload.title).toBe("Hello");
    expect(payload.body).toBe("World");
    expect(payload.url).toContain("messages");
    expect(payload.data.customFlag).toBe("1");
  });

  it("accepts nested payload objects and path fallbacks", () => {
    const payload = parsePushPayload({
      data: {
        payload: {
          type: "reward.claim",
          path: "rewards",
        },
      },
    });
    expect(payload.category).toBe("reward.claim");
    expect(payload.path).toBe("rewards");
  });
});

describe("isAllowedPushUrl / resolvePushNavigationHref", () => {
  it("allows app and umtuba hosts only", () => {
    expect(isAllowedPushUrl("umtuba://notifications")).toBe(true);
    expect(isAllowedPushUrl("https://umtuba.com/rewards")).toBe(true);
    expect(isAllowedPushUrl("https://evil.example/phish")).toBe(false);
    expect(isAllowedPushUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedPushUrl("intent://scan")).toBe(false);
  });

  it("routes url payloads through deep-link parsing", () => {
    const payload = parsePushPayload({
      data: { url: "umtuba://notifications" },
    });
    expect(resolvePushNavigationHref(payload, resolver)).toBe("/notifications");
  });

  it("normalizes relative paths via umtuba scheme", () => {
    const payload = parsePushPayload({
      data: { path: "rewards" },
    });
    expect(resolvePushNavigationHref(payload, resolver)).toBe("/rewards");
  });

  it("rejects external schemes and unknown routes", () => {
    expect(
      resolvePushNavigationHref(
        parsePushPayload({ data: { url: "https://evil.example/x" } }),
        resolver
      )
    ).toBeNull();
    expect(
      resolvePushNavigationHref(
        parsePushPayload({ data: { path: "not-a-real-route-zzz" } }),
        resolver
      )
    ).toBeNull();
    expect(
      resolvePushNavigationHref(
        parsePushPayload({ data: { category: "noop" } }),
        resolver
      )
    ).toBeNull();
  });
});

describe("notificationToHref", () => {
  it("falls back to /notifications when payload has no route", () => {
    const href = notificationToHref({
      date: Date.now(),
      request: {
        identifier: "1",
        content: {
          title: "Ping",
          body: "No route",
          data: { category: "system.ping" },
          sound: null,
        },
        trigger: null,
      },
    } as never);
    expect(href).toBe("/notifications");
  });

  it("opens message threads from tap payloads", () => {
    const conversationId = "11111111-1111-4111-8111-111111111111";
    const href = notificationToHref({
      date: Date.now(),
      request: {
        identifier: "2",
        content: {
          title: "Message",
          body: "Hi",
          data: {
            category: "message.new",
            url: `umtuba://messages?conversation=${conversationId}`,
          },
          sound: null,
        },
        trigger: null,
      },
    } as never);
    expect(href).toBe(`/messages/${conversationId}`);
  });

  it("does not navigate to external URLs", () => {
    const href = notificationToHref({
      date: Date.now(),
      request: {
        identifier: "3",
        content: {
          title: "Phish",
          body: "No",
          data: { url: "https://evil.example/steal" },
          sound: null,
        },
        trigger: null,
      },
    } as never);
    expect(href).toBe("/notifications");
  });
});
