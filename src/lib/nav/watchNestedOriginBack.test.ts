import { beforeEach, describe, expect, it } from "vitest";

import {
  isTabContainerPrevious,
  resolveGlobalBack,
  shouldTrustHistoryBack,
} from "./globalBack";
import {
  rememberProfileBackContext,
  resetProfileBackContextForTests,
} from "./profileBackContext";
import {
  shouldInterceptWatchRootBack,
  VIDEO_HISTORY_STACK_GROWTH,
  watchVideoSwipeStackDelta,
} from "./watchRootExit";
import {
  FOLLOW_LIST_PATHS,
  STACKED_MEMBER_PROFILE_PATH,
  buildFollowListHref,
  buildFollowListMemberProfileHref,
} from "@/src/lib/profile/followListNav";
import {
  STACKED_PROFILE_PATH,
  buildStackedProfileHref,
} from "@/src/lib/profile/profileNav";
import { buildWatchCreatorProfileHref } from "@/src/lib/profile/watchAvatarHref";

const EMAN = "33333333-3333-4333-8333-333333333333";
const MEMBER = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  resetProfileBackContextForTests();
});

describe("WATCH_PROFILE_BACK_STATIC — Fold6 previous=(tabs) class", () => {
  it("does not history-back Watch → Profile onto the tab container", () => {
    const href = buildWatchCreatorProfileHref({
      id: EMAN,
      username: "@eman",
    });
    expect(href).toBe(`${STACKED_PROFILE_PATH}?u=eman&id=${EMAN}&from=watch`);
    expect(isTabContainerPrevious("(tabs)")).toBe(true);
    expect(
      shouldTrustHistoryBack({
        canGoBack: true,
        currentPath: "/profile/user",
        segments: ["profile", "user"],
        previousRouteName: "(tabs)",
        profileHasOtherUser: true,
        profileOrigin: "watch",
      })
    ).toBe(false);
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

  it("returns to Watch 5x without growing video history", () => {
    for (let i = 0; i < 5; i += 1) {
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
    }
    expect(VIDEO_HISTORY_STACK_GROWTH).toBe(0);
    expect(watchVideoSwipeStackDelta(5)).toBe(0);
  });

  it("still returns to Watch when from=watch is dropped but origin was remembered", () => {
    rememberProfileBackContext({
      origin: "watch",
      via: null,
      listId: null,
      listUsername: null,
      ownerId: EMAN,
      ownerUsername: "eman",
    });
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/profile/user",
        segments: ["profile", "user"],
        previousRouteName: "(tabs)",
        profileHasOtherUser: true,
      })
    ).toEqual({ action: "replace", href: "/(tabs)/watch" });
    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/profile",
        segments: ["(tabs)", "profile"],
        profileHasOtherUser: true,
      })
    ).toEqual({ action: "replace", href: "/(tabs)/watch" });
  });
});

