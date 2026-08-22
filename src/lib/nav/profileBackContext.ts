/**
 * Remembers Watch/Home/list origin across Expo Router param loss.
 * URL `from` / `via` still win when present. Own Profile tab never
 * inherits a stale Watch origin.
 */

import type { FollowListKind } from "@/src/lib/social/followLists";
import type { ProfileNavOrigin } from "@/src/lib/profile/profileNav";

export type ProfileBackContext = {
  origin: ProfileNavOrigin | null;
  via: FollowListKind | null;
  listId: string | null;
  listUsername: string | null;
  ownerId: string | null;
  ownerUsername: string | null;
};

const EMPTY: ProfileBackContext = {
  origin: null,
  via: null,
  listId: null,
  listUsername: null,
  ownerId: null,
  ownerUsername: null,
};

let context: ProfileBackContext = { ...EMPTY };

export function resetProfileBackContextForTests(): void {
  context = { ...EMPTY };
}

export function peekProfileBackContext(): ProfileBackContext {
  return { ...context };
}

export function rememberProfileBackContext(
  next: ProfileBackContext
): ProfileBackContext {
  context = { ...next };
  return peekProfileBackContext();
}

export function clearProfileBackContext(): void {
  context = { ...EMPTY };
}

export function isPrimaryTabHref(href: string): boolean {
  return (
    href === "/(tabs)/watch" ||
    href === "/(tabs)/discover" ||
    href === "/(tabs)/create" ||
    href === "/(tabs)/messages" ||
    href === "/(tabs)/profile" ||
    href === "/(tabs)/live"
  );
}
