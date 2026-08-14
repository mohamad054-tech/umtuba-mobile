import { describe, expect, it } from "vitest";

import {
  UGC_ACCOUNT_DELETION_URL,
  UGC_COMMUNITY_POLICY_URL,
  UGC_REASON_CODES,
  UGC_SIGNUP_TERMS_LABEL,
  canAcceptTerms,
  canBlockUser,
  canReportOwnTarget,
  filterConversationsByBlockedPeers,
  filterVideosByBlockedAuthors,
  mapUgcRpcError,
  shouldHideByBlock,
  validateReportInput,
} from "./ugcPolicy";

describe("ugcPolicy", () => {
  it("requires explicit terms acceptance", () => {
    expect(canAcceptTerms(false)).toBe(false);
    expect(canAcceptTerms(true)).toBe(true);
    expect(UGC_SIGNUP_TERMS_LABEL).toMatch(/Terms/);
    expect(UGC_COMMUNITY_POLICY_URL).toBe("https://umtuba.com/terms");
    expect(UGC_ACCOUNT_DELETION_URL).toBe("https://umtuba.com/account-deletion");
  });

  it("validates report reasons and trims detail", () => {
    expect(validateReportInput({ reasonCode: null }).ok).toBe(false);
    expect(validateReportInput({ reasonCode: "not-a-reason" }).ok).toBe(false);
    const ok = validateReportInput({
      reasonCode: "spam",
      detail: "  too many ads  ",
    });
    expect(ok).toEqual({
      ok: true,
      reasonCode: "spam",
      detail: "too many ads",
    });
    expect(UGC_REASON_CODES).toContain("harassment");
  });

  it("forbids self-report and self-block", () => {
    expect(canReportOwnTarget("a", "a")).toBe(false);
    expect(canReportOwnTarget("a", "b")).toBe(true);
    expect(canBlockUser("a", "a")).toBe(false);
    expect(canBlockUser("a", "b")).toBe(true);
    expect(canBlockUser(null, "b")).toBe(false);
  });

  it("hides blocked authors and conversation peers", () => {
    const blocked = new Set(["blocked-1"]);
    expect(shouldHideByBlock("blocked-1", blocked)).toBe(true);
    expect(shouldHideByBlock("safe", blocked)).toBe(false);
    expect(shouldHideByBlock(null, blocked)).toBe(false);

    const videos = filterVideosByBlockedAuthors(
      [
        { id: "1", author: { id: "blocked-1" } },
        { id: "2", author: { id: "safe" } },
        { id: "3", author: { id: null } },
      ],
      blocked
    );
    expect(videos.map((v) => v.id)).toEqual(["2", "3"]);

    const conversations = filterConversationsByBlockedPeers(
      [
        { id: "c1", peerId: "blocked-1" },
        { id: "c2", peerId: "safe" },
      ],
      blocked
    );
    expect(conversations.map((c) => c.id)).toEqual(["c2"]);
  });

  it("maps backend report/block errors for confirmation UX", () => {
    expect(mapUgcRpcError("Already reported", "x")).toMatchObject({
      ok: false,
      duplicate: true,
    });
    expect(mapUgcRpcError("Authentication required", "x").requiresAuth).toBe(true);
    expect(mapUgcRpcError("Too many reports", "x").message).toMatch(/later/i);
    expect(mapUgcRpcError("Cannot message a blocked user", "x").message).toMatch(
      /blocked/
    );
  });
});
