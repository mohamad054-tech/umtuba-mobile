import { describe, expect, it } from "vitest";

import {
  normalizeAchievementMedals,
  shouldShowIdentityAchievements,
} from "@/src/lib/profile/profileIdentityAchievements";
import { emptyProfileAboutExtras } from "@/src/lib/profile/profileAbout";
import {
  shouldShowIdentityStrip,
} from "@/src/lib/profile/profileIdentityStrip";
import { bioNeedsExpandToggle } from "@/src/lib/profile/profileHeroCompleteness";

describe("hide-empty identity extras", () => {
  it("hides achievements, roles, and interests when empty", () => {
    const extras = emptyProfileAboutExtras();
    expect(shouldShowIdentityAchievements(extras.achievements)).toBe(false);
    expect(
      shouldShowIdentityStrip({
        roles: extras.roles,
        interests: extras.interests,
      })
    ).toBe(false);
    expect(normalizeAchievementMedals(null).visible).toEqual([]);
  });

  it("shows medals only for real labels and overflows after 3", () => {
    const medals = normalizeAchievementMedals([
      "Gold",
      "gold",
      "Silver",
      "Bronze",
      "Copper",
    ]);
    expect(medals.visible).toEqual(["Gold", "Silver", "Bronze"]);
    expect(medals.overflowCount).toBe(1);
    expect(shouldShowIdentityAchievements(["Gold"])).toBe(true);
  });

  it("does not add a bio toggle for short bios", () => {
    expect(bioNeedsExpandToggle("Hello")).toBe(false);
    expect(bioNeedsExpandToggle("x".repeat(140))).toBe(true);
  });
});
