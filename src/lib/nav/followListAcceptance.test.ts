import { beforeEach, describe, expect, it } from "vitest";

import { planWatchSignedUrlWork } from "@/src/lib/feed/signedUrlScheduler";
import {
  FOLLOW_LIST_PATHS,
  STACKED_MEMBER_PROFILE_PATH,
  buildFollowListHref,
  buildFollowListMemberProfileHref,
} from "@/src/lib/profile/followListNav";
import { STACKED_PROFILE_PATH } from "@/src/lib/profile/profileNav";
import { resolveProfileTarget } from "@/src/lib/profile/resolveTarget";
import { buildWatchCreatorProfileHref } from "@/src/lib/profile/watchAvatarHref";
import {
  FOLLOW_LIST_PAGE_SIZE,
  listFollowRelations,
  planFollowListQuery,
  resolveFollowListOpenTarget,
  resolveFollowListTargetUserId,
} from "@/src/lib/social/followLists";
import {
  followButtonLabel,
  toggleProfileFollow,
} from "@/src/lib/social/follows";
import { watchWindowMountedIndexes } from "@/src/lib/watch/playerLifecycle";

import {
  classifySurface,
  parentFallbackHref,
  resolveGlobalBack,
} from "./globalBack";
import { resetProfileBackContextForTests } from "./profileBackContext";

const OWN = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const MEMBER = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  resetProfileBackContextForTests();
});

function followQueryClient(kind: "followers" | "following", target: string) {
  const eqCalls: Array<[string, string]> = [];
  const builder = {
    select: () => builder,
    eq: (col: string, val: string) => {
      eqCalls.push([col, val]);
      return builder;
    },
    order: () => builder,
    range: async () => ({
      data:
        kind === "followers"
          ? [{ follower_id: MEMBER, created_at: "2026-08-22T10:00:00Z" }]
          : [{ following_id: MEMBER, created_at: "2026-08-22T10:00:00Z" }],
      error: null,
    }),
  };
  const profiles = {
    select: () => profiles,
    in: async () => ({
      data: [
        {
          id: MEMBER,
          username: "ada",
          display_name: "Ada",
          full_name: "Ada",
          avatar_url: null,
          avatar_initial: "A",
        },
      ],
      error: null,
    }),
  };
  return {
    eqCalls,
    target,
    client: {
      from: (table: string) =>
        table === "profile_follows" ? builder : profiles,
    },
  };
}

describe("FOLLOWERS_OWN_PROFILE", () => {
  it("lists accounts that follow the explicit own profile id", async () => {
    const target = resolveFollowListOpenTarget({
      isOwn: true,
      ownUserId: OWN,
      otherUserId: OTHER,
    });
    expect(target).toBe(OWN);
    expect(planFollowListQuery("followers").targetColumn).toBe("following_id");
    const href = buildFollowListHref({
      kind: "followers",
      targetUserId: target!,
      username: "sam",
      origin: "profile",
    });
    expect(href).toBe(
      `${FOLLOW_LIST_PATHS.followers}?id=${OWN}&u=sam&from=profile`
    );
    const mock = followQueryClient("followers", OWN);
    const page = await listFollowRelations(mock.client as never, {
      targetUserId: OWN,
      kind: "followers",
    });
    expect(mock.eqCalls).toEqual([["following_id", OWN]]);
    expect(page.members.map((row) => row.userId)).toEqual([MEMBER]);
  });
});

describe("FOLLOWING_OWN_PROFILE", () => {
  it("lists accounts the explicit own profile id follows", async () => {
    const target = resolveFollowListOpenTarget({
      isOwn: true,
      ownUserId: OWN,
      otherUserId: OTHER,
    });
    expect(target).toBe(OWN);
    expect(planFollowListQuery("following").targetColumn).toBe("follower_id");
    const mock = followQueryClient("following", OWN);
    const page = await listFollowRelations(mock.client as never, {
      targetUserId: OWN,
      kind: "following",
    });
    expect(mock.eqCalls).toEqual([["follower_id", OWN]]);
    expect(page.members.map((row) => row.userId)).toEqual([MEMBER]);
  });
});

