import { describe, expect, it } from "vitest";

import { formatWalletAmount, formatWalletAmountExact } from "./format";

describe("formatWalletAmount", () => {
  it("formats compact amounts", () => {
    expect(formatWalletAmount(0)).toBe("0");
    expect(formatWalletAmount(999)).toBe("999");
    expect(formatWalletAmount(1500)).toBe("1.5K");
    expect(formatWalletAmount(12_000)).toBe("12K");
    expect(formatWalletAmount(2_500_000)).toBe("2.5M");
  });

  it("handles non-finite", () => {
    expect(formatWalletAmount(Number.NaN)).toBe("0");
  });
});

describe("formatWalletAmountExact", () => {
  it("uses locale grouping", () => {
    expect(formatWalletAmountExact(1234)).toMatch(/1/);
    expect(formatWalletAmountExact(-5)).toBe("0");
  });
});
