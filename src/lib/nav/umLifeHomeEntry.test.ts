import { describe, expect, it } from "vitest";

import { mapPlatformDestination } from "@/src/lib/platform/destination";
import { mapWorldDestination } from "@/src/lib/world/mapDestination";
import {
  HIDDEN_PRESERVED_TAB_IDS,
  OFFICIAL_WEB_DESTINATIONS,
  PRIMARY_TAB_IDS,
  PRIMARY_TAB_TITLES,
  UM_LIFE_BADGE_CAPABILITY,
  UM_LIFE_BADGE_LIVE_DATA,
  UM_LIFE_ENTRY_LABEL,
  UM_LIFE_PURPOSE,
  UM_LIFE_TAB_ROUTE,
  isOfficialWebDestination,
  resolveUmLifeActivityBadge,
  resolveUmLifeActivityBadgeCount,
  umLifeNavCopy,
} from "@/src/lib/nav/umLifeHomeEntry";

describe("UM Life Home Entry V1 mobile", () => {
  it("labels Discover as UM Life without creating a second social feed", () => {
    expect(UM_LIFE_ENTRY_LABEL).toBe("UM Life");
    expect(UM_LIFE_PURPOSE).toBe("Social Home");
    expect(UM_LIFE_TAB_ROUTE).toBe("/(tabs)/discover");
    expect(PRIMARY_TAB_TITLES).toEqual([
      "Watch",
      "UM Life",
      "Create",
      "Learning",
      "Store",
    ]);
    expect(PRIMARY_TAB_IDS).toEqual([
      "watch",
      "discover",
      "create",
      "learning",
      "store",
    ]);
  });

  it("maps / and /life to the same Discover social Home", () => {
    expect(mapPlatformDestination("/")).toBe("/(tabs)/discover");
    expect(mapPlatformDestination("/life")).toBe("/(tabs)/discover");
    expect(mapPlatformDestination("/discover")).toBe("/(tabs)/discover");
    expect(mapPlatformDestination("https://umtuba.com/life")).toBe(
      "/(tabs)/discover"
    );
    expect(mapPlatformDestination("/watch")).toBe("/(tabs)/watch");
    expect(mapWorldDestination("/life")).toBe("/(tabs)/discover");
  });

  it("wires Learning and Store to official web destinations, not dead tabs", () => {
    expect(OFFICIAL_WEB_DESTINATIONS.learning).toBe("https://umtuba.com/learning");
    expect(OFFICIAL_WEB_DESTINATIONS.store).toBe("https://umtuba.com/store");
    expect(
      isOfficialWebDestination("https://umtuba.com/learning", "learning")
    ).toBe(true);
    expect(isOfficialWebDestination("https://evil.example/learning", "learning")).toBe(
      false
    );
    expect(mapPlatformDestination("/learning")).toBe("/(tabs)/learning");
    expect(mapPlatformDestination("/store")).toBe("/(tabs)/store");
  });

  it("keeps Live and Messages as preserved hidden tabs", () => {
    expect([...HIDDEN_PRESERVED_TAB_IDS]).toEqual(["live", "messages"]);
    expect(mapPlatformDestination("/(tabs)/live")).toBe("/(tabs)/live");
    expect(mapPlatformDestination("/(tabs)/messages")).toBe("/(tabs)/messages");
  });

  it("prepares a badge slot without live counts and localizes EN+AR", () => {
    expect(UM_LIFE_BADGE_CAPABILITY).toBe("READY");
    expect(UM_LIFE_BADGE_LIVE_DATA).toBe(false);
    expect(resolveUmLifeActivityBadgeCount()).toBeNull();
    expect(resolveUmLifeActivityBadge().count).toBeNull();
    expect(umLifeNavCopy("en").umLife).toBe("UM Life");
    expect(umLifeNavCopy("ar").umLife).toBe("UM Life");
    expect(umLifeNavCopy("en").umLifeAria).toMatch(/social home/i);
    expect(umLifeNavCopy("ar").learning).toBe("التعلّم");
    expect(umLifeNavCopy("ar").watch).toBe("شاهد");
  });
});
