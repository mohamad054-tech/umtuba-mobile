import type { User } from "@supabase/supabase-js";

import type { UserProfile } from "@/src/lib/auth/types";

export type ProfilePresentation = {
  displayName: string | null;
  username: string | null;
  avatarInitial: string;
  avatarUrl: string | null;
  bio: string | null;
  email: string | null;
  locationLine: string | null;
  createdAt: string | null;
  /** True when we have a profile row or trustworthy metadata identity. */
  hasReliableIdentity: boolean;
};

function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isHttpUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function initialFrom(name: string | null, username: string | null): string {
  const source = name || username;
  if (!source) return "?";
  const ch = source.charAt(0).toUpperCase();
  return /[A-Z0-9]/i.test(ch) ? ch : "?";
}

function locationLine(
  city: string | null,
  country: string | null
): string | null {
  const parts = [cleanText(city), cleanText(country)].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Build UI-safe profile fields. Never invents placeholder identities like
 * "UMTUBA User" / "@user" when data is missing.
 */
export function buildProfilePresentation(
  profile: UserProfile | null,
  user: User | null
): ProfilePresentation {
  const email = cleanText(user?.email ?? null);

  if (!profile) {
    const metaName =
      cleanText(
        typeof user?.user_metadata?.display_name === "string"
          ? user.user_metadata.display_name
          : null
      ) ||
      cleanText(
        typeof user?.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : null
      );
    const metaUsername = cleanText(
      typeof user?.user_metadata?.username === "string"
        ? user.user_metadata.username
        : null
    );

    return {
      displayName: metaName,
      username: metaUsername,
      avatarInitial: initialFrom(metaName, metaUsername),
      avatarUrl: null,
      bio: null,
      email,
      locationLine: null,
      createdAt: cleanText(user?.created_at ?? null),
      hasReliableIdentity: Boolean(metaName || metaUsername || email),
    };
  }

  const displayName = cleanText(profile.display_name);
  const username = cleanText(profile.username);
  const avatarUrl = isHttpUrl(cleanText(profile.avatar_url))
    ? cleanText(profile.avatar_url)
    : null;
  const bio = cleanText(profile.bio);
  const avatarInitial =
    cleanText(profile.avatar_initial)?.charAt(0).toUpperCase() ||
    initialFrom(displayName, username);

  return {
    displayName,
    username,
    avatarInitial,
    avatarUrl,
    bio,
    email,
    locationLine: locationLine(profile.city, profile.country),
    createdAt: cleanText(profile.created_at ?? user?.created_at ?? null),
    hasReliableIdentity: Boolean(displayName || username || email),
  };
}