describe("FOLLOWERS_OTHER_PROFILE", () => {
  it("lists followers of the other profile, not the viewer", async () => {
    const target = resolveFollowListOpenTarget({
      isOwn: false,
      ownUserId: OWN,
      otherUserId: OTHER,
    });
    expect(target).toBe(OTHER);
    expect(
      resolveFollowListTargetUserId({
        queryUserId: OTHER,
        signedInUserId: OWN,
      })
    ).toBe(OTHER);
    const href = buildFollowListHref({
      kind: "followers",
      targetUserId: OTHER,
      username: "eman",
      origin: "watch",
    });
    expect(href).toContain(`id=${OTHER}`);
    expect(href).not.toContain(OWN);
    const mock = followQueryClient("followers", OTHER);
    await listFollowRelations(mock.client as never, {
      targetUserId: OTHER,
      kind: "followers",
    });
    expect(mock.eqCalls).toEqual([["following_id", OTHER]]);
    expect(mock.eqCalls[0]?.[1]).not.toBe(OWN);
  });
});

describe("FOLLOWING_OTHER_PROFILE", () => {
  it("lists accounts the other profile follows, not the viewer", async () => {
    const target = resolveFollowListOpenTarget({
      isOwn: false,
      ownUserId: OWN,
      otherUserId: OTHER,
    });
    expect(target).toBe(OTHER);
    const mock = followQueryClient("following", OTHER);
    await listFollowRelations(mock.client as never, {
      targetUserId: OTHER,
      kind: "following",
    });
    expect(mock.eqCalls).toEqual([["follower_id", OTHER]]);
    expect(mock.eqCalls[0]?.[1]).not.toBe(OWN);
  });
});

describe("LIST_USER_TO_PROFILE", () => {
  it("opens the stacked member profile, not the Profile tab", () => {
    const href = buildFollowListMemberProfileHref({
      userId: MEMBER,
      username: "ada",
      listKind: "followers",
      listOwnerId: OTHER,
      listOwnerUsername: "eman",
      origin: "watch",
    });
    expect(href).toContain(`${STACKED_MEMBER_PROFILE_PATH}?`);
    expect(href).not.toMatch(/^\/profile\?/);
    expect(href).not.toContain("/(tabs)/profile");
    expect(href).not.toContain("/profile/user?");
    const params = new URLSearchParams(href!.split("?")[1]);
    expect(params.get("id")).toBe(MEMBER);
    expect(params.get("via")).toBe("followers");
    expect(params.get("listId")).toBe(OTHER);
    expect(params.get("from")).toBe("watch");
    expect(
      resolveProfileTarget({
        queryUsername: params.get("u"),
        queryUserId: params.get("id"),
        signedInUsername: "sam",
        signedInUserId: OWN,
      })
    ).toEqual({ kind: "other", username: "ada", userId: MEMBER });
  });
});

describe("BACK_TO_ORIGIN_PROFILE", () => {
  it("returns list → originating profile, not Watch or own tab on Watch origin", () => {
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: "/profile/followers",
        segments: ["profile", "followers"],
        previousRouteName: "profile/user",
        followListOwnerId: OTHER,
        followListOwnerUsername: "eman",
        profileOrigin: "watch",
      })
    ).toEqual({ action: "history-back" });

    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/profile/followers",
        segments: ["profile", "followers"],
        followListOwnerId: OTHER,
        followListOwnerUsername: "eman",
        profileOrigin: "watch",
      })
    ).toEqual({
      action: "replace",
      href: `${STACKED_PROFILE_PATH}?u=eman&id=${OTHER}&from=watch`,
    });

    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/profile/following",
        segments: ["profile", "following"],
        followListOwnerId: OWN,
        followListOwnerUsername: "sam",
        profileOrigin: "profile",
      })
    ).toEqual({ action: "replace", href: "/(tabs)/profile" });

    const memberHref = buildFollowListMemberProfileHref({
      userId: MEMBER,
      username: "ada",
      listKind: "followers",
      listOwnerId: OTHER,
      listOwnerUsername: "eman",
      origin: "watch",
    });
    const memberParams = new URLSearchParams(memberHref!.split("?")[1]);
    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/profile/member",
        segments: ["profile", "member"],
        profileHasOtherUser: true,
        profileOrigin: memberParams.get("from"),
        profileVia: memberParams.get("via"),
        profileListId: memberParams.get("listId"),
        profileListUsername: memberParams.get("listU"),
      })
    ).toEqual({
      action: "replace",
      href: `${FOLLOW_LIST_PATHS.followers}?id=${OTHER}&u=eman&from=watch`,
    });
  });
});

