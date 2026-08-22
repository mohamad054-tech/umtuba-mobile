import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyGlobalBackDecision,
  hasValidWatchOriginUnderneath,
  previousTabNameFromState,
  resolveGlobalBack,
  shouldPopToMountedWatch,
  shouldTrustHistoryBack,
} from "./globalBack";
import {
  registerMountedWatchInstance,
  rememberProfileBackContext,
  resetProfileBackContextForTests,
} from "./profileBackContext";
import {
  FOLLOW_LIST_PATHS,
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

const WATCH_UNDER_PROFILE = {
  index: 1,
  routes: [
    {
      name: "(tabs)",
      state: {
        index: 0,
        routes: [
          { name: "watch" },
          { name: "discover" },
          { name: "profile" },
        ],
      },
    },
    { name: "profile/user" },
  ],
};

const PROFILE_TAB_UNDER_STACK = {
  index: 1,
  routes: [
    {
      name: "(tabs)",
      state: {
        index: 2,
        routes: [
          { name: "watch" },
          { name: "discover" },
          { name: "profile" },
        ],
      },
    },
    { name: "profile/user" },
  ],
};

function watchOriginProfileBack(extra: Record<string, unknown> = {}) {
  return {
    canGoBack: true,
    currentPath: "/profile/user",
    segments: ["profile", "user"],
    previousRouteName: "(tabs)",
    profileHasOtherUser: true,
    profileOrigin: "watch",
    ...extra,
  };
}

beforeEach(() => {
  resetProfileBackContextForTests();
});

describe("CASE A — Watch mounted/playing → other Profile → Back", () => {
  it("pops to the existing Watch instance when the Watch tab is still underneath", () => {
    expect(previousTabNameFromState(WATCH_UNDER_PROFILE)).toBe("watch");
    registerMountedWatchInstance();

    const input = watchOriginProfileBack({
      previousTabName: previousTabNameFromState(WATCH_UNDER_PROFILE),
      watchOriginUnderneath: true,
    });

    expect(hasValidWatchOriginUnderneath(input)).toBe(true);
    expect(shouldPopToMountedWatch(input)).toBe(true);
    expect(shouldTrustHistoryBack(input)).toBe(true);

    const decision = resolveGlobalBack(input);
    expect(decision).toEqual({ action: "history-back" });
    expect(decision).not.toEqual({ action: "replace", href: "/(tabs)/watch" });

    const nav = { back: vi.fn(), replace: vi.fn() };
    expect(applyGlobalBackDecision(decision, nav)).toBe("history-back");
    expect(nav.back).toHaveBeenCalledTimes(1);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("pops 5x to the same mounted Watch and never replaces/remounts it", () => {
    registerMountedWatchInstance();
    for (let i = 0; i < 5; i += 1) {
      const decision = resolveGlobalBack(
        watchOriginProfileBack({
          previousTabName: "watch",
          watchOriginUnderneath: true,
        })
      );
      expect(decision).toEqual({ action: "history-back" });
      const nav = { back: vi.fn(), replace: vi.fn() };
      applyGlobalBackDecision(decision, nav);
      expect(nav.back).toHaveBeenCalledTimes(1);
      expect(nav.replace).not.toHaveBeenCalled();
    }
  });

  it("does not treat replace-to-watch as a passing Watch return when Watch is underneath", () => {
    const href = buildWatchCreatorProfileHref({
      id: EMAN,
      username: "@eman",
    });
    expect(href).toBe(`${STACKED_PROFILE_PATH}?u=eman&id=${EMAN}&from=watch`);
    const decision = resolveGlobalBack(
      watchOriginProfileBack({
        previousRouteName: "watch",
        previousTabName: "watch",
        watchOriginUnderneath: true,
      })
    );
    expect(decision.action).toBe("history-back");
    expect(decision).not.toMatchObject({ href: "/(tabs)/watch" });
  });
});

describe("CASE B — Followers full chain ends at the same mounted Watch", () => {
  it("unwinds member → list → Profile, then pops Watch instead of remounting it", () => {
    registerMountedWatchInstance();
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
    expect(listHref).toContain("from=watch");
    expect(memberHref).toContain("via=followers");

    const memberBack = resolveGlobalBack({
      canGoBack: true,
      currentPath: "/profile/member",
      segments: ["profile", "member"],
      previousRouteName: "profile/followers",
      previousTabName: "watch",
      watchOriginUnderneath: true,
      profileHasOtherUser: true,
      profileOrigin: "watch",
      profileVia: "followers",
      profileListId: EMAN,
      profileListUsername: "eman",
    });
    expect(memberBack).toEqual({ action: "history-back" });
    expect(memberBack).not.toEqual({ action: "replace", href: "/(tabs)/watch" });

    const listBack = resolveGlobalBack({
      canGoBack: true,
      currentPath: "/profile/followers",
      segments: ["profile", "followers"],
      previousRouteName: "profile/user",
      previousTabName: "watch",
      watchOriginUnderneath: true,
      followListOwnerId: EMAN,
      followListOwnerUsername: "eman",
      profileOrigin: "watch",
    });
    expect(listBack).toEqual({ action: "history-back" });
    expect(listBack).not.toEqual({ action: "replace", href: "/(tabs)/watch" });

    const profileBack = resolveGlobalBack(
      watchOriginProfileBack({
        previousTabName: "watch",
        watchOriginUnderneath: true,
      })
    );
    expect(profileBack).toEqual({ action: "history-back" });
    const nav = { back: vi.fn(), replace: vi.fn() };
    applyGlobalBackDecision(profileBack, nav);
    expect(nav.back).toHaveBeenCalledTimes(1);
    expect(nav.replace).not.toHaveBeenCalled();
  });
});

describe("CASE C — Following full chain ends at the same mounted Watch", () => {
  it("does not collapse Following intermediates onto a Watch replace", () => {
    registerMountedWatchInstance();
    const memberBack = resolveGlobalBack({
      canGoBack: false,
      currentPath: "/profile/member",
      segments: ["profile", "member"],
      watchOriginUnderneath: true,
      previousTabName: "watch",
      profileHasOtherUser: true,
      profileOrigin: "watch",
      profileVia: "following",
      profileListId: EMAN,
      profileListUsername: "eman",
    });
    expect(memberBack).toEqual({
      action: "replace",
      href: `${FOLLOW_LIST_PATHS.following}?id=${EMAN}&u=eman&from=watch`,
    });
    expect(memberBack).not.toEqual({ action: "replace", href: "/(tabs)/watch" });

    const listBack = resolveGlobalBack({
      canGoBack: true,
      currentPath: "/profile/following",
      segments: ["profile", "following"],
      previousRouteName: "(tabs)",
      previousTabName: "watch",
      watchOriginUnderneath: true,
      followListOwnerId: EMAN,
      followListOwnerUsername: "eman",
      profileOrigin: "watch",
    });
    expect(listBack).toEqual({
      action: "replace",
      href: `${STACKED_PROFILE_PATH}?u=eman&id=${EMAN}&from=watch`,
    });
    expect(listBack).not.toEqual({ action: "replace", href: "/(tabs)/watch" });
    expect(listBack.action).not.toBe("history-back");

    const originBack = resolveGlobalBack(
      watchOriginProfileBack({
        previousTabName: "watch",
        watchOriginUnderneath: true,
      })
    );
    expect(originBack).toEqual({ action: "history-back" });
    expect(originBack).not.toEqual({ action: "replace", href: "/(tabs)/watch" });
  });
});

describe("CASE D — no valid Watch underneath → replace fallback remains", () => {
  it("replaces to Watch only when the instance is gone or history cannot pop", () => {
    expect(hasValidWatchOriginUnderneath(watchOriginProfileBack())).toBe(false);
    expect(shouldTrustHistoryBack(watchOriginProfileBack())).toBe(false);
    expect(resolveGlobalBack(watchOriginProfileBack())).toEqual({
      action: "replace",
      href: "/(tabs)/watch",
    });

    expect(
      resolveGlobalBack(
        watchOriginProfileBack({
          canGoBack: false,
          watchOriginUnderneath: false,
        })
      )
    ).toEqual({ action: "replace", href: "/(tabs)/watch" });

    registerMountedWatchInstance();
    expect(previousTabNameFromState(PROFILE_TAB_UNDER_STACK)).toBe("profile");
    const fold6 = resolveGlobalBack(
      watchOriginProfileBack({
        previousTabName: previousTabNameFromState(PROFILE_TAB_UNDER_STACK),
        watchOriginUnderneath: true,
      })
    );
    expect(fold6).toEqual({ action: "replace", href: "/(tabs)/watch" });
    const nav = { back: vi.fn(), replace: vi.fn() };
    applyGlobalBackDecision(fold6, nav);
    expect(nav.replace).toHaveBeenCalledWith("/(tabs)/watch");
    expect(nav.back).not.toHaveBeenCalled();
  });

  it("still returns to Watch when from=watch is dropped but no instance can be popped", () => {
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
        canGoBack: false,
        currentPath: "/profile/user",
        segments: ["profile", "user"],
        profileHasOtherUser: true,
      })
    ).toEqual({ action: "replace", href: "/(tabs)/watch" });
  });
});

describe("CASE E — Home/Discover and own-Profile origins preserved", () => {
  it("does not steal Home/Discover or own Profile Back onto Watch even if Watch is mounted", () => {
    registerMountedWatchInstance();
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
        previousTabName: "discover",
        watchOriginUnderneath: true,
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
        previousTabName: "discover",
        watchOriginUnderneath: true,
        profileHasOtherUser: true,
        profileOrigin: "discover",
      })
    ).toEqual({ action: "replace", href: "/(tabs)/discover" });
    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/profile",
        segments: ["(tabs)", "profile"],
        watchOriginUnderneath: true,
        profileHasOtherUser: false,
      })
    ).toEqual({ action: "noop" });
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/profile/followers",
        segments: ["profile", "followers"],
        previousRouteName: "(tabs)",
        previousTabName: "profile",
        watchOriginUnderneath: true,
        followListOwnerId: EMAN,
        followListOwnerUsername: "sam",
        profileOrigin: "profile",
      })
    ).toEqual({ action: "replace", href: "/(tabs)/profile" });
  });
});
