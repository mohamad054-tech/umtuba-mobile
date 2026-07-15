/**
 * Referral Rewards V1 — framework-neutral config + helpers.
 * Amounts mirror `um_points_config` (DB is source of truth).
 */

export const REFERRAL_COOKIE_NAME = "umtuba_ref";
export const REFERRAL_VISITOR_COOKIE = "umtuba_vid";

/** Attribution first-touch TTL (seconds). Default 30 days. */
export const REFERRAL_ATTRIBUTION_TTL_SECONDS = 30 * 24 * 60 * 60;

export const UM_POINTS_REFERRAL = {
  referralSignup: 20,
  attributionTtlDays: 30,
  growthMode: true,
  emergencyDailyCapPerInviter: 100,
  milestone5: 0,
  milestone10: 0,
  milestone25: 0,
} as const;

const CODE_RE = /^[A-Z0-9]{6,16}$/;

export function normalizeReferralCode(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

export function buildInvitePath(code: string): string {
  return `/invite/${code}`;
}

export function buildSignupRefPath(code: string): string {
  return `/signup?ref=${encodeURIComponent(code)}`;
}

export function buildInviteAbsoluteUrl(
  code: string,
  origin?: string | null
): string {
  const path = buildInvitePath(code);
  if (origin) return `${origin.replace(/\/$/, "")}${path}`;
  return `https://umtuba.com${path}`;
}
