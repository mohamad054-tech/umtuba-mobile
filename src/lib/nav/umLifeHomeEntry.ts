/**
 * UM Life Home Entry V1 — first-class tab to the authorized social Home.
 *
 * Native social screen is Discover (`/(tabs)/discover`). UM Life is that same
 * screen with a first-class label — not a second feed.
 * Learning and Store have no native product screens on this authorized base;
 * those tabs open official umtuba.com destinations via the in-app browser.
 */

export const UM_LIFE_ENTRY_LABEL = "UM Life" as const;
export const UM_LIFE_TAB_ROUTE = "/(tabs)/discover" as const;
export const UM_LIFE_PURPOSE = "Social Home" as const;

export const UM_LIFE_BADGE_CAPABILITY = "READY" as const;
export const UM_LIFE_BADGE_LIVE_DATA = false;

export const PRIMARY_TAB_IDS = [
  "watch",
  "discover",
  "create",
  "learning",
  "store",
] as const;

export const PRIMARY_TAB_TITLES = [
  "Watch",
  "UM Life",
  "Create",
  "Learning",
  "Store",
] as const;

export const HIDDEN_PRESERVED_TAB_IDS = ["live", "messages"] as const;

export const OFFICIAL_WEB_DESTINATIONS = {
  learning: "https://umtuba.com/learning",
  store: "https://umtuba.com/store",
} as const;

export type UmLifeActivityBadge = {
  capability: typeof UM_LIFE_BADGE_CAPABILITY;
  liveData: typeof UM_LIFE_BADGE_LIVE_DATA;
  count: number | null;
};

export function resolveUmLifeActivityBadgeCount(): number | null {
  return null;
}

export function resolveUmLifeActivityBadge(): UmLifeActivityBadge {
  const count = resolveUmLifeActivityBadgeCount();
  return {
    capability: UM_LIFE_BADGE_CAPABILITY,
    liveData: UM_LIFE_BADGE_LIVE_DATA,
    count: typeof count === "number" && count > 0 ? count : null,
  };
}

export function isOfficialWebDestination(
  url: string,
  key: keyof typeof OFFICIAL_WEB_DESTINATIONS
): boolean {
  return url === OFFICIAL_WEB_DESTINATIONS[key];
}

export function umLifeNavCopy(locale: "en" | "ar"): {
  umLife: typeof UM_LIFE_ENTRY_LABEL;
  umLifeAria: string;
  watch: string;
  create: string;
  learning: string;
  store: string;
  openLearning: string;
  openStore: string;
} {
  if (locale === "ar") {
    return {
      umLife: UM_LIFE_ENTRY_LABEL,
      umLifeAria: "UM Life، المنزل الاجتماعي",
      watch: "شاهد",
      create: "إنشاء",
      learning: "التعلّم",
      store: "المتجر",
      openLearning: "فتح التعلّم على أمتوبة",
      openStore: "فتح المتجر على أمتوبة",
    };
  }
  return {
    umLife: UM_LIFE_ENTRY_LABEL,
    umLifeAria: "UM Life, social home",
    watch: "Watch",
    create: "Create",
    learning: "Learning",
    store: "Store",
    openLearning: "Open Learning on UMTUBA",
    openStore: "Open Store on UMTUBA",
  };
}
