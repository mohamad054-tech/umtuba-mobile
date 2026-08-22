import { describe, expect, it, vi } from "vitest";

import {
  GLOBAL_HEADER_LAYOUT_DIRECTION,
  GLOBAL_STACK_HEADER_OPTIONS,
  applyGlobalBackDecision,
  classifySurface,
  globalHeaderBackSlot,
  isInternalRouteName,
  isRedirectOnlyRoute,
  isValidHistoryPrevious,
  normalizeNavPath,
  parentFallbackHref,
  previousRouteNameFromState,
  resolveGlobalBack,
  sanitizeBackLabel,
} from "./globalBack";

describe("normalizeNavPath", () => {
  it("strips groups, query, and trailing slashes", () => {
    expect(normalizeNavPath("/(tabs)/watch?post=42")).toBe("/watch");
    expect(normalizeNavPath("/(auth)/login")).toBe("/login");
    expect(normalizeNavPath("settings/")).toBe("/settings");
  });
});

describe("internal route labels", () => {
  it("treats Expo group names as internal and never user-facing", () => {
    expect(isInternalRouteName("(tabs)")).toBe(true);
    expect(isInternalRouteName("(auth)")).toBe(true);
    expect(isInternalRouteName("Settings")).toBe(false);
    expect(sanitizeBackLabel("(tabs)")).toBe("");
    expect(sanitizeBackLabel("Watch")).toBe("");
    expect(GLOBAL_STACK_HEADER_OPTIONS.headerBackTitle).toBe("");
    expect(GLOBAL_STACK_HEADER_OPTIONS.headerBackTitleVisible).toBe(false);
    expect(GLOBAL_STACK_HEADER_OPTIONS.headerBackButtonDisplayMode).toBe(
      "minimal"
    );
    expect(GLOBAL_STACK_HEADER_OPTIONS.headerBackVisible).toBe(false);
    expect(GLOBAL_STACK_HEADER_OPTIONS.direction).toBe(
      GLOBAL_HEADER_LAYOUT_DIRECTION
    );
    expect(GLOBAL_STACK_HEADER_OPTIONS.headerLeftContainerStyle).toEqual({
      direction: "ltr",
    });
    expect(GLOBAL_STACK_HEADER_OPTIONS.headerRightContainerStyle).toEqual({
      direction: "ltr",
    });
    expect(globalHeaderBackSlot(false)).toBe("left");
    expect(globalHeaderBackSlot(true)).toBe("right");
    // IdentityHeader uses the same slot so EN keeps the arrow leading-left
    // and AR places it trailing-right without I18nManager double-flip.
    expect(isRedirectOnlyRoute("(tabs)")).toBe(false);
    expect(isRedirectOnlyRoute("index")).toBe(true);
    expect(isValidHistoryPrevious("(tabs)", "/settings")).toBe(true);
  });
});

describe("classifySurface", () => {
  it("classifies primary tabs as root, including Watch post-focus", () => {
    for (const leaf of ["watch", "discover", "create", "messages", "profile", "live"]) {
      expect(
        classifySurface({ path: `/${leaf}`, segments: ["(tabs)", leaf] })
      ).toBe("root");
    }
    expect(
      classifySurface({
        path: "/(tabs)/watch?post=99",
        segments: ["(tabs)", "watch"],
      })
    ).toBe("root");
  });

  it("classifies stack profile and conversation as secondary", () => {
    expect(classifySurface({ path: "/profile", segments: ["profile"] })).toBe(
      "secondary"
    );
    expect(
      classifySurface({
        path: "/profile/user",
        segments: ["profile", "user"],
      })
    ).toBe("secondary");
    expect(
      classifySurface({
        path: "/messages/abc-1",
        segments: ["messages", "abc-1"],
      })
    ).toBe("secondary");
    expect(
      classifySurface({ path: "/settings", segments: ["settings"] })
    ).toBe("secondary");
  });

  it("classifies login as auth-root and other auth screens as secondary", () => {
    expect(
      classifySurface({ path: "/(auth)/login", segments: ["(auth)", "login"] })
    ).toBe("auth-root");
    expect(
      classifySurface({ path: "/(auth)/signup", segments: ["(auth)", "signup"] })
    ).toBe("secondary");
  });
});

