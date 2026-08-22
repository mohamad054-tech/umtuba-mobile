/**
 * Other-user Profile must open on the ROOT STACK, not the Profile tab.
 *
 * `router.push("/profile?u=")` from Watch/Discover is captured by
 * `app/(tabs)/profile` (same leaf name). Back then looks like a tab-root
 * other-user and Global Back used to replace to `/(tabs)/profile` — the
 * Watch → @eman → Back FAIL.
 *
 * `/profile/user` exists only on the root stack (`app/profile/user.tsx`).
 */

import { normalizeUsername } from "@/src/contracts/validation";
import { parseProfileUserId } from "@/src/lib/profile/resolveTarget";

export const STACKED_PROFILE_PATH = "/profile/user" as const;

export const PROFILE_NAV_ORIGINS = [
  "watch",
  "discover",
  "search",
  "home",
  "messages",
  "notifications",
  "world",
  "profile",
] as const;

export type ProfileNavOrigin = (typeof PROFILE_NAV_ORIGINS)[number];

export function parseProfileNavOrigin(
  raw: string | string[] | null | undefined
): ProfileNavOrigin | null {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase();
  if (!value) return null;
  return (PROFILE_NAV_ORIGINS as readonly string[]).includes(value)
    ? (value as ProfileNavOrigin)
    : null;
}

export function profileOriginFallbackHref(
  origin: ProfileNavOrigin | null | undefined
): string | null {
  switch (origin) {
    case "watch":
      return "/(tabs)/watch";
    case "discover":
    case "search":
    case "home":
      return "/(tabs)/discover";
    case "messages":
      return "/(tabs)/messages";
    case "notifications":
      return "/notifications";
    case "world":
      return "/world";
    case "profile":
      return "/(tabs)/profile";
    default:
      return null;
  }
}

export function isStackedProfilePath(
  path: string,
  segments?: readonly string[]
): boolean {
  const leaf = (segments ?? path.split("/").filter(Boolean))
    .filter((part) => !part.startsWith("("))
    .join("/")
    .split("?")[0];
  return (
    leaf === "profile/user" ||
    leaf === "profile/member" ||
    leaf.endsWith("profile/user") ||
    leaf.endsWith("profile/member")
  );
}

export function buildStackedProfileHref(input: {
  username?: string | null;
  userId?: string | null;
  origin: ProfileNavOrigin;
}): string | null {
  const userId = parseProfileUserId(input.userId);
  const username = normalizeUsername(input.username ?? "");
  if (!userId && !username) {
    return null;
  }
  const params = new URLSearchParams();
  if (username) params.set("u", username);
  if (userId) params.set("id", userId);
  params.set("from", input.origin);
  return `${STACKED_PROFILE_PATH}?${params.toString()}`;
}

export function hasOtherUserProfileQuery(input: {
  u?: string | string[] | null;
  id?: string | string[] | null;
}): boolean {
  const username = (Array.isArray(input.u) ? input.u[0] : input.u)?.trim();
  if (username) return true;
  return parseProfileUserId(input.id) != null;
}
