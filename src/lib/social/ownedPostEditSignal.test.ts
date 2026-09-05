import { describe, expect, it } from "vitest";

import { markOwnedPostEdited, takeOwnedPostEdited } from "./ownedPostEditSignal";

describe("ownedPostEditSignal", () => {
  it("hands the edited post id to Watch once", () => {
    markOwnedPostEdited(42);
    expect(takeOwnedPostEdited()).toBe(42);
    expect(takeOwnedPostEdited()).toBeNull();
  });

  it("ignores invalid ids", () => {
    markOwnedPostEdited(0);
    expect(takeOwnedPostEdited()).toBeNull();
  });
});
