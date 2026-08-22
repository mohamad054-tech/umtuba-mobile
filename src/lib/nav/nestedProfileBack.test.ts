import { beforeEach, describe, expect, it } from "vitest";

import { resetProfileBackContextForTests } from "./profileBackContext";

import { resolveGlobalBack } from "./globalBack";
import {
  VIDEO_HISTORY_STACK_GROWTH,
  watchVideoSwipeStackDelta,
  resolveWatchRootBack,
  shouldInterceptWatchRootBack,
} from "./watchRootExit";
import { buildWatchCreatorProfileHref } from "@/src/lib/profile/watchAvatarHref";
import {
  STACKED_PROFILE_PATH,
  buildStackedProfileHref,
  parseProfileNavOrigin,
  profileOriginFallbackHref,
} from "@/src/lib/profile/profileNav";
import { resolveProfileTarget } from "@/src/lib/profile/resolveTarget";
import { planWatchSignedUrlWork } from "@/src/lib/feed/signedUrlScheduler";
import { watchWindowMountedIndexes } from "@/src/lib/watch/playerLifecycle";

const EMAN = {
  username: "eman",
  userId: "33333333-3333-4333-8333-333333333333",
};
const VIEWER = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  resetProfileBackContextForTests();
});

describe("1 Watch -> @eman Profile -> Back -> Watch", () => {
  it("opens the stack route and origin-backs to Watch when previous is (tabs)", () => {
    const href = buildWatchCreatorProfileHref({
      id: EMAN.userId,
      username: `@${EMAN.username}`,
    });
    expect(href).toBe(
      `${STACKED_PROFILE_PATH}?u=eman&id=${EMAN.userId}&from=watch`
    );
    expect(href).not.toMatch(/^\/profile\?/);
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/profile/user",
        segments: ["profile", "user"],
        previousRouteName: "(tabs)",
        profileHasOtherUser: true,
        profileOrigin: "watch",
      })
    ).toEqual({ action: "replace", href: "/(tabs)/watch" });
  });
});

describe("2 Watch context preserved", () => {
  it("returns to the Watch tab without remounting via tab replace when history is missing", () => {
    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/profile/user",
        segments: ["profile", "user"],
        profileHasOtherUser: true,
        profileOrigin: "watch",
      })
    ).toEqual({ action: "replace", href: "/(tabs)/watch" });
    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/profile",
        segments: ["(tabs)", "profile"],
        profileHasOtherUser: true,
        profileOrigin: "watch",
      })
    ).toEqual({ action: "replace", href: "/(tabs)/watch" });
  });
});

describe("3 Home -> Profile -> Back -> Home", () => {
  it("does not send own Profile tab Back to Watch", () => {
    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/profile",
        segments: ["(tabs)", "profile"],
        profileHasOtherUser: false,
      })
    ).toEqual({ action: "noop" });
    const href = buildStackedProfileHref({
      username: "eman",
      userId: EMAN.userId,
      origin: "home",
    });
    expect(href).toContain("from=home");
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/profile/user",
        segments: ["profile", "user"],
        previousRouteName: "(tabs)",
        profileHasOtherUser: true,
        profileOrigin: "home",
      })
    ).toEqual({ action: "replace", href: "/(tabs)/discover" });
    expect(profileOriginFallbackHref("home")).toBe("/(tabs)/discover");
  });
});

describe("4 Search/Discover -> Profile -> Back correct origin", () => {
  it("returns to Discover for search and discover origins", () => {
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/profile/user",
        segments: ["profile", "user"],
        previousRouteName: "(tabs)",
        profileHasOtherUser: true,
        profileOrigin: "search",
      })
    ).toEqual({ action: "replace", href: "/(tabs)/discover" });
    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/profile/user",
        segments: ["profile", "user"],
        profileHasOtherUser: true,
        profileOrigin: "discover",
      })
    ).toEqual({ action: "replace", href: "/(tabs)/discover" });
    expect(profileOriginFallbackHref("search")).toBe("/(tabs)/discover");
  });
});

