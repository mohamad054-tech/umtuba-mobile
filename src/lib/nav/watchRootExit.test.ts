import { afterEach, describe, expect, it } from "vitest";

import { resolveGlobalBack } from "./globalBack";
import { resetProfileBackContextForTests } from "./profileBackContext";
import {
  VIDEO_HISTORY_STACK_GROWTH,
  WATCH_DOUBLE_BACK_TIMEOUT_MS,
  WATCH_ROOT_EXIT_MODEL,
  buildWatchEntryHref,
  isWatchExitHistoryPrevious,
  isWatchRootSurface,
  noteWatchNavPath,
  peekWatchEntryHref,
  resetWatchEntryContextForTests,
  WATCH_HEADER_ARROW_IN_APP_FALLBACK,
  resolveWatchExitNavigation,
  resolveWatchHeaderArrowNavigation,
  resolveWatchRootBack,
  shouldConsumeHardwareBack,
  shouldInterceptWatchRootBack,
  watchVideoSwipeStackDelta,
} from "./watchRootExit";

afterEach(() => {
  resetWatchEntryContextForTests();
  resetProfileBackContextForTests();
});

describe("watch root exit contract", () => {
  it("uses double-back-to-exit and never grows history per swipe", () => {
    expect(WATCH_ROOT_EXIT_MODEL).toBe("DOUBLE_BACK_TO_EXIT");
    expect(WATCH_DOUBLE_BACK_TIMEOUT_MS).toBe(1800);
    expect(WATCH_DOUBLE_BACK_TIMEOUT_MS).toBeGreaterThanOrEqual(1500);
    expect(WATCH_DOUBLE_BACK_TIMEOUT_MS).toBeLessThanOrEqual(2000);
    expect(VIDEO_HISTORY_STACK_GROWTH).toBe(0);
    expect(watchVideoSwipeStackDelta(0)).toBe(0);
    expect(watchVideoSwipeStackDelta(1)).toBe(0);
    expect(watchVideoSwipeStackDelta(50)).toBe(0);
  });

  it("treats Watch tab and deep-link post focus as the same root", () => {
    expect(isWatchRootSurface("/(tabs)/watch", ["(tabs)", "watch"])).toBe(true);
    expect(
      isWatchRootSurface("/(tabs)/watch?post=88", ["(tabs)", "watch"])
    ).toBe(true);
    expect(isWatchRootSurface("/watch?post=12")).toBe(true);
    expect(isWatchRootSurface("/profile", ["profile"])).toBe(false);
    expect(isWatchRootSurface("/(tabs)/discover", ["(tabs)", "discover"])).toBe(
      false
    );
  });
});

describe("resolveWatchRootBack", () => {
  it("ignores Back when not at Watch root", () => {
    expect(
      resolveWatchRootBack({
        nowMs: 1_000,
        armedUntilMs: null,
        nestedOverlayOpen: false,
        atWatchRoot: false,
      })
    ).toEqual({ action: "ignore" });
  });

  it("closes a nested overlay before arming exit", () => {
    expect(
      resolveWatchRootBack({
        nowMs: 1_000,
        armedUntilMs: 5_000,
        nestedOverlayOpen: true,
        atWatchRoot: true,
      })
    ).toEqual({ action: "close-nested" });
  });

  it("first Back arms exit and does not walk videos", () => {
    expect(
      resolveWatchRootBack({
        nowMs: 10_000,
        armedUntilMs: null,
        nestedOverlayOpen: false,
        atWatchRoot: true,
      })
    ).toEqual({
      action: "arm-exit",
      armedUntilMs: 10_000 + WATCH_DOUBLE_BACK_TIMEOUT_MS,
    });
  });

  it("second Back within the window exits", () => {
    const first = resolveWatchRootBack({
      nowMs: 10_000,
      armedUntilMs: null,
      nestedOverlayOpen: false,
      atWatchRoot: true,
    });
    expect(first.action).toBe("arm-exit");
    if (first.action !== "arm-exit") return;
    expect(
      resolveWatchRootBack({
        nowMs: 10_000 + 1_200,
        armedUntilMs: first.armedUntilMs,
        nestedOverlayOpen: false,
        atWatchRoot: true,
      })
    ).toEqual({ action: "exit" });
  });

  it("timeout clears the armed window so the next Back is a new first press", () => {
    const first = resolveWatchRootBack({
      nowMs: 10_000,
      armedUntilMs: null,
      nestedOverlayOpen: false,
      atWatchRoot: true,
    });
    expect(first.action).toBe("arm-exit");
    if (first.action !== "arm-exit") return;
    const late = resolveWatchRootBack({
      nowMs: first.armedUntilMs,
      armedUntilMs: first.armedUntilMs,
      nestedOverlayOpen: false,
      atWatchRoot: true,
    });
    expect(late).toEqual({
      action: "arm-exit",
      armedUntilMs: first.armedUntilMs + WATCH_DOUBLE_BACK_TIMEOUT_MS,
    });
  });
});

