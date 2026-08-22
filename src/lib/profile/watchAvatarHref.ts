import { buildStackedProfileHref } from "@/src/lib/profile/profileNav";

/**
 * Watch creator/avatar → ROOT STACK Profile (`/profile/user`), never the
 * Profile tab. `/profile?u=` is captured by `/(tabs)/profile` and Back
 * cannot return to Watch.
 */
export function buildWatchCreatorProfileHref(author: {
  id?: string | null;
  username?: string | null;
}): string | null {
  return buildStackedProfileHref({
    username: author.username,
    userId: author.id,
    origin: "watch",
  });
}
