import { describe, expect, it } from "vitest";

import { translate } from "@/src/lib/i18n/translate";

import {
  SIGNUP_VISIBLE_FIELDS,
  signupValidationErrorKey,
} from "./signupForm";

describe("signup form contract", () => {
  it("exposes only name, username, email, and password", () => {
    expect([...SIGNUP_VISIBLE_FIELDS]).toEqual([
      "fullName",
      "username",
      "email",
      "password",
    ]);
    expect(SIGNUP_VISIBLE_FIELDS).not.toContain("referralCode");
  });

  it("allows a complete form without any referral code", () => {
    expect(
      signupValidationErrorKey({
        fullName: "Lina",
        username: "lina.creates",
        email: "lina@example.com",
        password: "secret1",
      })
    ).toBeNull();
  });

  it("localizes invalid username instead of leaking English USERNAME_HINT", () => {
    expect(
      signupValidationErrorKey({
        fullName: "Lina",
        username: "ab",
        email: "lina@example.com",
        password: "secret1",
      })
    ).toBe("auth.signup.usernameHint");

    const ar = translate("ar", "auth.signup.usernameHint");
    const en = translate("en", "auth.signup.usernameHint");
    expect(en).toMatch(/3–24/);
    expect(ar).not.toBe(en);
    expect(ar).not.toMatch(/lowercase letters/);
    expect(translate("fr", "auth.signup.usernameHint")).toMatch(/minuscules/);
    expect(translate("es", "auth.signup.usernameHint")).toMatch(/minúsculas/);
    expect(translate("de", "auth.signup.usernameHint")).toMatch(/Kleinbuchstaben/);
    expect(translate("pt", "auth.signup.usernameHint")).toMatch(/minúsculas/);
  });

  it("keeps email, password, and name gates", () => {
    expect(
      signupValidationErrorKey({
        fullName: "",
        username: "lina.creates",
        email: "lina@example.com",
        password: "secret1",
      })
    ).toBe("auth.signup.fullNameRequired");
    expect(
      signupValidationErrorKey({
        fullName: "Lina",
        username: "lina.creates",
        email: "not-an-email",
        password: "secret1",
      })
    ).toBe("auth.signup.emailInvalid");
    expect(
      signupValidationErrorKey({
        fullName: "Lina",
        username: "lina.creates",
        email: "lina@example.com",
        password: "12345",
      })
    ).toBe("auth.signup.passwordMin");
  });
});
