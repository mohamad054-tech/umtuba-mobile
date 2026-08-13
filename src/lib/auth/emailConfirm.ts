import type { SupabaseClient } from "@supabase/supabase-js";

import {
  classifyRecoveryAuthError,
  parseRecoveryAuthUrl,
  type RecoveryAuthClient,
  type ParsedRecoveryAuth,
} from "@/src/lib/auth/passwordRecovery";

const EMAIL_CONFIRM_TYPES = new Set([
  "signup",
  "email",
  "magiclink",
  "email_change",
]);

export type EstablishEmailConfirmResult =
  | { ok: true; type: string | null }
  | { ok: false; message: string };

export function isEmailConfirmCallbackUrl(rawUrl: string): boolean {
  const parsed = parseRecoveryAuthUrl(rawUrl);
  if (parsed.kind === "none") return false;

  if (parsed.kind === "tokens") {
    return parsed.type != null && EMAIL_CONFIRM_TYPES.has(parsed.type);
  }

  return /auth\/callback/i.test(rawUrl);
}

export function emailConfirmFailureMessage(): string {
  return "This confirmation link is invalid or has expired. Try signing in or request a new email.";
}

export async function establishEmailConfirmSession(
  client: RecoveryAuthClient | SupabaseClient,
  parsed: ParsedRecoveryAuth
): Promise<EstablishEmailConfirmResult> {
  if (parsed.kind === "none") {
    return { ok: false, message: emailConfirmFailureMessage() };
  }

  if (parsed.kind === "tokens") {
    if (parsed.type && !EMAIL_CONFIRM_TYPES.has(parsed.type)) {
      return { ok: false, message: emailConfirmFailureMessage() };
    }
    const { error } = await client.auth.setSession({
      access_token: parsed.accessToken,
      refresh_token: parsed.refreshToken,
    });
    if (error) {
      const reason = classifyRecoveryAuthError(error);
      return {
        ok: false,
        message:
          reason === "expired" || reason === "invalid_token"
            ? emailConfirmFailureMessage()
            : error.message || emailConfirmFailureMessage(),
      };
    }
    return { ok: true, type: parsed.type };
  }

  const { error } = await client.auth.exchangeCodeForSession(parsed.code);
  if (error) {
    const reason = classifyRecoveryAuthError(error);
    return {
      ok: false,
      message:
        reason === "expired" || reason === "invalid_token"
          ? emailConfirmFailureMessage()
          : error.message || emailConfirmFailureMessage(),
    };
  }
  return { ok: true, type: "signup" };
}
