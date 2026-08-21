import type { Session, User } from "@supabase/supabase-js";

export type UserProfile = {
  id: string;
  username: string;
  display_name: string;
  full_name: string;
  bio: string | null;
  city: string | null;
  country: string | null;
  avatar_url: string | null;
  avatar_initial: string;
  /** Existing `profiles.created_at`. Omitted when the row has no safe value. */
  created_at?: string | null;
};

export type AuthState = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
};
