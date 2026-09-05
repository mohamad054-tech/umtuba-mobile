import { describe, expect, it } from "vitest";

import { planOtherProfileLookup, resolveProfileTarget } from "./resolveTarget";

describe("resolveProfileTarget", () => {
  it("treats a missing or blank ?u= as own profile", () => {
    expect(resolveProfileTarget({ signedInUsername: "sam" })).toEqual({
      kind: "own",
    });
    expect(
      resolveProfileTarget({ queryUsername: "  ", signedInUsername: "sam" })
    ).toEqual({ kind: "own" });
    expect(
      resolveProfileTarget({ queryUsername: "@", signedInUsername: "sam" })
    ).toEqual({ kind: "own" });
  });

  it("treats ?u= matching the signed-in username as own (with or without @)", () => {
    expect(
      resolveProfileTarget({ queryUsername: "Sam", signedInUsername: "sam" })
    ).toEqual({ kind: "own" });
    expect(
      resolveProfileTarget({ queryUsername: "@sam", signedInUsername: "sam" })
    ).toEqual({ kind: "own" });
  });

  it("targets another username when ?u= is a different handle", () => {
    expect(
      resolveProfileTarget({ queryUsername: "alice", signedInUsername: "sam" })
    ).toEqual({ kind: "other", username: "alice" });
    expect(
      resolveProfileTarget({ queryUsername: "@Bob", signedInUsername: "sam" })
    ).toEqual({ kind: "other", username: "bob" });
  });

  it("still targets other when signed out so public profiles can load", () => {
    expect(resolveProfileTarget({ queryUsername: "alice" })).toEqual({
      kind: "other",
      username: "alice",
    });
  });

  it("prefers ?id= over a denormalized or placeholder ?u=", () => {
    expect(
      resolveProfileTarget({
        queryUsername: "user",
        queryUserId: "11111111-1111-4111-8111-111111111111",
        signedInUsername: "sam",
        signedInUserId: "22222222-2222-4222-8222-222222222222",
      })
    ).toEqual({
      kind: "other",
      username: "user",
      userId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("treats ?id= matching the signed-in auth user as own", () => {
    expect(
      resolveProfileTarget({
        queryUsername: "alice",
        queryUserId: "11111111-1111-4111-8111-111111111111",
        signedInUsername: "sam",
        signedInUserId: "11111111-1111-4111-8111-111111111111",
      })
    ).toEqual({ kind: "own" });
  });

  it("ignores non-uuid ?id= and falls back to username", () => {
    expect(
      resolveProfileTarget({
        queryUsername: "alice",
        queryUserId: "not-a-user-id",
        signedInUsername: "sam",
      })
    ).toEqual({ kind: "other", username: "alice" });
  });
});

describe("planOtherProfileLookup", () => {
  it("looks up by profiles.id first when Watch passed author.id", () => {
    expect(
      planOtherProfileLookup({
        kind: "other",
        username: "user",
        userId: "11111111-1111-4111-8111-111111111111",
      })
    ).toEqual({
      primary: {
        field: "id",
        value: "11111111-1111-4111-8111-111111111111",
      },
      fallback: { field: "username", value: "user" },
    });
  });

  it("keeps username-only lookup for deep links without id", () => {
    expect(
      planOtherProfileLookup({ kind: "other", username: "alice" })
    ).toEqual({
      primary: { field: "username", value: "alice" },
      fallback: null,
    });
  });
});
