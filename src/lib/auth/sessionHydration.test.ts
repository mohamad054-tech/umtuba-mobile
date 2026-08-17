import { describe, expect, it } from "vitest";

import { shouldSkipInitialSessionClobber } from "./sessionHydration";

const persisted = {
  access_token: "tok",
  refresh_token: "r1",
  user: { id: "user-1" },
};

describe("session hydration clobber guard", () => {
  it("ignores INITIAL_SESSION(null) while hydrating a persisted session", () => {
    expect(
      shouldSkipInitialSessionClobber({
        hydrating: true,
        event: "INITIAL_SESSION",
        nextSession: null,
      })
    ).toBe(true);
  });

  it("still applies a valid INITIAL_SESSION during hydration", () => {
    expect(
      shouldSkipInitialSessionClobber({
        hydrating: true,
        event: "INITIAL_SESSION",
        nextSession: persisted,
      })
    ).toBe(false);
  });

  it("applies INITIAL_SESSION(null) after hydration completes", () => {
    expect(
      shouldSkipInitialSessionClobber({
        hydrating: false,
        event: "INITIAL_SESSION",
        nextSession: null,
      })
    ).toBe(false);
  });

  it("never skips SIGNED_OUT or TOKEN_REFRESHED", () => {
    expect(
      shouldSkipInitialSessionClobber({
        hydrating: true,
        event: "SIGNED_OUT",
        nextSession: null,
      })
    ).toBe(false);
    expect(
      shouldSkipInitialSessionClobber({
        hydrating: true,
        event: "TOKEN_REFRESHED",
        nextSession: persisted,
      })
    ).toBe(false);
  });
});