describe("watch entry context", () => {
  it("records Discover and returns there after Watch", () => {
    expect(
      noteWatchNavPath({
        path: "/discover",
        segments: ["(tabs)", "discover"],
      })
    ).toBe("/(tabs)/discover");
    expect(
      noteWatchNavPath({
        path: "/(tabs)/watch?post=9",
        segments: ["(tabs)", "watch"],
      })
    ).toBe("/(tabs)/discover");
    expect(peekWatchEntryHref()).toBe("/(tabs)/discover");
  });

  it("keeps the original entry when Watch opens nested Profile", () => {
    noteWatchNavPath({
      path: "/(tabs)/discover",
      segments: ["(tabs)", "discover"],
    });
    noteWatchNavPath({
      path: "/watch",
      segments: ["(tabs)", "watch"],
    });
    expect(
      noteWatchNavPath({
        path: "/profile",
        segments: ["profile"],
        query: { u: "lina.creates", id: "user-1" },
      })
    ).toBe("/(tabs)/discover");
    expect(peekWatchEntryHref()).toBe("/(tabs)/discover");
    expect(
      buildWatchEntryHref({
        path: "/profile",
        segments: ["profile"],
        query: { u: "lina.creates", id: "user-1" },
      })
    ).toBe("/profile?u=lina.creates&id=user-1");
  });

  it("records stack Profile as the Watch entry when opened from there", () => {
    expect(
      noteWatchNavPath({
        path: "/profile",
        segments: ["profile"],
        query: { u: "lina.creates" },
      })
    ).toBe("/profile?u=lina.creates");
    expect(
      noteWatchNavPath({
        path: "/(tabs)/watch",
        segments: ["(tabs)", "watch"],
      })
    ).toBe("/profile?u=lina.creates");
  });

  it("does not treat login or index as an exit destination", () => {
    expect(
      buildWatchEntryHref({
        path: "/(auth)/login",
        segments: ["(auth)", "login"],
      })
    ).toBeNull();
    expect(buildWatchEntryHref({ path: "/", segments: ["index"] })).toBeNull();
    expect(
      buildWatchEntryHref({
        path: "/(tabs)/watch?post=88",
        segments: ["(tabs)", "watch"],
      })
    ).toBeNull();
  });
});

describe("resolveWatchExitNavigation", () => {
  it("prefers a real stack previous over a recorded tab", () => {
    expect(
      resolveWatchExitNavigation({
        entryHref: "/(tabs)/discover",
        canGoBack: true,
        previousRouteName: "profile/index",
      })
    ).toEqual({ action: "history-back" });
  });

  it("replaces to the recorded entry when history is only index/tabs", () => {
    expect(isWatchExitHistoryPrevious("index")).toBe(false);
    expect(isWatchExitHistoryPrevious("(tabs)")).toBe(false);
    expect(
      resolveWatchExitNavigation({
        entryHref: "/(tabs)/create",
        canGoBack: true,
        previousRouteName: "index",
      })
    ).toEqual({ action: "replace", href: "/(tabs)/create" });
  });

  it("system-exits when Watch is the session root", () => {
    expect(
      resolveWatchExitNavigation({
        entryHref: null,
        canGoBack: true,
        previousRouteName: "index",
      })
    ).toEqual({ action: "system-exit" });
  });
});

describe("resolveWatchHeaderArrowNavigation", () => {
  it("exits on one tap using the same destinations as hardware exit", () => {
    expect(
      resolveWatchHeaderArrowNavigation({
        entryHref: "/(tabs)/discover",
        canGoBack: true,
        previousRouteName: "profile/index",
      })
    ).toEqual({ action: "history-back" });
    expect(
      resolveWatchHeaderArrowNavigation({
        entryHref: "/(tabs)/create",
        canGoBack: true,
        previousRouteName: "index",
      })
    ).toEqual({ action: "replace", href: "/(tabs)/create" });
  });

  it("never system-exits — session root replaces in-app to Discover", () => {
    expect(WATCH_HEADER_ARROW_IN_APP_FALLBACK).toBe("/(tabs)/discover");
    expect(
      resolveWatchHeaderArrowNavigation({
        entryHref: null,
        canGoBack: true,
        previousRouteName: "index",
      })
    ).toEqual({ action: "replace", href: "/(tabs)/discover" });
  });

  it("does not arm double-back", () => {
    const firstHardware = resolveWatchRootBack({
      nowMs: 10_000,
      armedUntilMs: null,
      nestedOverlayOpen: false,
      atWatchRoot: true,
    });
    expect(firstHardware.action).toBe("arm-exit");
    expect(
      resolveWatchHeaderArrowNavigation({
        entryHref: "/(tabs)/discover",
        canGoBack: false,
        previousRouteName: null,
      })
    ).toEqual({ action: "replace", href: "/(tabs)/discover" });
  });
});

describe("platform intercept", () => {
  it("intercepts Android hardware Back and leaves iOS alone", () => {
    expect(shouldInterceptWatchRootBack("android")).toBe(true);
    expect(shouldInterceptWatchRootBack("ios")).toBe(false);
    expect(
      shouldConsumeHardwareBack({ action: "arm-exit", armedUntilMs: 1 }, null)
    ).toBe(true);
    expect(
      shouldConsumeHardwareBack({ action: "exit" }, { action: "system-exit" })
    ).toBe(false);
    expect(
      shouldConsumeHardwareBack(
        { action: "exit" },
        { action: "replace", href: "/(tabs)/discover" }
      )
    ).toBe(true);
  });
});

describe("global Back elsewhere stays unchanged", () => {
  it("keeps Watch Global Back as noop; header arrow is a separate control", () => {
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/watch",
        segments: ["(tabs)", "watch"],
        previousRouteName: "index",
      })
    ).toEqual({ action: "noop" });
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/discover",
        segments: ["(tabs)", "discover"],
      })
    ).toEqual({ action: "noop" });
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/profile",
        segments: ["profile"],
        previousRouteName: "(tabs)",
        profileHasOtherUser: true,
        profileOrigin: "watch",
      })
    ).toEqual({ action: "replace", href: "/(tabs)/watch" });
  });
});
