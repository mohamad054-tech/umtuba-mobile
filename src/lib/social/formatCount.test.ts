import { describe, expect, it } from "vitest";

import { formatInteractionCount } from "./formatCount";

describe("formatInteractionCount", () => {
  it("matches the website compact labels", () => {
    expect(formatInteractionCount(0)).toBe("0");
    expect(formatInteractionCount(999)).toBe("999");
    expect(formatInteractionCount(1000)).toBe("1K");
    expect(formatInteractionCount(1200)).toBe("1.2K");
    expect(formatInteractionCount(15_000)).toBe("15K");
    expect(formatInteractionCount(2_500_000)).toBe("2.5M");
  });

  it("does not invent a count from invalid input", () => {
    expect(formatInteractionCount(Number.NaN)).toBe("0");
    expect(formatInteractionCount(-4)).toBe("0");
  });
});
