import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyGlobalBackDecision,
  resolveGlobalBack,
  type GlobalBackDecision,
} from "./globalBack";
import {
  peekProfileBackContext,
  registerMountedWatchInstance,
  rememberProfileBackContext,
  resetProfileBackContextForTests,
} from "./profileBackContext";
import {
  FOLLOW_LIST_PATHS,
  isFollowListPath,
  isStackedMemberProfilePath,
  buildFollowListHref,
  buildFollowListMemberProfileHref,
} from "@/src/lib/profile/followListNav";
import {
  STACKED_PROFILE_PATH,
  buildStackedProfileHref,
} from "@/src/lib/profile/profileNav";
import { buildWatchCreatorProfileHref } from "@/src/lib/profile/watchAvatarHref";
import type { FollowListKind } from "@/src/lib/social/followLists";

const EMAN = "33333333-3333-4333-8333-333333333333";
const MEMBER = "44444444-4444-4444-8444-444444444444";
const SAM = "11111111-1111-4111-8111-111111111111";

type Frame = {
  name: string;
  path: string;
  segments: string[];
  params: Record<string, string>;
  watchGeneration?: number;
};

function parseHref(href: string): Frame {
  const [rawPath, query = ""] = href.split("?");
  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const params = Object.fromEntries(new URLSearchParams(query));
  if (path === "/(tabs)/watch" || path === "/watch") {
    return {
      name: "(tabs)",
      path: "/watch",
      segments: ["(tabs)", "watch"],
      params,
    };
  }
  if (path === "/(tabs)/discover") {
    return {
      name: "(tabs)",
      path: "/discover",
      segments: ["(tabs)", "discover"],
      params,
    };
  }
  if (path === "/(tabs)/profile") {
    return {
      name: "(tabs)",
      path: "/profile",
      segments: ["(tabs)", "profile"],
      params,
    };
  }
  const leaf = path.replace(/^\//, "");
  return {
    name: leaf,
    path,
    segments: leaf.split("/"),
    params,
  };
}

function stackLevel(frame: Frame): number {
  if (isStackedMemberProfilePath(frame.path, frame.segments)) return 3;
  if (isFollowListPath(frame.path, frame.segments)) return 2;
  if (frame.path === "/profile/user" || frame.path === "/profile") return 1;
  return 0;
}

function resolveFromStack(stack: Frame[]): GlobalBackDecision {
  const current = stack[stack.length - 1];
  const previous = stack[stack.length - 2];
  const watchUnderneath = stack.some((frame) => frame.watchGeneration != null);
  const previousTabName =
    previous?.name === "(tabs)"
      ? (previous.segments[previous.segments.length - 1] ?? null)
      : null;
  return resolveGlobalBack({
    canGoBack: stack.length > 1,
    currentPath: current.path,
    segments: current.segments,
    previousRouteName: previous?.name ?? null,
    previousTabName,
    watchOriginUnderneath: watchUnderneath,
    profileHasOtherUser: Boolean(current.params.u || current.params.id),
    profileOrigin: current.params.from ?? null,
    profileVia: current.params.via ?? null,
    profileListId: current.params.listId ?? null,
    profileListUsername: current.params.listU ?? null,
    followListOwnerId: isFollowListPath(current.path, current.segments)
      ? (current.params.id ?? null)
      : null,
    followListOwnerUsername: isFollowListPath(current.path, current.segments)
      ? (current.params.u ?? null)
      : null,
  });
}

function applyToStack(
  stack: Frame[],
  decision: GlobalBackDecision
): { remountedWatch: boolean; duplicateReentry: boolean } {
  const beforeWatch = stack.find((frame) => frame.watchGeneration != null);
  const namesBefore = stack.map((frame) => frame.name);
  if (decision.action === "history-back") {
    stack.pop();
    return { remountedWatch: false, duplicateReentry: false };
  }
  if (decision.action === "replace") {
    const next = parseHref(decision.href);
    const replacingWatch = next.path === "/watch" && beforeWatch != null;
    stack.pop();
    if (replacingWatch) {
      stack.push({ ...next });
      return { remountedWatch: true, duplicateReentry: false };
    }
    const primaryTabAlreadyUnderneath =
      (next.path === "/watch" ||
        next.path === "/discover" ||
        next.path === "/profile") &&
      stack.some((frame) => frame.path === next.path);
    if (primaryTabAlreadyUnderneath) {
      return { remountedWatch: false, duplicateReentry: false };
    }
    const duplicateReentry = namesBefore.slice(0, -1).includes(next.name);
    stack.push(next);
    return { remountedWatch: false, duplicateReentry };
  }
  return { remountedWatch: false, duplicateReentry: false };
}

function unwind(stack: Frame[]): {
  paths: string[];
  levels: number[];
  oscillation: boolean;
  remountedWatch: boolean;
  duplicateReentry: boolean;
} {
  const paths: string[] = [];
  const levels: number[] = [];
  let remountedWatch = false;
  let duplicateReentry = false;
  let steps = 0;
  while (stack.length > 1 && steps < 10) {
    const decision = resolveFromStack(stack);
    if (decision.action === "noop") break;
    const applied = applyToStack(stack, decision);
    remountedWatch = remountedWatch || applied.remountedWatch;
    duplicateReentry = duplicateReentry || applied.duplicateReentry;
    const top = stack[stack.length - 1];
    paths.push(top.path);
    levels.push(stackLevel(top));
    steps += 1;
  }
  let oscillation = false;
  for (let i = 0; i + 3 < paths.length; i += 1) {
    if (
      paths[i] === paths[i + 2] &&
      paths[i + 1] === paths[i + 3] &&
      paths[i] !== paths[i + 1]
    ) {
      oscillation = true;
    }
  }
  return { paths, levels, oscillation, remountedWatch, duplicateReentry };
}

function pushWatchOriginChain(kind: FollowListKind, stack: Frame[]): void {
  const ownerHref = buildWatchCreatorProfileHref({
    id: EMAN,
    username: "eman",
  });
  const listHref = buildFollowListHref({
    kind,
    targetUserId: EMAN,
    username: "eman",
    origin: "watch",
  });
  const memberHref = buildFollowListMemberProfileHref({
    userId: MEMBER,
    username: "ada",
    listKind: kind,
    listOwnerId: EMAN,
    listOwnerUsername: "eman",
    origin: "watch",
  });
  expect(ownerHref).toBe(`${STACKED_PROFILE_PATH}?u=eman&id=${EMAN}&from=watch`);
  expect(listHref).toBe(`${FOLLOW_LIST_PATHS[kind]}?id=${EMAN}&u=eman&from=watch`);
  expect(memberHref?.startsWith("/profile/member?")).toBe(true);
  expect(memberHref).not.toBe(ownerHref);

  rememberProfileBackContext({
    origin: "watch",
    via: null,
    listId: null,
    listUsername: null,
    ownerId: EMAN,
    ownerUsername: "eman",
  });
  stack.push(parseHref(ownerHref!));

  rememberProfileBackContext({
    origin: "watch",
    via: null,
    listId: null,
    listUsername: null,
    ownerId: EMAN,
    ownerUsername: "eman",
  });
  stack.push(parseHref(listHref!));

  rememberProfileBackContext({
    origin: "watch",
    via: kind,
    listId: EMAN,
    listUsername: "eman",
    ownerId: EMAN,
    ownerUsername: "eman",
  });
  stack.push(parseHref(memberHref!));
}

beforeEach(() => {
  resetProfileBackContextForTests();
});

describe("FOLLOWERS_FULL_STACK — Watch origin", () => {
  it("unwinds member → same Followers → originating Profile → same Watch instance", () => {
    const watchGeneration = registerMountedWatchInstance();
    const stack: Frame[] = [
      {
        name: "(tabs)",
        path: "/watch",
        segments: ["(tabs)", "watch"],
        params: {},
        watchGeneration,
      },
    ];
    pushWatchOriginChain("followers", stack);
    expect(stack.map((frame) => frame.name)).toEqual([
      "(tabs)",
      "profile/user",
      "profile/followers",
      "profile/member",
    ]);
    expect(peekProfileBackContext().via).toBe("followers");

    const result = unwind(stack);

    expect(result.oscillation).toBe(false);
    expect(result.duplicateReentry).toBe(false);
    expect(result.remountedWatch).toBe(false);
    expect(result.paths).toEqual(["/profile/followers", "/profile/user", "/watch"]);
    expect(result.levels).toEqual([2, 1, 0]);
    expect(stack).toHaveLength(1);
    expect(stack[0].watchGeneration).toBe(watchGeneration);
    expect(stack[0].path).toBe("/watch");
  });
});

describe("FOLLOWING_FULL_STACK — Watch origin", () => {
  it("unwinds member → same Following → originating Profile → same Watch instance", () => {
    const watchGeneration = registerMountedWatchInstance();
    const stack: Frame[] = [
      {
        name: "(tabs)",
        path: "/watch",
        segments: ["(tabs)", "watch"],
        params: {},
        watchGeneration,
      },
    ];
    pushWatchOriginChain("following", stack);
    expect(peekProfileBackContext().via).toBe("following");

    const result = unwind(stack);

    expect(result.oscillation).toBe(false);
    expect(result.duplicateReentry).toBe(false);
    expect(result.remountedWatch).toBe(false);
    expect(result.paths).toEqual(["/profile/following", "/profile/user", "/watch"]);
    expect(result.levels).toEqual([2, 1, 0]);
    expect(stack).toHaveLength(1);
    expect(stack[0].watchGeneration).toBe(watchGeneration);
  });
});

describe("FOLLOW_LIST_PROFILE_OSCILLATION — leftover member via", () => {
  it("does not send originating Profile Back to the list after a member visit", () => {
    registerMountedWatchInstance();
    rememberProfileBackContext({
      origin: "watch",
      via: "followers",
      listId: EMAN,
      listUsername: "eman",
      ownerId: EMAN,
      ownerUsername: "eman",
    });

    const decision = resolveGlobalBack({
      canGoBack: true,
      currentPath: "/profile/user",
      segments: ["profile", "user"],
      previousRouteName: "(tabs)",
      previousTabName: "watch",
      watchOriginUnderneath: true,
      profileHasOtherUser: true,
      profileOrigin: "watch",
    });

    expect(decision).toEqual({ action: "history-back" });
    expect(decision).not.toEqual({
      action: "replace",
      href: `${FOLLOW_LIST_PATHS.followers}?id=${EMAN}&u=eman&from=watch`,
    });

    const nav = { back: vi.fn(), replace: vi.fn() };
    applyGlobalBackDecision(decision, nav);
    expect(nav.back).toHaveBeenCalledTimes(1);
    expect(nav.replace).not.toHaveBeenCalled();
  });
});

describe("HOME_DISCOVER_ORIGIN — follow-list chain", () => {
  it("returns Home/Discover → Profile → Followers → member to Discover, not Watch", () => {
    registerMountedWatchInstance();
    const ownerHref = buildStackedProfileHref({
      username: "eman",
      userId: EMAN,
      origin: "home",
    });
    const listHref = buildFollowListHref({
      kind: "followers",
      targetUserId: EMAN,
      username: "eman",
      origin: "home",
    });
    const memberHref = buildFollowListMemberProfileHref({
      userId: MEMBER,
      username: "ada",
      listKind: "followers",
      listOwnerId: EMAN,
      listOwnerUsername: "eman",
      origin: "home",
    });
    const stack: Frame[] = [
      {
        name: "(tabs)",
        path: "/discover",
        segments: ["(tabs)", "discover"],
        params: {},
      },
    ];
    rememberProfileBackContext({
      origin: "home",
      via: null,
      listId: null,
      listUsername: null,
      ownerId: EMAN,
      ownerUsername: "eman",
    });
    stack.push(parseHref(ownerHref!));
    rememberProfileBackContext({
      origin: "home",
      via: null,
      listId: null,
      listUsername: null,
      ownerId: EMAN,
      ownerUsername: "eman",
    });
    stack.push(parseHref(listHref!));
    rememberProfileBackContext({
      origin: "home",
      via: "followers",
      listId: EMAN,
      listUsername: "eman",
      ownerId: EMAN,
      ownerUsername: "eman",
    });
    stack.push(parseHref(memberHref!));

    const result = unwind(stack);
    expect(result.oscillation).toBe(false);
    expect(result.paths).toEqual([
      "/profile/followers",
      "/profile/user",
      "/discover",
    ]);
    expect(result.paths).not.toContain("/watch");
    expect(stack[0].path).toBe("/discover");
  });
});

describe("OWN_PROFILE_ORIGIN — follow-list chain", () => {
  it("returns own Profile → Following → member to the own Profile tab, not Watch", () => {
    registerMountedWatchInstance();
    const listHref = buildFollowListHref({
      kind: "following",
      targetUserId: SAM,
      username: "sam",
      origin: "profile",
    });
    const memberHref = buildFollowListMemberProfileHref({
      userId: MEMBER,
      username: "ada",
      listKind: "following",
      listOwnerId: SAM,
      listOwnerUsername: "sam",
      origin: "profile",
    });
    const stack: Frame[] = [
      {
        name: "(tabs)",
        path: "/profile",
        segments: ["(tabs)", "profile"],
        params: {},
      },
    ];
    rememberProfileBackContext({
      origin: "profile",
      via: null,
      listId: null,
      listUsername: null,
      ownerId: SAM,
      ownerUsername: "sam",
    });
    stack.push(parseHref(listHref!));
    rememberProfileBackContext({
      origin: "profile",
      via: "following",
      listId: SAM,
      listUsername: "sam",
      ownerId: SAM,
      ownerUsername: "sam",
    });
    stack.push(parseHref(memberHref!));

    const result = unwind(stack);
    expect(result.oscillation).toBe(false);
    expect(result.paths).toEqual(["/profile/following", "/profile"]);
    expect(result.paths).not.toContain("/watch");
    expect(stack[0].path).toBe("/profile");
  });
});
