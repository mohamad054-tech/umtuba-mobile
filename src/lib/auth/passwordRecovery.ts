import type { SupabaseClient } from "@supabase/supabase-js";

import { getErrorMessage, validatePassword } from "@/src/contracts/validation";

export type ParsedRecoveryAuth =
  | {
      kind: "tokens";
      accessToken: string;
      refreshToken: string;
      type: string | null;
    }
  | { kind: "code"; code: string }
  | { kind: "none" };

export type RecoveryFailureReason =
  | "invalid_token"
  | "expired"
  | "missing"
  | "unknown";

export type EstablishRecoveryResult =
  | { ok: true; type: string | null }
  | {
      ok: false;
      reason: RecoveryFailureReason;
      message: string;
    };

/**
 * Parse Supabase auth callback params from a recovery deep link.
 * Supports hash tokens (implicit) and `?code=` (PKCE), across umtuba://,
 * https://umtuba.com, and Expo `exp://…/--/…` URLs.
 */
export function parseRecoveryAuthUrl(rawUrl: string): ParsedRecoveryAuth {
  const url = rawUrl.trim();
  if (!url) {
    return { kind: "none" };
  }

  const params = new URLSearchParams();

  const hashIndex = url.indexOf("#");
  if (hashIndex >= 0) {
    const hash = url.slice(hashIndex + 1);
    const hashQuery = hash.includes("=") ? hash : "";
    if (hashQuery) {
      const hashParams = new URLSearchParams(hashQuery);
      hashParams.forEach((value, key) => {
        params.set(key, value);
      });
    }
  }

  const withoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = withoutHash.indexOf("?");
  if (queryIndex >= 0) {
    const queryParams = new URLSearchParams(withoutHash.slice(queryIndex + 1));
    queryParams.forEach((value, key) => {
      if (!params.has(key)) {
        params.set(key, value);
      }
    });
  }

  const accessToken = params.get("access_token")?.trim() || "";
  const refreshToken = params.get("refresh_token")?.trim() || "";
  const type = params.get("type")?.trim().toLowerCase() || null;
  const code = params.get("code")?.trim() || "";
  const errorDescription =
    params.get("error_description")?.trim() ||
    params.get("error")?.trim() ||
    "";

  if (accessToken && refreshToken) {
    return {
      kind: "tokens",
      accessToken,
      refreshToken,
      type,
    };
  }

  if (code) {
    return { kind: "code", code };
  }

  if (errorDescription) {
    return { kind: "none" };
  }

  return { kind: "none" };
}

export function isRecoveryCallbackUrl(rawUrl: string): boolean {
  const parsed = parseRecoveryAuthUrl(rawUrl);
  if (parsed.kind === "tokens") {
    return !parsed.type || parsed.type === "recovery";
  }
  if (parsed.kind === "code") {
    // PKCE code on the update-password path is treated as recovery callback.
    return /auth\/update-password|update-password/i.test(rawUrl);
  }
  return false;
}

export function classifyRecoveryAuthError(
  error: unknown
): RecoveryFailureReason {
  const message = getErrorMessage(error, "").toLowerCase();
  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message).toLowerCase()
      : message;

  if (
    /expir|otp_expired|token has expired|session_not_found|flow_state.*expired/i.test(
      raw
    )
  ) {
    return "expired";
  }

  if (
    /invalid.*(jwt|token|refresh|login)|bad_jwt|invalid claim|not authorized|auth session missing|invalid_grant/i.test(
      raw
    )
  ) {
    return "invalid_token";
  }

  return "unknown";
}

export function recoveryFailureMessage(reason: RecoveryFailureReason): string {
  switch (reason) {
    case "expired":
      return "This password reset link has expired. Request a new one.";
    case "invalid_token":
      return "This password reset link is invalid. Request a new one.";
    case "missing":
      return "Open the reset link from your email to choose a new password.";
    default:
      return "Unable to verify the password reset link. Try again.";
  }
}

/** Client surface used by recovery helpers (keeps tests free of full SDK mocks). */
export type RecoveryAuthClient = {
  auth: {
    setSession: (tokens: {
      access_token: string;
      refresh_token: string;
    }) => Promise<{ data: unknown; error: { message: string } | null }>;
    exchangeCodeForSession: (
      code: string
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    updateUser: (attributes: {
      password: string;
    }) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
};

export async function establishRecoverySession(
  client: RecoveryAuthClient | SupabaseClient,
  parsed: ParsedRecoveryAuth
): Promise<EstablishRecoveryResult> {
  if (parsed.kind === "none") {
    return {
      ok: false,
      reason: "missing",
      message: recoveryFailureMessage("missing"),
    };
  }

  if (parsed.kind === "tokens") {
    if (parsed.type && parsed.type !== "recovery") {
      return {
        ok: false,
        reason: "invalid_token",
        message: recoveryFailureMessage("invalid_token"),
      };
    }
    const { error } = await client.auth.setSession({
      access_token: parsed.accessToken,
      refresh_token: parsed.refreshToken,
    });
    if (error) {
      const reason = classifyRecoveryAuthError(error);
      return {
        ok: false,
        reason,
        message: recoveryFailureMessage(reason),
      };
    }
    return { ok: true, type: parsed.type ?? "recovery" };
  }

  const { error } = await client.auth.exchangeCodeForSession(parsed.code);
  if (error) {
    const reason = classifyRecoveryAuthError(error);
    return {
      ok: false,
      reason,
      message: recoveryFailureMessage(reason),
    };
  }
  return { ok: true, type: "recovery" };
}

export function validatePasswordUpdate(
  password: string,
  confirmPassword: string
): string | null {
  const base = validatePassword(password);
  if (base) {
    return base;
  }
  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }
  return null;
}

export async function updatePasswordWithSession(
  client: RecoveryAuthClient | SupabaseClient,
  password: string,
  confirmPassword: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const validationError = validatePasswordUpdate(password, confirmPassword);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  const { error } = await client.auth.updateUser({ password });
  if (error) {
    const reason = classifyRecoveryAuthError(error);
    if (reason === "expired" || reason === "invalid_token") {
      return { ok: false, message: recoveryFailureMessage(reason) };
    }
    return {
      ok: false,
      message: getErrorMessage(error, "Unable to update password."),
    };
  }

  return { ok: true };
}
