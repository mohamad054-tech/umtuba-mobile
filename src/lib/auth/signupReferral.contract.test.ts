import { describe, expect, it } from "vitest";

import {
  SIGNUP_FORBIDDEN_FIELD_LABELS,
  SIGNUP_VISIBLE_FIELDS,
} from "./signupForm";

describe("signup invite/referral field contract", () => {
  it("exposes only name, username, email, and password", () => {
    expect([...SIGNUP_VISIBLE_FIELDS]).toEqual([
      "fullName",
      "username",
      "email",
      "password",
    ]);
    expect(SIGNUP_VISIBLE_FIELDS).not.toContain("referralCode");
    expect(SIGNUP_VISIBLE_FIELDS).not.toContain("inviteCode");
  });

  it("forbids invite/referral labels on the normal signup form", () => {
    expect(SIGNUP_FORBIDDEN_FIELD_LABELS).toEqual(
      expect.arrayContaining([
        "Referral code (optional)",
        "رقم الدعوة",
        "رمز الدعوة",
      ])
    );
  });
});
