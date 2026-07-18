import { describe, expect, it } from "vitest";

/**
 * Contract mirror of AuthContext claim_my_referral_signup RPC args.
 * Must stay aligned with umtuba-web / DB (p_referral_code, not p_code).
 */
function buildClaimReferralRpcArgs(input: {
  code: string | null;
  anonymousVisitorId: string;
}) {
  return {
    p_referral_code: input.code,
    p_anonymous_visitor_id: input.anonymousVisitorId,
    p_ip_hash: null,
    p_user_agent_hash: null,
  };
}

describe("claim_my_referral_signup RPC args", () => {
  it("uses p_referral_code (web/DB contract)", () => {
    const args = buildClaimReferralRpcArgs({
      code: "ABC123XY",
      anonymousVisitorId: "vid-1",
    });
    expect(args).toEqual({
      p_referral_code: "ABC123XY",
      p_anonymous_visitor_id: "vid-1",
      p_ip_hash: null,
      p_user_agent_hash: null,
    });
    expect(args).not.toHaveProperty("p_code");
  });
});
