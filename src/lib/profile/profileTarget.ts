/**
 * Pure navigation-target resolvers for opening a content owner's profile from
 * Watch (and honoring that identity on the profile screen).
 *
 * The Watch feed can show content owned by another user. Tapping the owner's
 * name/avatar must open THAT owner's public profile, never the signed-in
 * viewer's own profile. These helpers keep the identity binding explicit and
 * unit-testable, independent of React Native / expo-router.
 */

export type WatchProfileOwner = {
  /** Stable owner user id (profiles.id). Null for demo content. */
  id: string | null;
  /** Owner username, may include a leading "@". */
  username: string;
};

export type ProfileNavParams = {
  /** Owner username without leading "@". Omitted when unavailable. */
  u?: string;
  /** Stable owner user id. Omitted when unavailable. */
  uid?: string;
};

export type ProfileScreenIdentity =
  | { mode: "self" }
  | { mode: "other"; userId: string | null; username: string | null };

export type WatchSafetyTarget = {
  postId: number | null;
  userId: string | null;
  displayName: string | null;
};

export function normalizeProfileUsername(
  username: string | null | undefined
): string {
  if (typeof username !== "string") return "";
  return username.trim().replace(/^@+/, "").trim();
}

function cleanId(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * expo-router / deep-link params may be `string` or `string[]`.
 * `umtuba://profile?u=eman` must resolve to the requested username.
 */
export function firstRouteParam(
  value: string | string[] | null | undefined
): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    const trimmed = value[0].trim();
    return trimmed || null;
  }
  return null;
}

/**
 * Build the query params used to open a content owner's profile. Prefers the
 * stable owner id (`uid`) and includes the username (`u`) for display.
 */
export function resolveWatchProfileNavParams(
  owner: WatchProfileOwner
): ProfileNavParams {
  const params: ProfileNavParams = {};
  const uid = cleanId(owner.id);
  if (uid) params.uid = uid;
  const username = normalizeProfileUsername(owner.username);
  if (username) params.u = username;
  return params;
}

/**
 * Build an expo-router href for a content owner's profile, or null when the
 * owner has no usable identity (e.g. demo content with no id/username).
 */
export function buildWatchProfileHref(owner: WatchProfileOwner): string | null {
  const params = resolveWatchProfileNavParams(owner);
  const parts: string[] = [];
  if (params.uid) parts.push(`uid=${encodeURIComponent(params.uid)}`);
  if (params.u) parts.push(`u=${encodeURIComponent(params.u)}`);
  if (parts.length === 0) return null;
  return `/profile?${parts.join("&")}`;
}

/**
 * Decide whether the profile screen should show the signed-in viewer's own
 * profile or another user's public profile, from the incoming route params.
 *
 * The owner id (`uid`) is authoritative: if it is present and differs from the
 * viewer id, the target is another user even when a username collides.
 */
export function resolveProfileScreenIdentity(input: {
  paramUserId?: string | null;
  paramUsername?: string | null;
  viewerId?: string | null;
  viewerUsername?: string | null;
}): ProfileScreenIdentity {
  const paramId = cleanId(input.paramUserId);
  const paramUsername = normalizeProfileUsername(input.paramUsername);

  // No target in the route → the viewer's own profile.
  if (!paramId && !paramUsername) {
    return { mode: "self" };
  }

  const viewerId = cleanId(input.viewerId);
  const viewerUsername = normalizeProfileUsername(input.viewerUsername);

  if (paramId) {
    if (viewerId && paramId === viewerId) {
      return { mode: "self" };
    }
    return { mode: "other", userId: paramId, username: paramUsername || null };
  }

  // Username-only target: treat as self only when it matches the viewer.
  if (
    viewerUsername &&
    paramUsername.toLowerCase() === viewerUsername.toLowerCase()
  ) {
    return { mode: "self" };
  }
  return { mode: "other", userId: null, username: paramUsername };
}

/**
 * Resolve the Report/Block safety target for a Watch item. The target is always
 * the content owner (author), never the signed-in viewer.
 */
export function resolveWatchSafetyTarget(video: {
  postId: number | null;
  author: { id: string | null; username: string };
}): WatchSafetyTarget {
  return {
    postId: video.postId,
    userId: video.author.id,
    displayName: video.author.username,
  };
}
