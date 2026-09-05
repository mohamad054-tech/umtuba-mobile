import { normalizeUsername } from "@/src/contracts/validation";
import { parseProfileUserId } from "@/src/lib/profile/resolveTarget";

/**
 * Watch creator/avatar → stack Profile.
 * Prefer posts.user_id (profiles.id). Keep ?u= for deep-link compatibility.
 */
export function buildWatchCreatorProfileHref(author: {
  id?: string | null;
  username?: string | null;
}): string | null {
  const userId = parseProfileUserId(author.id);
  const username = normalizeUsername(author.username ?? "");
  if (!userId && !username) {
    return null;
  }

  const params = new URLSearchParams();
  if (username) params.set("u", username);
  if (userId) params.set("id", userId);
  return `/profile?${params.toString()}`;
}
