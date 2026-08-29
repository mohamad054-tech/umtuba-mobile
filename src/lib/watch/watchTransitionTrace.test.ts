import { describe, expect, it } from "vitest";

import { markWatchTransition } from "./watchTransitionTrace";

describe("markWatchTransition", () => {
  it("records Android marks and ignores iOS", () => {
    const android = markWatchTransition("android", "current_end", {
      index: 2,
    });
    expect(android?.phase).toBe("current_end");
    expect(android?.index).toBe(2);
    expect(typeof android?.t).toBe("number");
    expect(markWatchTransition("ios", "current_end")).toBeNull();
  });
});
