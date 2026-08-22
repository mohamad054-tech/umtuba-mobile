import { normalizeUsername } from "@/src/contracts/validation";
import {
  STACKED_PROFILE_PATH,
  buildStackedProfileHref,
  parseProfileNavOrigin,
  type ProfileNavOrigin,
} from "@/src/lib/profile/profileNav";
import { parseProfileUserId } from "@/src/lib/profile/resolveTarget";
import type { FollowListKind } from "@/src/lib/social/followLists";

export const FOLLOW_LIST_PATHS = {
  followers: "/profile/followers",
  following: "/profile/following",
} as const;

/** Distinct from `/profile/user` so Expo can stack member on top of the owner. */
export const STACKED_MEMBER_PROFILE_PATH = "/profile/member" as const;

export function parseFollowListKind(
  raw: string | string[] | null | undefined
): FollowListKind | null {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase();
  return value === "followers" || value === "following" ? value : null;
}

function leafFromPath(path: string, segments?: readonly string[]): string {
  return (segments ?? path.split("/").filter(Boolean))
    .filter((part) => !part.startsWith("("))
    .join("/")
    .split("?")[0];
}

export function isFollowListPath(
  path: string,
  segments?: readonly string[]
): boolean {
  const leaf = leafFromPath(path, segments);
  return (
    leaf === "profile/followers" ||
    leaf === "profile/following" ||
    leaf.endsWith("/profile/followers") ||
    leaf.endsWith("/profile/following")
  );
}

export function followListKindFromPath(
  path: string,
  segments?: readonly string[]
): FollowListKind | null {
  const leaf = leafFromPath(path, segments);
  if (leaf === "profile/followers" || leaf.endsWith("/profile/followers")) {
    return "followers";
  }
  if (leaf === "profile/following" || leaf.endsWith("/profile/following")) {
    return "following";
  }
  return null;
}

export function buildFollowListHref(input: {
  kind: FollowListKind;
  targetUserId: string;
  username?: string | null;
  origin?: ProfileNavOrigin | null;
}): string | null {
  const userId = parseProfileUserId(input.targetUserId);
  if (!userId) return null;
  const params = new URLSearchParams();
  params.set("id", userId);
  const username = normalizeUsername(input.username ?? "");
  if (username) params.set("u", username);
  if (input.origin) params.set("from", input.origin);
  return `${FOLLOW_LIST_PATHS[input.kind]}?${params.toString()}`;
}

export function buildFollowListMemberProfileHref(input: {
  userId: string;
  username?: string | null;
  listKind: FollowListKind;
  listOwnerId: string;
  listOwnerUsername?: string | null;
  origin?: ProfileNavOrigin | null;
}): string | null {
  const origin = input.origin ?? "profile";
  const href = buildStackedProfileHref({
    username: input.username,
    userId: input.userId,
    origin,
  });
  if (!href) return null;
  const [, query] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("via", input.listKind);
  const listId = parseProfileUserId(input.listOwnerId);
  if (listId) params.set("listId", listId);
  const listUsername = normalizeUsername(input.listOwnerUsername ?? "");
  if (listUsername) params.set("listU", listUsername);
  return `${STACKED_MEMBER_PROFILE_PATH}?${params.toString()}`;
}

export function followListOwnerFallbackHref(input: {
  ownerId?: string | string[] | null;
  ownerUsername?: string | string[] | null;
  origin?: ProfileNavOrigin | string | null;
}): string | null {
  const origin = parseProfileNavOrigin(input.origin);
  if (origin === "profile") {
    return "/(tabs)/profile";
  }
  const ownerId = parseProfileUserId(input.ownerId);
  if (!ownerId) {
    return null;
  }
  const ownerUsername = Array.isArray(input.ownerUsername)
    ? input.ownerUsername[0]
    : input.ownerUsername;
  return buildStackedProfileHref({
    userId: ownerId,
    username: ownerUsername,
    origin: origin ?? "profile",
  });
}

export function followListViaFallbackHref(input: {
  via?: string | string[] | null;
  listOwnerId?: string | string[] | null;
  listOwnerUsername?: string | string[] | null;
  origin?: ProfileNavOrigin | string | null;
}): string | null {
  const kind = parseFollowListKind(input.via);
  const ownerId = parseProfileUserId(input.listOwnerId);
  if (!kind || !ownerId) return null;
  return buildFollowListHref({
    kind,
    targetUserId: ownerId,
    username:
      (Array.isArray(input.listOwnerUsername)
        ? input.listOwnerUsername[0]
        : input.listOwnerUsername) ?? null,
    origin: parseProfileNavOrigin(input.origin),
  });
}

export function isStackedProfileHref(href: string): boolean {
  return (
    href.startsWith(`${STACKED_PROFILE_PATH}?`) ||
    href.startsWith(`${STACKED_MEMBER_PROFILE_PATH}?`)
  );
}
