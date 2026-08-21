import {
  isValidEmail,
  isValidUsername,
  normalizeUsername,
} from "@/src/contracts/validation";
import type { TranslationKey } from "@/src/lib/i18n/messages/types";

export type SignupFormValues = {
  fullName: string;
  username: string;
  email: string;
  password: string;
};

/** Visible primary signup fields. Referral is never a form input. */
export const SIGNUP_VISIBLE_FIELDS = [
  "fullName",
  "username",
  "email",
  "password",
] as const;

export function signupValidationErrorKey(
  values: SignupFormValues
): TranslationKey | null {
  if (!values.fullName.trim()) {
    return "auth.signup.fullNameRequired";
  }

  const username = normalizeUsername(values.username);
  if (!username) {
    return "auth.signup.usernameRequired";
  }
  if (!isValidUsername(username)) {
    return "auth.signup.usernameHint";
  }
  if (!isValidEmail(values.email.trim())) {
    return "auth.signup.emailInvalid";
  }
  if (!values.password) {
    return "auth.signup.passwordRequired";
  }
  if (values.password.length < 6) {
    return "auth.signup.passwordMin";
  }
  return null;
}
