/**
 * Visible primary signup fields. Referral / invite code is never a form input.
 * Silent deep-link attribution may still run outside this list.
 */
export const SIGNUP_VISIBLE_FIELDS = [
  "fullName",
  "username",
  "email",
  "password",
] as const;

export type SignupVisibleField = (typeof SIGNUP_VISIBLE_FIELDS)[number];

/** Labels that must not appear as a signup input. */
export const SIGNUP_FORBIDDEN_FIELD_LABELS = [
  "Referral code (optional)",
  "Referral code, optional",
  "رقم الدعوة",
  "رمز الدعوة",
] as const;