describe("WATCH_FOLLOW_LIST_NAV_LOCK_STATIC", () => {
  it("unwinds member → list → originating Profile → Watch", () => {
    const ownerHref = buildWatchCreatorProfileHref({
      id: EMAN,
      username: "eman",
    });
    const listHref = buildFollowListHref({
      kind: "followers",
      targetUserId: EMAN,
      username: "eman",
      origin: "watch",
    });
    const memberHref = buildFollowListMemberProfileHref({
      userId: MEMBER,
      username: "ada",
      listKind: "followers",
      listOwnerId: EMAN,
      listOwnerUsername: "eman",
      origin: "watch",
    });
    expect(listHref).toBe(
      `${FOLLOW_LIST_PATHS.followers}?id=${EMAN}&u=eman&from=watch`
    );
    expect(memberHref?.startsWith(`${STACKED_MEMBER_PROFILE_PATH}?`)).toBe(true);
    expect(memberHref).not.toMatch(/^\/profile\?/);
    expect(memberHref).not.toBe(ownerHref);

    const memberParams = new URLSearchParams(memberHref!.split("?")[1]);
    expect(memberParams.get("from")).toBe("watch");
    expect(memberParams.get("via")).toBe("followers");
    expect(memberParams.get("listId")).toBe(EMAN);

    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/profile/member",
        segments: ["profile", "member"],
        previousRouteName: "profile/followers",
        profileHasOtherUser: true,
        profileOrigin: "watch",
        profileVia: "followers",
        profileListId: EMAN,
        profileListUsername: "eman",
      })
    ).toEqual({ action: "history-back" });

    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/profile/member",
        segments: ["profile", "member"],
        profileHasOtherUser: true,
        profileOrigin: "watch",
        profileVia: "followers",
        profileListId: EMAN,
        profileListUsername: "eman",
      })
    ).toEqual({
      action: "replace",
      href: `${FOLLOW_LIST_PATHS.followers}?id=${EMAN}&u=eman&from=watch`,
    });

    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/profile/followers",
        segments: ["profile", "followers"],
        previousRouteName: "profile/user",
        followListOwnerId: EMAN,
        followListOwnerUsername: "eman",
        profileOrigin: "watch",
      })
    ).toEqual({ action: "history-back" });

    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/profile/followers",
        segments: ["profile", "followers"],
        previousRouteName: "(tabs)",
        followListOwnerId: EMAN,
        followListOwnerUsername: "eman",
        profileOrigin: "watch",
      })
    ).toEqual({
      action: "replace",
      href: `${STACKED_PROFILE_PATH}?u=eman&id=${EMAN}&from=watch`,
    });

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

  it("does the same Following chain and does not skip to Watch from the list", () => {
    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/profile/member",
        segments: ["profile", "member"],
        profileHasOtherUser: true,
        profileOrigin: "watch",
        profileVia: "following",
        profileListId: EMAN,
        profileListUsername: "eman",
      })
    ).toEqual({
      action: "replace",
      href: `${FOLLOW_LIST_PATHS.following}?id=${EMAN}&u=eman&from=watch`,
    });
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/profile/following",
        segments: ["profile", "following"],
        previousRouteName: "(tabs)",
        followListOwnerId: EMAN,
        followListOwnerUsername: "eman",
        profileOrigin: "watch",
      })
    ).not.toEqual({ action: "replace", href: "/(tabs)/watch" });
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/profile/following",
        segments: ["profile", "following"],
        previousRouteName: "(tabs)",
        followListOwnerId: EMAN,
        followListOwnerUsername: "eman",
        profileOrigin: "watch",
      })
    ).toEqual({
      action: "replace",
      href: `${STACKED_PROFILE_PATH}?u=eman&id=${EMAN}&from=watch`,
    });
  });
});

describe("HOME_DISCOVER_PROFILE_ORIGIN_PRESERVED", () => {
  it("returns Home/Discover stacked Profile to Discover, not Watch", () => {
    const homeHref = buildStackedProfileHref({
      username: "eman",
      userId: EMAN,
      origin: "home",
    });
    expect(homeHref).toContain("from=home");
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
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/profile/user",
        segments: ["profile", "user"],
        previousRouteName: "(tabs)",
        profileHasOtherUser: true,
        profileOrigin: "discover",
      })
    ).toEqual({ action: "replace", href: "/(tabs)/discover" });
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
  });
});

describe("OWN_PROFILE_ORIGIN_PRESERVED", () => {
  it("keeps own Profile tab Back off Watch and restores the own tab from lists", () => {
    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/profile",
        segments: ["(tabs)", "profile"],
        profileHasOtherUser: false,
      })
    ).toEqual({ action: "noop" });
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/profile",
        segments: ["(tabs)", "profile"],
        previousRouteName: "watch",
        profileHasOtherUser: false,
      })
    ).toEqual({ action: "noop" });
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/profile/followers",
        segments: ["profile", "followers"],
        previousRouteName: "(tabs)",
        followListOwnerId: EMAN,
        followListOwnerUsername: "sam",
        profileOrigin: "profile",
      })
    ).toEqual({ action: "replace", href: "/(tabs)/profile" });
    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/profile/member",
        segments: ["profile", "member"],
        profileHasOtherUser: true,
        profileOrigin: "profile",
        profileVia: "followers",
        profileListId: EMAN,
        profileListUsername: "sam",
      })
    ).toEqual({
      action: "replace",
      href: `${FOLLOW_LIST_PATHS.followers}?id=${EMAN}&u=sam&from=profile`,
    });
  });
});

describe("ANDROID_AND_IOS_BACK_SEMANTICS_PRESERVED", () => {
  it("keeps Android Watch-root intercept and does not invent iOS hardware Back", () => {
    expect(shouldInterceptWatchRootBack("android")).toBe(true);
    expect(shouldInterceptWatchRootBack("ios")).toBe(false);
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
        currentPath: "/settings",
        segments: ["settings"],
        previousRouteName: "(tabs)",
      })
    ).toEqual({ action: "history-back" });
  });
});
