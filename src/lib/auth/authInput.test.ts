import { describe, expect, it } from "vitest";

import { translate } from "@/src/lib/i18n/translate";

import {
  AUTH_NEW_PASSWORD_RULES,
  PASSWORD_VISIBLE_DEFAULT,
  forgotEmailAutofillProps,
  loginIdentifierAutofillProps,
  nextPasswordVisible,
  passwordAutofillProps,
  passwordSecureTextEntry,
  passwordValueAfterVisibilityToggle,
  passwordVisibilityLabelKey,
  restoreSelectionAfterSecureToggle,
  shouldRestoreFocusAfterVisibilityToggle,
  signupEmailAutofillProps,
  signupNameAutofillProps,
  signupUsernameAutofillProps,
} from "./authInput";

describe("password visibility contract", () => {
  it("starts masked", () => {
    expect(PASSWORD_VISIBLE_DEFAULT).toBe(false);
    expect(passwordSecureTextEntry(PASSWORD_VISIBLE_DEFAULT)).toBe(true);
  });

  it("toggles visibility without changing the value", () => {
    const value = "keep-this-secret";
    const shown = nextPasswordVisible(PASSWORD_VISIBLE_DEFAULT);
    expect(shown).toBe(true);
    expect(passwordSecureTextEntry(shown)).toBe(false);
    expect(passwordValueAfterVisibilityToggle(value)).toBe(value);

    const hiddenAgain = nextPasswordVisible(shown);
    expect(hiddenAgain).toBe(false);
    expect(passwordSecureTextEntry(hiddenAgain)).toBe(true);
    expect(passwordValueAfterVisibilityToggle(value)).toBe("keep-this-secret");
  });

  it("restores focus and selection only when the field was focused", () => {
    expect(shouldRestoreFocusAfterVisibilityToggle(true)).toBe(true);
    expect(shouldRestoreFocusAfterVisibilityToggle(false)).toBe(false);
    expect(restoreSelectionAfterSecureToggle({ start: 3, end: 3 })).toEqual({
      start: 3,
      end: 3,
    });
    expect(restoreSelectionAfterSecureToggle(null)).toBeUndefined();
  });
});

describe("autofill metadata", () => {
  it("configures login email as the password-manager username slot", () => {
    const email = loginIdentifierAutofillProps();
    expect(email.textContentType).toBe("username");
    expect(email.autoComplete).toBe("username");
    expect(email.keyboardType).toBe("email-address");
    expect(email.autoCapitalize).toBe("none");
    expect(email.autoCorrect).toBe(false);
    expect(email.importantForAutofill).toBe("yes");
  });

  it("uses current-password semantics on login", () => {
    const password = passwordAutofillProps("current");
    expect(password.textContentType).toBe("password");
    expect(password.autoComplete).toBe("password");
    expect(password.autoCapitalize).toBe("none");
    expect(password.autoCorrect).toBe(false);
    expect(password.importantForAutofill).toBe("yes");
    expect(password.passwordRules).toBeUndefined();
  });

  it("uses new-password semantics on signup and confirmation", () => {
    const created = passwordAutofillProps("new");
    expect(created.textContentType).toBe("newPassword");
    expect(created.autoComplete).toBe("new-password");
    expect(created.passwordRules).toBe(AUTH_NEW_PASSWORD_RULES);
    expect(created.importantForAutofill).toBe("yes");
    expect(passwordAutofillProps("new")).toEqual(created);
  });

  it("keeps signup email / username / name distinguishable", () => {
    const email = signupEmailAutofillProps();
    expect(email.autoComplete).toBe("email");
    expect(email.textContentType).toBe("emailAddress");
    expect(email.keyboardType).toBe("email-address");
    expect(email.importantForAutofill).toBe("yes");

    const username = signupUsernameAutofillProps();
    expect(username.autoComplete).toBe("username");
    expect(username.textContentType).toBe("username");
    expect(username.importantForAutofill).toBe("yes");

    const name = signupNameAutofillProps();
    expect(name.autoComplete).toBe("name");
    expect(name.textContentType).toBe("name");

    expect(forgotEmailAutofillProps()).toEqual(email);
  });
});

describe("password visibility accessibility labels", () => {
  it("localizes show/hide in English and Arabic", () => {
    expect(passwordVisibilityLabelKey(false)).toBe("auth.password.show");
    expect(passwordVisibilityLabelKey(true)).toBe("auth.password.hide");

    expect(translate("en", "auth.password.show")).toBe("Show password");
    expect(translate("en", "auth.password.hide")).toBe("Hide password");
    expect(translate("ar", "auth.password.show")).toBe("إظهار كلمة المرور");
    expect(translate("ar", "auth.password.hide")).toBe("إخفاء كلمة المرور");
    expect(translate("ar", "auth.password.show")).not.toBe(
      translate("en", "auth.password.show")
    );
  });

  it("localizes the remaining catalogs without English leak", () => {
    expect(translate("fr", "auth.password.show")).toMatch(/mot de passe/i);
    expect(translate("es", "auth.password.show")).toMatch(/contraseña/i);
    expect(translate("de", "auth.password.show")).toMatch(/Passwort/);
    expect(translate("pt", "auth.password.show")).toMatch(/senha/i);
    for (const locale of ["fr", "es", "de", "pt"] as const) {
      expect(translate(locale, "auth.password.show")).not.toBe("Show password");
      expect(translate(locale, "auth.password.hide")).not.toBe("Hide password");
    }
  });
});
