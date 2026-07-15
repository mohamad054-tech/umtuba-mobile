import type { User } from "@supabase/supabase-js";

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
