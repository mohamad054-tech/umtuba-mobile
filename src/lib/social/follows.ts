import type { SupabaseClient } from "@supabase/supabase-js";

export type FollowSnapshot = {
  following: boolean;
  followersCount: number;
  followingCount: number;
};

export type FollowActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; message: string; requiresAuth?: boolean };

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

/** Web Following pattern: never show Unfollow. */
export function followButtonLabel(following: boolean): "Follow" | "Following" {
  return following ? "Following" : "Follow";
}

export async function getProfileFollowSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<FollowActionResult<FollowSnapshot>> {
  const { data, error } = await supabase.rpc("get_profile_follow_snapshot", {
    p_user_id: userId,
  });

  if (error) {
    return {
      ok: false,
      ...followErrorMessage(error, "Unable to load follow status."),
    };
  }

  return { ok: true, ...parseSnapshot(data) };
}

export async function toggleProfileFollow(
  supabase: SupabaseClient,
  followingId: string
): Promise<FollowActionResult<FollowSnapshot>> {
  const { data, error } = await supabase.rpc("toggle_profile_follow", {
    p_following_id: followingId,
  });

  if (error) {
    return {
      ok: false,
      ...followErrorMessage(error, "Unable to update follow."),
    };
  }

  return { ok: true, ...parseSnapshot(data) };
}
