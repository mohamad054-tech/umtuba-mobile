import { describe, expect, it } from "vitest";

import {
  FOLD6_FOLDED_WIDTH_DP,
  FOLD6_UNFOLDED_WIDTH_DP,
  PROFILE_LARGE_SCREEN_MIN_WIDTH,
  PROFILE_READABLE_MAX_WIDTH,
  isProfileLargeScreen,
  resolveProfileContentWidth,
} from "./profileLayout";

describe("profile large-screen layout", () => {
  it("keeps Fold6 folded as a full-width phone column", () => {
    expect(FOLD6_FOLDED_WIDTH_DP).toBeLessThan(PROFILE_LARGE_SCREEN_MIN_WIDTH);
    expect(isProfileLargeScreen(FOLD6_FOLDED_WIDTH_DP)).toBe(false);
    expect(resolveProfileContentWidth(FOLD6_FOLDED_WIDTH_DP)).toBe(
      FOLD6_FOLDED_WIDTH_DP
    );
  });

  it("caps Fold6 unfolded so Profile is not a stretched phone UI", () => {
    expect(FOLD6_UNFOLDED_WIDTH_DP).toBeGreaterThan(
      PROFILE_LARGE_SCREEN_MIN_WIDTH
    );
    expect(isProfileLargeScreen(FOLD6_UNFOLDED_WIDTH_DP)).toBe(true);
    expect(resolveProfileContentWidth(FOLD6_UNFOLDED_WIDTH_DP)).toBe(
      PROFILE_READABLE_MAX_WIDTH
    );
    expect(resolveProfileContentWidth(FOLD6_UNFOLDED_WIDTH_DP)).toBeLessThan(
      FOLD6_UNFOLDED_WIDTH_DP
    );
  });

  it("uses the readable column on iPhone-sized and wide windows correctly", () => {
    expect(resolveProfileContentWidth(390)).toBe(390);
    expect(resolveProfileContentWidth(430)).toBe(430);
    expect(resolveProfileContentWidth(600)).toBe(PROFILE_READABLE_MAX_WIDTH);
    expect(resolveProfileContentWidth(1856)).toBe(PROFILE_READABLE_MAX_WIDTH);
  });
});
