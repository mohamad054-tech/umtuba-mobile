import { describe, expect, it } from "vitest";

import { planWatchAuthorProfileNavigation } from "./watchProfileNav";

const IMAN_ID = "aaaaaaaa-1111-4111-8111-111111111111";
const MOHAMAD_ID = "bbbbbbbb-2222-4222-8222-222222222222";
const OTHER_ID = "cccccccc-3333-4333-8333-333333333333";

describe("planWatchAuthorProfileNavigation", () => {
  it("A: auth Mohamad + author Iman opens Iman, not Mohamad", () => {
    const plan = planWatchAuthorProfileNavigation({
      author: { id: IMAN_ID, username: "@iman" },
      signedInUserId: MOHAMAD_ID,
      signedInUsername: "mohamad",
    });
    expect(plan.action).toBe("push");
    if (plan.action !== "push") return;
    expect(plan.href).toContain(`id=${IMAN_ID}`);
    expect(plan.href).toContain("u=iman");
    expect(plan.href).not.toContain(MOHAMAD_ID);
    expect(plan.target).toEqual({
      kind: "other",
      username: "iman",
      userId: IMAN_ID,
    });
  });

  it("B: auth Mohamad + own video opens own profile", () => {
    const plan = planWatchAuthorProfileNavigation({
      author: { id: MOHAMAD_ID, username: "@mohamad" },
      signedInUserId: MOHAMAD_ID,
      signedInUsername: "mohamad",
    });
    expect(plan.action).toBe("push");
    if (plan.action !== "push") return;
    expect(plan.target).toEqual({ kind: "own" });
  });

  it("C: two foreign authors each keep their own target", () => {
    const iman = planWatchAuthorProfileNavigation({
      author: { id: IMAN_ID, username: "iman" },
      signedInUserId: MOHAMAD_ID,
      signedInUsername: "mohamad",
    });
    const other = planWatchAuthorProfileNavigation({
      author: { id: OTHER_ID, username: "marina" },
      signedInUserId: MOHAMAD_ID,
      signedInUsername: "mohamad",
    });
    expect(iman.action).toBe("push");
    expect(other.action).toBe("push");
    if (iman.action !== "push" || other.action !== "push") return;
    expect(iman.target).toMatchObject({ kind: "other", userId: IMAN_ID });
    expect(other.target).toMatchObject({ kind: "other", userId: OTHER_ID });
    expect(iman.href).not.toBe(other.href);
  });

  it("D: avatar and name use the same author href", () => {
    const author = { id: IMAN_ID, username: "@iman" };
    const fromName = planWatchAuthorProfileNavigation({
      author,
      signedInUserId: MOHAMAD_ID,
      signedInUsername: "mohamad",
    });
    const fromAvatar = planWatchAuthorProfileNavigation({
      author,
      signedInUserId: MOHAMAD_ID,
      signedInUsername: "mohamad",
    });
    expect(fromName).toEqual(fromAvatar);
    expect(fromName.action).toBe("push");
  });

  it("E: missing or invalid author is a no-op, not the current user", () => {
    expect(
      planWatchAuthorProfileNavigation({
        author: { id: null, username: "" },
        signedInUserId: MOHAMAD_ID,
        signedInUsername: "mohamad",
      })
    ).toEqual({ action: "none", reason: "missing-author" });
    expect(
      planWatchAuthorProfileNavigation({
        author: { id: "not-a-uuid", username: "@" },
        signedInUserId: MOHAMAD_ID,
        signedInUsername: "mohamad",
      })
    ).toEqual({ action: "none", reason: "missing-author" });
  });

  it("F: uses stack push so Watch index can return", () => {
    const plan = planWatchAuthorProfileNavigation({
      author: { id: IMAN_ID, username: "iman" },
      signedInUserId: MOHAMAD_ID,
      signedInUsername: "mohamad",
    });
    expect(plan.action).toBe("push");
    if (plan.action !== "push") return;
    expect(plan.href.startsWith("/profile?")).toBe(true);
    expect(plan.href.includes("replace")).toBe(false);
  });
});
