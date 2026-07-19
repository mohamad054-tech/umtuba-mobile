import * as Linking from "expo-linking";

/** Custom URL scheme registered in app.config.ts (`scheme` / iOS CFBundleURLTypes). */
export const APP_SCHEME = "umtuba";

/** Path used for password-recovery redirects (must stay in sync with deepLinks). */
export const AUTH_UPDATE_PASSWORD_PATH = "auth/update-password";

/**
 * Public redirect URL patterns to allow in Supabase Dashboard → Authentication →
 * URL Configuration → Redirect URLs.
 *
 * These are not secrets. Add them before testing recovery links on device builds.
 * Do not use Expo Go for stable auth redirects — use a development or preview build.
 */
export const SUPABASE_AUTH_REDIRECT_ALLOWLIST = [
  "umtuba://auth/update-password",
  "umtuba://**",
  "https://umtuba.com/**",
  "https://www.umtuba.com/**",
] as const;

/**
 * Build a stable deep-link redirect for Supabase Auth email flows.
 * Forces the app scheme so development/preview builds do not emit Expo Go `exp://` URLs.
 */
export function createAuthRedirectUrl(
  path: string = AUTH_UPDATE_PASSWORD_PATH
): string {
  const normalized = path.replace(/^\/+/, "");
  return Linking.createURL(normalized, { scheme: APP_SCHEME });
}
