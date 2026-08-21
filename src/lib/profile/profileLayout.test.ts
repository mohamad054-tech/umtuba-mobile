import { describe, expect, it } from "vitest";

import {
  FOLD6_FOLDED_WIDTH_DP,
  FOLD6_UNFOLDED_WIDTH_DP,
  PROFILE_COVER_HEIGHT_DP,
  PROFILE_LARGE_SCREEN_MIN_WIDTH,
  PROFILE_MEDIA_MAX_HEIGHT_DP,
  PROFILE_MEDIA_NARROW_ASPECT,
  PROFILE_MEDIA_RESIZE_MODE,
  PROFILE_MEDIA_WIDE_ASPECT,
  PROFILE_READABLE_MAX_WIDTH,
  containedFrameFitsBox,
  isProfileLargeScreen,
  resolveProfileContentWidth,
  resolveProfileMediaAspect,
  resolveProfileMediaBox,
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

describe("profile post media contain box", () => {
  it("keeps the decorative cover as a layout container only", () => {
    expect(PROFILE_COVER_HEIGHT_DP).toBe(148);
  });

  it("does not force a 16:9 cover crop on folded or phone widths", () => {
    expect(PROFILE_MEDIA_RESIZE_MODE).toBe("contain");
    expect(resolveProfileMediaAspect(FOLD6_FOLDED_WIDTH_DP)).toBe(
      PROFILE_MEDIA_NARROW_ASPECT
    );
    expect(resolveProfileMediaAspect(390)).toBe(PROFILE_MEDIA_NARROW_ASPECT);
    expect(PROFILE_MEDIA_NARROW_ASPECT).not.toBe(16 / 9);
  });

  it("keeps unfolded media in the readable 16:9 contain box", () => {
    expect(PROFILE_MEDIA_RESIZE_MODE).toBe("contain");
    expect(resolveProfileMediaAspect(FOLD6_UNFOLDED_WIDTH_DP)).toBe(
      PROFILE_MEDIA_WIDE_ASPECT
    );
    expect(PROFILE_MEDIA_WIDE_ASPECT).toBe(16 / 9);
  });

  it("fits 9:16 and 16:9 frames inside folded and unfolded boxes without crop or overflow", () => {
    const folded = resolveProfileMediaBox(FOLD6_FOLDED_WIDTH_DP);
    const unfolded = resolveProfileMediaBox(FOLD6_UNFOLDED_WIDTH_DP);
    const phone = resolveProfileMediaBox(390);

    for (const box of [folded, unfolded, phone]) {
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
      expect(box.height).toBeLessThanOrEqual(PROFILE_MEDIA_MAX_HEIGHT_DP);
      expect(containedFrameFitsBox(9 / 16, box)).toBe(true);
      expect(containedFrameFitsBox(16 / 9, box)).toBe(true);
      expect(containedFrameFitsBox(1, box)).toBe(true);
    }

    expect(folded.width).toBeLessThanOrEqual(FOLD6_FOLDED_WIDTH_DP);
    expect(phone.width).toBeLessThanOrEqual(390);
    expect(unfolded.width).toBeLessThanOrEqual(PROFILE_READABLE_MAX_WIDTH);
    expect(unfolded.width).toBeLessThan(FOLD6_UNFOLDED_WIDTH_DP);
  });
});
