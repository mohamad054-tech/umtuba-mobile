import { describe, expect, it } from "vitest";

import {
  buildInvitePath,
  normalizeReferralCode,
  REFERRAL_ATTRIBUTION_TTL_SECONDS,
  REFERRAL_COOKIE_NAME,
  REFERRAL_VISITOR_COOKIE,
} from "./referral";

describe("normalizeReferralCode", () => {
  it("uppercases and accepts valid codes", () => {
    expect(normalizeReferralCode("abc123")).toBe("ABC123");
    expect(normalizeReferralCode("  ZYX987  ")).toBe("ZYX987");
  });

  it("rejects invalid codes", () => {
    expect(normalizeReferralCode("")).toBeNull();
    expect(normalizeReferralCode("ab")).toBeNull();
    expect(normalizeReferralCode("toolongcodevalue12")).toBeNull();
    expect(normalizeReferralCode("bad-code")).toBeNull();
    expect(normalizeReferralCode(null)).toBeNull();
  });
});

describe("referral helpers", () => {
  it("builds invite paths and exposes key names", () => {
    expect(buildInvitePath("ABC123")).toBe("/invite/ABC123");
    expect(REFERRAL_COOKIE_NAME).toBe("umtuba_ref");
    expect(REFERRAL_VISITOR_COOKIE).toBe("umtuba_vid");
    expect(REFERRAL_ATTRIBUTION_TTL_SECONDS).toBe(30 * 24 * 60 * 60);
  });
});
