import { describe, expect, it } from "vitest";

import { resolveProfileTarget } from "./resolveTarget";

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
});
