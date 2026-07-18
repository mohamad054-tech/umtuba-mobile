import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";

import { normalizeReferralCode } from "@/src/contracts/referral";
import {
  getErrorMessage,
  isValidEmail,
  isValidUsername,
  normalizeUsername,
  USERNAME_HINT,
  validatePassword,
} from "@/src/contracts/validation";
import { getProfileForUser } from "@/src/lib/auth/profile";
import {
  clearReferralAttribution,
  getOrCreateVisitorId,
  getReferralAttribution,
} from "@/src/lib/auth/referralAttribution";
import type { UserProfile } from "@/src/lib/auth/types";
import { getSupabase } from "@/src/lib/supabase/client";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  /** Set when public env is missing/invalid — blocks auth without crashing. */
  configError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    fullName: string;
    username: string;
    referralCode?: string | null;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  restore: (opts?: { silent?: boolean }) => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function claimReferralAfterSignup(): Promise<void> {
  const supabase = getSupabase();
  const { code, visitorId } = await getReferralAttribution();
  const anonymousVisitorId = visitorId ?? (await getOrCreateVisitorId());

  try {
    const { error } = await supabase.rpc("claim_my_referral_signup", {
      p_referral_code: code,
      p_anonymous_visitor_id: anonymousVisitorId,
      p_ip_hash: null,
      p_user_agent_hash: null,
    });
    if (error) {
      console.error("claim_my_referral_signup failed:", error.message);
      return;
    }
    await clearReferralAttribution();
  } catch (err) {
    console.error("claim_my_referral_signup error:", err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const applySession = useCallback(async (next: Session | null) => {
    setSession(next);
    const nextUser = next?.user ?? null;
    setUser(nextUser);
    if (nextUser) {
      try {
        const nextProfile = await getProfileForUser(nextUser);
        setProfile(nextProfile);
      } catch (err) {
        console.error("Profile load failed:", err);
        setProfile(null);
      }
    } else {
      setProfile(null);
    }
  }, []);

  const restore = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      try {
        const supabase = getSupabase();
        setConfigError(null);
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          throw sessionError;
        }
        await applySession(data.session);
      } catch (err) {
        const raw =
          err instanceof Error ? err.message : getErrorMessage(err, "");
        if (raw.includes("Invalid UMTUBA mobile env")) {
          setConfigError(
            err instanceof Error
              ? err.message
              : "Missing Supabase configuration. Copy .env.example to .env."
          );
        } else {
          setError(getErrorMessage(err, "Unable to restore session."));
        }
        await applySession(null);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [applySession]
  );

  useEffect(() => {
    void restore();
    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const supabase = getSupabase();
      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        void applySession(nextSession);
      });
      subscription = data.subscription;
    } catch (err) {
      setConfigError(
        err instanceof Error
          ? err.message
          : "Missing Supabase configuration. Copy .env.example to .env."
      );
      setLoading(false);
    }
    return () => subscription?.unsubscribe();
    // Bootstrap once on mount; restore/applySession are stable enough via refs pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only bootstrap
  }, []);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (
        (prev === "background" || prev === "inactive") &&
        next === "active" &&
        !configError
      ) {
        void restore({ silent: true });
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [configError, restore]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null);
      if (!isValidEmail(email)) {
        throw new Error("Please enter a valid email address.");
      }
      const passwordError = validatePassword(password);
      if (passwordError) {
        throw new Error(passwordError);
      }

      const supabase = getSupabase();
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError) {
        const message = getErrorMessage(signInError, "Unable to sign in.");
        setError(message);
        throw new Error(message);
      }

      await applySession(data.session);
    },
    [applySession]
  );

  const signUp = useCallback(
    async (input: {
      email: string;
      password: string;
      fullName: string;
      username: string;
      referralCode?: string | null;
    }) => {
      setError(null);
      const email = input.email.trim();
      const fullName = input.fullName.trim();
      const username = normalizeUsername(input.username);

      if (!isValidEmail(email)) {
        throw new Error("Please enter a valid email address.");
      }
      const passwordError = validatePassword(input.password);
      if (passwordError) {
        throw new Error(passwordError);
      }
      if (!fullName) {
        throw new Error("Please enter your full name.");
      }
      if (!username) {
        throw new Error("Please choose a username.");
      }
      if (!isValidUsername(username)) {
        throw new Error(USERNAME_HINT);
      }

      const supabase = getSupabase();
      const attributed = await getReferralAttribution();
      const ref = normalizeReferralCode(
        input.referralCode ?? attributed.code
      );

      const { data: existingUsername } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (existingUsername) {
        throw new Error("That username is already taken.");
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: input.password,
        options: {
          data: {
            full_name: fullName,
            display_name: fullName,
            username,
            ...(ref ? { referral_code: ref } : {}),
          },
        },
      });

      if (signUpError) {
        const message = getErrorMessage(
          signUpError,
          "Unable to create your account."
        );
        setError(message);
        throw new Error(message);
      }

      if (data.user && !data.session) {
        throw new Error(
          "Account created. Please check your email to confirm your address before signing in."
        );
      }

      await applySession(data.session);
      await claimReferralAfterSignup();
    },
    [applySession]
  );

  const signOut = useCallback(async () => {
    setError(null);
    const supabase = getSupabase();
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      const message = getErrorMessage(signOutError, "Unable to sign out.");
      setError(message);
      throw new Error(message);
    }
    await applySession(null);
  }, [applySession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      loading,
      error,
      configError,
      signIn,
      signUp,
      signOut,
      restore,
      clearError: () => setError(null),
    }),
    [
      session,
      user,
      profile,
      loading,
      error,
      configError,
      signIn,
      signUp,
      signOut,
      restore,
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return ctx;
}