describe("5 Watch -> Profile -> Follow -> Back -> Watch", () => {
  it("keeps targeting and Watch origin after follow stays on the same route", () => {
    const href = buildWatchCreatorProfileHref({
      id: EMAN.userId,
      username: "eman",
    });
    const params = new URLSearchParams(href!.split("?")[1]);
    expect(
      resolveProfileTarget({
        queryUsername: params.get("u"),
        queryUserId: params.get("id"),
        signedInUsername: "sam",
        signedInUserId: VIEWER,
      })
    ).toEqual({
      kind: "other",
      username: "eman",
      userId: EMAN.userId,
    });
    expect(parseProfileNavOrigin(params.get("from"))).toBe("watch");
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/profile/user",
        segments: ["profile", "user"],
        previousRouteName: "(tabs)",
        profileHasOtherUser: true,
        profileOrigin: "watch",
      })
    ).toEqual({ action: "replace", href: "/(tabs)/watch" });
  });
});

describe("6 Repeated Watch -> Profile -> Back x5", () => {
  it("returns to Watch each time and does not grow video history", () => {
    const stack = ["watch"];
    for (let i = 0; i < 5; i += 1) {
      stack.push("profile/user");
      const decision = resolveGlobalBack({
        canGoBack: stack.length > 1,
        currentPath: "/profile/user",
        segments: ["profile", "user"],
        previousRouteName: "(tabs)",
        profileHasOtherUser: true,
        profileOrigin: "watch",
      });
      expect(decision).toEqual({ action: "replace", href: "/(tabs)/watch" });
      stack.pop();
    }
    expect(stack).toEqual(["watch"]);
    expect(VIDEO_HISTORY_STACK_GROWTH).toBe(0);
    expect(watchVideoSwipeStackDelta(5)).toBe(0);
  });
});

describe("7 Android double-back Watch root PRESERVED", () => {
  it("still arms then exits on Android hardware Back at Watch root", () => {
    expect(shouldInterceptWatchRootBack("android")).toBe(true);
    const first = resolveWatchRootBack({
      nowMs: 1_000,
      armedUntilMs: null,
      nestedOverlayOpen: false,
      atWatchRoot: true,
    });
    expect(first.action).toBe("arm-exit");
    const second = resolveWatchRootBack({
      nowMs: 1_400,
      armedUntilMs: first.action === "arm-exit" ? first.armedUntilMs : null,
      nestedOverlayOpen: false,
      atWatchRoot: true,
    });
    expect(second.action).toBe("exit");
  });
});

describe("8 iOS Watch navigation PRESERVED", () => {
  it("does not intercept iOS hardware Back at Watch root", () => {
    expect(shouldInterceptWatchRootBack("ios")).toBe(false);
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/watch",
        segments: ["(tabs)", "watch"],
        previousRouteName: "index",
      })
    ).toEqual({ action: "noop" });
  });
});

describe("9 other-user Profile targeting PRESERVED", () => {
  it("keeps @eman as other, not the signed-in viewer", () => {
    const href = buildWatchCreatorProfileHref({
      id: EMAN.userId,
      username: "@eman",
    });
    const params = new URLSearchParams(href!.split("?")[1]);
    expect(
      resolveProfileTarget({
        queryUsername: params.get("u"),
        queryUserId: params.get("id"),
        signedInUsername: "sam",
        signedInUserId: VIEWER,
      }).kind
    ).toBe("other");
  });
});

describe("10 signed URL / one-active-player PRESERVED", () => {
  it("does not change active-first signing or Android one-player mount", () => {
    const plan = planWatchSignedUrlWork({
      videos: Array.from({ length: 12 }, (_, i) => ({
        id: `post-${i + 1}`,
        videoPath: `owner/${i + 1}.mp4`,
        src: "",
      })),
      activeIndex: 0,
    });
    expect(plan.active?.id).toBe("post-1");
    expect(plan.all.length).toBeLessThan(12);
    expect(watchWindowMountedIndexes(2, 6, "android")).toEqual([2]);
    expect(watchWindowMountedIndexes(2, 6, "ios").length).toBeLessThanOrEqual(3);
  });
});