describe("resolveGlobalBack", () => {
  it("no-ops on root tabs even when the stack can go back to index", () => {
    const decision = resolveGlobalBack({
      canGoBack: true,
      currentPath: "/watch",
      segments: ["(tabs)", "watch"],
      previousRouteName: "index",
    });
    expect(decision).toEqual({ action: "noop" });
  });

  it("no-ops on Discover / Create / Messages / Profile tabs", () => {
    for (const leaf of ["discover", "create", "messages", "profile"]) {
      expect(
        resolveGlobalBack({
          canGoBack: true,
          currentPath: `/${leaf}`,
          segments: ["(tabs)", leaf],
          previousRouteName: "(tabs)",
        })
      ).toEqual({ action: "noop" });
    }
  });

  it("keeps Watch post-focus on the same screen", () => {
    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/(tabs)/watch?post=7",
        segments: ["(tabs)", "watch"],
      })
    ).toEqual({ action: "noop" });
  });

  it("follows history from World, Notifications, and Conversation", () => {
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/world",
        segments: ["world"],
        previousRouteName: "(tabs)",
      })
    ).toEqual({ action: "history-back" });
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/notifications",
        segments: ["notifications"],
        previousRouteName: "(tabs)",
      })
    ).toEqual({ action: "history-back" });
  });

  it("follows history from Settings when previous is the tab container", () => {
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/settings",
        segments: ["settings"],
        previousRouteName: "(tabs)",
      })
    ).toEqual({ action: "history-back" });
  });

  it("does not history-back from Settings onto index", () => {
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/settings",
        segments: ["settings"],
        previousRouteName: "index",
      })
    ).toEqual({ action: "replace", href: "/(tabs)/profile" });
  });

  it("replaces conversation to Messages when there is no history", () => {
    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/messages/11111111-1111-1111-1111-111111111111",
        segments: ["messages", "11111111-1111-1111-1111-111111111111"],
      })
    ).toEqual({ action: "replace", href: "/(tabs)/messages" });
  });

  it("follows history from conversation when a valid previous exists", () => {
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/messages/abc",
        segments: ["messages", "abc"],
        previousRouteName: "(tabs)",
      })
    ).toEqual({ action: "history-back" });
  });

  it("prevents same-route history loops", () => {
    expect(isValidHistoryPrevious("settings", "/settings")).toBe(false);
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/settings",
        segments: ["settings"],
        previousRouteName: "settings",
      })
    ).toEqual({ action: "replace", href: "/(tabs)/profile" });
  });

  it("no-ops on login so the app never exits from the auth root", () => {
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/login",
        segments: ["(auth)", "login"],
        previousRouteName: "index",
      })
    ).toEqual({ action: "noop" });
  });

  it("sends signup back to login when history is missing", () => {
    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/(auth)/signup",
        segments: ["(auth)", "signup"],
      })
    ).toEqual({ action: "replace", href: "/(auth)/login" });
  });

  it("clears other-user query on the Profile tab without leaving the tab", () => {
    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/profile",
        segments: ["(tabs)", "profile"],
        profileHasOtherUser: true,
      })
    ).toEqual({ action: "replace", href: "/(tabs)/profile" });
  });

  it("sends stack other-user Profile back through history or Watch", () => {
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/profile",
        segments: ["profile"],
        previousRouteName: "(tabs)",
        profileHasOtherUser: true,
      })
    ).toEqual({ action: "history-back" });
    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/profile",
        segments: ["profile"],
        profileHasOtherUser: true,
      })
    ).toEqual({ action: "replace", href: "/(tabs)/watch" });
  });

  it("never applies a history-back that would exit the app", () => {
    const nav = { back: vi.fn(), replace: vi.fn() };
    const action = applyGlobalBackDecision(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/watch",
        segments: ["(tabs)", "watch"],
        previousRouteName: "index",
      }),
      nav
    );
    expect(action).toBe("noop");
    expect(nav.back).not.toHaveBeenCalled();
    expect(nav.replace).not.toHaveBeenCalled();
  });
});

describe("parentFallbackHref", () => {
  it("maps secondary screens to a stable in-app parent", () => {
    expect(parentFallbackHref("/settings")).toBe("/(tabs)/profile");
    expect(parentFallbackHref("/language")).toBe("/settings");
    expect(parentFallbackHref("/world")).toBe("/(tabs)/discover");
    expect(parentFallbackHref("/messages/xyz")).toBe("/(tabs)/messages");
    expect(parentFallbackHref("/(auth)/forgot-password")).toBe("/(auth)/login");
  });
});

describe("previousRouteNameFromState", () => {
  it("reads the prior stack entry", () => {
    expect(
      previousRouteNameFromState({
        index: 1,
        routes: [{ name: "(tabs)" }, { name: "settings" }],
      })
    ).toBe("(tabs)");
    expect(
      previousRouteNameFromState({
        index: 0,
        routes: [{ name: "(tabs)" }],
      })
    ).toBeNull();
  });
});
