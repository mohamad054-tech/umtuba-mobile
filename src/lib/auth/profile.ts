import type { SupabaseClient, User } from "@supabase/supabase-js";

import { normalizeUsername } from "@/src/contracts/validation";
import type { UserProfile } from "@/src/lib/auth/types";
import { getSupabase } from "@/src/lib/supabase/client";

const PROFILE_COLUMNS =
  "id, username, display_name, full_name, bio, city, country, avatar_url, avatar_initial";

function mapProfileRow(row: {
  id: string;
  username: string;
  display_name: string | null;
  full_name: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  avatar_url: string | null;
  avatar_initial: string | null;
}): UserProfile {
  const displayName =
    (row.display_name && row.display_name.trim()) ||
    (row.full_name && row.full_name.trim()) ||
    row.username;

  return {
    id: row.id,
    username: row.username,
    display_name: displayName,
    full_name: row.full_name || displayName,
    bio: row.bio,
    city: row.city,
    country: row.country,
    avatar_url: row.avatar_url,
    avatar_initial:
      row.avatar_initial || displayName.charAt(0).toUpperCase() || "U",
  };
}

export async function getProfileForUser(user: User): Promise<UserProfile> {
  const supabase = getSupabase();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Unable to load profile row:", profileError);
  } else if (profile) {
    return mapProfileRow(profile as Parameters<typeof mapProfileRow>[0]);
  }

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name
        : user.email?.split("@")[0] || "UMTUBA User";

  const username =
    typeof user.user_metadata?.username === "string"
      ? normalizeUsername(user.user_metadata.username)
      : `user_${user.id.slice(0, 8)}`;

  return {
    id: user.id,
    username,
    display_name: fullName,
    full_name: fullName,
    bio: null,
    city: null,
    country: null,
    avatar_url: null,
    avatar_initial: fullName.charAt(0).toUpperCase() || "U",
  };
}

/**
 * Load another user's public profile by stable id (preferred) or username.
 * Used when opening a content owner's profile from Watch or a `u`/`uid`
 * deep link. Returns null when the profile cannot be found or read.
 */
export async function getPublicProfileByIdentity(
  supabase: SupabaseClient,
  identity: { userId?: string | null; username?: string | null }
): Promise<UserProfile | null> {
  const userId =
    typeof identity.userId === "string" ? identity.userId.trim() : "";
  const username =
    typeof identity.username === "string"
      ? identity.username.trim().replace(/^@+/, "").toLowerCase()
      : "";

  if (!userId && !username) {
    return null;
  }

  let query = supabase.from("profiles").select(PROFILE_COLUMNS);
  query = userId ? query.eq("id", userId) : query.eq("username", username);

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("Unable to load public profile:", error);
    return null;
  }
  if (!data) {
    return null;
  }
  return mapProfileRow(data as Parameters<typeof mapProfileRow>[0]);
}
