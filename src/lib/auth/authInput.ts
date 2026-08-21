import type { TextInputProps } from "react-native";

import type { TranslationKey } from "@/src/lib/i18n/messages/types";

export type AuthPasswordPurpose = "current" | "new";

export type TextSelectionRange = {
  start: number;
  end: number;
};

/** Password fields start masked. Visibility is ephemeral UI state only. */
export const PASSWORD_VISIBLE_DEFAULT = false;

/** Matches signup / recovery minimum (6). Hint only — OS password UI. */
export const AUTH_NEW_PASSWORD_RULES = "minlength: 6;";

type AutofillInputProps = Pick<
  TextInputProps,
  | "autoComplete"
  | "textContentType"
  | "keyboardType"
  | "autoCapitalize"
  | "autoCorrect"
  | "spellCheck"
  | "importantForAutofill"
  | "passwordRules"
>;

const SHARED_AUTOFILL: Pick<
  AutofillInputProps,
  "autoCapitalize" | "autoCorrect" | "spellCheck" | "importantForAutofill"
> = {
  autoCapitalize: "none",
  autoCorrect: false,
  spellCheck: false,
  importantForAutofill: "yes",
};

export function nextPasswordVisible(visible: boolean): boolean {
  return !visible;
}

export function passwordSecureTextEntry(visible: boolean): boolean {
  return !visible;
}

/** Toggle never mutates the entered value. */
export function passwordValueAfterVisibilityToggle<T>(value: T): T {
  return value;
}

export function shouldRestoreFocusAfterVisibilityToggle(
  wasFocused: boolean
): boolean {
  return wasFocused;
}

export function restoreSelectionAfterSecureToggle(
  selection: TextSelectionRange | null | undefined
): TextSelectionRange | undefined {
  if (
    !selection ||
    typeof selection.start !== "number" ||
    typeof selection.end !== "number"
  ) {
    return undefined;
  }
  return { start: selection.start, end: selection.end };
}

export function passwordVisibilityLabelKey(
  visible: boolean
): TranslationKey {
  return visible ? "auth.password.hide" : "auth.password.show";
}

/**
 * Login identifier is the email field. Password managers pair this slot as
 * username even when the keyboard stays email-address.
 */
export function loginIdentifierAutofillProps(): AutofillInputProps {
  return {
    ...SHARED_AUTOFILL,
    autoComplete: "username",
    textContentType: "username",
    keyboardType: "email-address",
  };
}

export function signupEmailAutofillProps(): AutofillInputProps {
  return {
    ...SHARED_AUTOFILL,
    autoComplete: "email",
    textContentType: "emailAddress",
    keyboardType: "email-address",
  };
}

export function signupUsernameAutofillProps(): AutofillInputProps {
  return {
    ...SHARED_AUTOFILL,
    autoComplete: "username",
    textContentType: "username",
  };
}

export function signupNameAutofillProps(): AutofillInputProps {
  return {
    autoComplete: "name",
    textContentType: "name",
    importantForAutofill: "yes",
    autoCorrect: true,
  };
}

export function forgotEmailAutofillProps(): AutofillInputProps {
  return signupEmailAutofillProps();
}

export function passwordAutofillProps(
  purpose: AuthPasswordPurpose
): AutofillInputProps {
  if (purpose === "new") {
    return {
      ...SHARED_AUTOFILL,
      autoComplete: "new-password",
      textContentType: "newPassword",
      passwordRules: AUTH_NEW_PASSWORD_RULES,
    };
  }
  return {
    ...SHARED_AUTOFILL,
    autoComplete: "password",
    textContentType: "password",
  };
}