describe("WATCH_PROFILE_BACK_REGRESSION", () => {
  it("keeps Watch → /profile/user?from=watch → Back on the stack", () => {
    const href = buildWatchCreatorProfileHref({
      id: OTHER,
      username: "eman",
    });
    expect(href).toBe(
      `${STACKED_PROFILE_PATH}?u=eman&id=${OTHER}&from=watch`
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
    expect(
      classifySurface({
        path: "/profile/followers",
        segments: ["profile", "followers"],
      })
    ).toBe("secondary");
  });
});

describe("FOLLOW_STATE_REGRESSION", () => {
  it("keeps Follow/Following labels and toggle RPC", async () => {
    expect(followButtonLabel(false)).toBe("Follow");
    expect(followButtonLabel(true)).toBe("Following");
    expect(followButtonLabel(true)).not.toBe("Unfollow");
    const rpc = async (name: string, args: { p_following_id: string }) => {
      expect(name).toBe("toggle_profile_follow");
      expect(args.p_following_id).toBe(OTHER);
      return {
        data: { following: true, followersCount: 5, followingCount: 1 },
        error: null,
      };
    };
    const result = await toggleProfileFollow({ rpc } as never, OTHER);
    expect(result).toEqual({
      ok: true,
      following: true,
      followersCount: 5,
      followingCount: 1,
    });
    const href = buildWatchCreatorProfileHref({
      id: OTHER,
      username: "eman",
    });
    const params = new URLSearchParams(href!.split("?")[1]);
    expect(params.get("from")).toBe("watch");
    expect(
      resolveProfileTarget({
        queryUsername: params.get("u"),
        queryUserId: params.get("id"),
        signedInUsername: "sam",
        signedInUserId: OWN,
      }).kind
    ).toBe("other");
  });
});

describe("PROFILE_TARGETING_REGRESSION", () => {
  it("keeps id-first targeting and refuses own-profile list fallback", () => {
    expect(
      resolveProfileTarget({
        queryUsername: "eman",
        queryUserId: OTHER,
        signedInUsername: "sam",
        signedInUserId: OWN,
      })
    ).toEqual({ kind: "other", username: "eman", userId: OTHER });
    expect(
      resolveFollowListTargetUserId({
        queryUserId: undefined,
        signedInUserId: OWN,
      })
    ).toBeNull();
    expect(
      resolveFollowListOpenTarget({
        isOwn: false,
        ownUserId: OWN,
        otherUserId: null,
      })
    ).toBeNull();
  });
});

describe("WATCH_CONTEXT_AND_TAB_LOCKS", () => {
  it("does not collide with the Profile tab or replace Watch lists to own Profile", () => {
    const listHref = buildFollowListHref({
      kind: "followers",
      targetUserId: OTHER,
      username: "eman",
      origin: "watch",
    });
    expect(listHref).toMatch(/^\/profile\/followers\?/);
    expect(listHref).not.toMatch(/^\/profile\?/);
    expect(
      parentFallbackHref("/profile/followers", ["profile", "followers"])
    ).toBeNull();
    const listBack = resolveGlobalBack({
      canGoBack: false,
      currentPath: "/profile/followers",
      segments: ["profile", "followers"],
      followListOwnerId: OTHER,
      profileOrigin: "watch",
    });
    expect(listBack).not.toEqual({
      action: "replace",
      href: "/(tabs)/profile",
    });
    expect(listBack).not.toEqual({
      action: "replace",
      href: "/(tabs)/watch",
    });
    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: "/profile",
        segments: ["(tabs)", "profile"],
        profileHasOtherUser: false,
      })
    ).toEqual({ action: "noop" });
  });

  it("keeps signed-URL fanout, Android one-player, and iOS ±1 mount", () => {
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
    expect(FOLLOW_LIST_PAGE_SIZE).toBeLessThanOrEqual(30);
  });
});
