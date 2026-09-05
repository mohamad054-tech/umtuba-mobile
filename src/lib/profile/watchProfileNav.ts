import {
  resolveProfileTarget,
  type ProfileTarget,
} from "@/src/lib/profile/resolveTarget";
import { buildWatchCreatorProfileHref } from "@/src/lib/profile/watchAvatarHref";

export type WatchAuthorProfileNav =
  | { action: "none"; reason: "missing-author" }
  | { action: "push"; href: string; target: ProfileTarget };

/**
 * Watch name and avatar share this plan. Never silent-fallback to the
 * signed-in user when a distinct author is present. Missing author is a no-op.
 */
export function planWatchAuthorProfileNavigation(input: {
  author: { id?: string | null; username?: string | null };
  signedInUserId?: string | null;
  signedInUsername?: string | null;
}): WatchAuthorProfileNav {
  const href = buildWatchCreatorProfileHref(input.author);
  if (!href) {
    return { action: "none", reason: "missing-author" };
  }

  const query = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
  const params = new URLSearchParams(query);
  const target = resolveProfileTarget({
    queryUsername: params.get("u"),
    queryUserId: params.get("id"),
    signedInUsername: input.signedInUsername ?? null,
    signedInUserId: input.signedInUserId ?? null,
  });

  return { action: "push", href, target };
}
