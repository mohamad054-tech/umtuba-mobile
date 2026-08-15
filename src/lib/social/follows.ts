import type { SupabaseClient } from "@supabase/supabase-js";

import type { ActionResult } from "@/src/lib/social/interactions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type FollowSnapshot = {
  following: boolean;
  followersCount: number;
  followingCount: number;
};

export type WatchFollowLabel = "Follow" | "Following";

function cleanId(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isFollowTargetId(value: string | null | undefined): boolean {
  return UUID_RE.test(cleanId(value));
}

/**
 * Native Watch Follow is shown for another creator only.
 * Self-follow is never offered. Demo / missing ids hide the control.
 * Signed-out viewers still see Follow (action requires auth).
 */
export function canShowWatchFollowControl(input: {
  viewerId?: string | null;
  creatorId?: string | null;
}): boolean {
  const creatorId = cleanId(input.creatorId);
  if (!isFollowTargetId(creatorId)) return false;
  const viewerId = cleanId(input.viewerId);
  if (viewerId && viewerId === creatorId) return false;
  return true;
}

/**
 * Primary followed-state label is `Following`, never `Unfollow`.
 * Unfollow is the tap action on that followed-state control.
 */
export function resolveWatchFollowLabel(input: {
  following: boolean;
  pending?: boolean;
}): WatchFollowLabel {
  if (input.following) return "Following";
  return "Follow";
}

export function resolveWatchFollowAccessibilityHint(following: boolean): string {
  return following ? "Unfollow this creator" : "Follow this creator";
}

/**
 * Server result wins. A failed toggle must not report Following.
 */
export function applyFollowToggleResult(input: {
  previousFollowing: boolean;
  result: ActionResult<FollowSnapshot>;
}): { following: boolean; applied: boolean } {
  if (!input.result.ok) {
    return { following: input.previousFollowing, applied: false };
  }
  return { following: input.result.following, applied: true };
}

export function applyCreatorFollowState<
  T extends { author: { id: string | null; isFollowing?: boolean } },
>(videos: T[], creatorId: string, following: boolean): T[] {
  const id = cleanId(creatorId);
  if (!id) return videos;
  return videos.map((video) => {
    if (video.author.id !== id) return video;
    return {
      ...video,
      author: { ...video.author, isFollowing: following },
    };
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function parseSnapshot(data: unknown): FollowSnapshot {
  const row = asRecord(data);
  return {
    following: Boolean(row?.following),
    followersCount: parseCount(row?.followersCount ?? row?.followerscount),
    followingCount: parseCount(row?.followingCount ?? row?.followingcount),
  };
}

function followErrorMessage(
  error: { message?: string },
  fallback: string
): { message: string; requiresAuth?: boolean } {
  const message = (error.message || "").toLowerCase();
  if (message.includes("authentication required")) {
    return {
      message: "Please sign in to follow creators.",
      requiresAuth: true,
    };
  }
  if (message.includes("invalid follow target")) {
    return { message: "You can’t follow this account." };
  }
  if (message.includes("profile not found")) {
    return { message: "This profile is no longer available." };
  }
  return { message: fallback };
}

function isMissingRpcError(error: { message?: string; code?: string }): boolean {
  const message = (error.message || "").toLowerCase();
  return (
    error.code === "PGRST202" ||
    message.includes("could not find the function") ||
    message.includes("schema cache")
  );
}

async function loadFollowSnapshotFromTable(
  supabase: SupabaseClient,
  userId: string
): Promise<ActionResult<FollowSnapshot>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { count: followersCount, error: followersError },
    { count: followingCount, error: followingError },
  ] = await Promise.all([
    supabase
      .from("profile_follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", userId),
    supabase
      .from("profile_follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", userId),
  ]);

  if (followersError || followingError) {
    return { ok: false, message: "Unable to load follow status." };
  }

  let following = false;
  if (user?.id && user.id !== userId) {
    const { data: row, error: rowError } = await supabase
      .from("profile_follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", userId)
      .maybeSingle();
    if (rowError) {
      return { ok: false, message: "Unable to load follow status." };
    }
    following = Boolean(row);
  }

  return {
    ok: true,
    following,
    followersCount: followersCount ?? 0,
    followingCount: followingCount ?? 0,
  };
}

/** Batch: which of `candidateIds` the viewer already follows. */
export async function loadViewerFollowingSet(
  supabase: SupabaseClient,
  viewerId: string | null | undefined,
  candidateIds: string[]
): Promise<Set<string>> {
  const ids = [...new Set(candidateIds.filter((id) => isFollowTargetId(id)))];
  if (!viewerId || !isFollowTargetId(viewerId) || ids.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("profile_follows")
    .select("following_id")
    .eq("follower_id", viewerId)
    .in("following_id", ids);

  if (error) {
    console.error("loadViewerFollowingSet failed:", error);
    return new Set();
  }

  return new Set(
    (data ?? [])
      .map((row) =>
        typeof row.following_id === "string" ? row.following_id : null
      )
      .filter((id): id is string => Boolean(id))
  );
}

export async function getProfileFollowSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<ActionResult<FollowSnapshot>> {
  if (!isFollowTargetId(userId)) {
    return { ok: false, message: "Invalid user." };
  }

  const { data, error } = await supabase.rpc("get_profile_follow_snapshot", {
    p_user_id: userId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return loadFollowSnapshotFromTable(supabase, userId);
    }
    return {
      ok: false,
      ...followErrorMessage(error, "Unable to load follow status."),
    };
  }

  return { ok: true, ...parseSnapshot(data) };
}

export async function toggleProfileFollow(
  supabase: SupabaseClient,
  followingId: string,
  viewerId?: string | null
): Promise<ActionResult<FollowSnapshot>> {
  if (!isFollowTargetId(followingId)) {
    return { ok: false, message: "Invalid user." };
  }
  if (viewerId && cleanId(viewerId) === followingId) {
    return { ok: false, message: "You can’t follow yourself." };
  }

  const { data, error } = await supabase.rpc("toggle_profile_follow", {
    p_following_id: followingId,
  });

  if (error) {
    return {
      ok: false,
      ...followErrorMessage(error, "Unable to update follow."),
    };
  }

  const snapshot = parseSnapshot(data);
  if (
    asRecord(data)?.followersCount == null &&
    asRecord(data)?.followerscount == null
  ) {
    const counts = await loadFollowSnapshotFromTable(supabase, followingId);
    if (counts.ok) {
      return {
        ok: true,
        following: snapshot.following,
        followersCount: counts.followersCount,
        followingCount: counts.followingCount,
      };
    }
  }

  return { ok: true, ...snapshot };
}
